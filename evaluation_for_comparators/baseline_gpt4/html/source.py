import re
import os
import sys
import json
import tracer_skip as tool_functions


def escape(s, quote=True):
    """
    Replace special characters "&", "<" and ">" to HTML-safe sequences.
    If the optional flag quote is true (the default), the quotation mark
    characters, both double quote (") and single quote (') characters are also
    translated.
    """
    s = s.replace("&", "&amp;") # Must be done first!
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    if quote:
        s = s.replace('"', "&quot;")
        s = s.replace('\'', "&#x27;")
    return s



def _replace_charref(s):

    if s[0] == '#':
        # numeric charref
        if s[1] in 'xX':
            num = int(s[2:].rstrip(';'), 16)
        else:
            num = int(s[1:].rstrip(';'))
        if num in tool_functions._invalid_charrefs:
            return tool_functions._invalid_charrefs[num]
        if 0xD800 <= num <= 0xDFFF or num > 0x10FFFF:
            return '\uFFFD'
        if num in tool_functions._invalid_codepoints:
            return ''
        return chr(num)
    else:
        # named charref
        if s in tool_functions._html5:
            return tool_functions._html5[s]
        # find the longest matching name (as defined by the standard)
        for x in range(len(s)-1, 1, -1):
            if s[:x] in tool_functions._html5:
                return tool_functions._html5[s[:x]] + s[x:]
        else:
            return '&' + s

def unescape(s):
    """
    Convert all named and numeric character references (e.g. &gt;, &#62;,
    &x3e;) in the string s to the corresponding unicode characters.
    This function uses the rules defined by the HTML 5 standard
    for both valid and invalid character references, and the list of
    HTML 5 named character references defined in html.entities.html5.
    """
    if '&' not in s:
        return s
    start = 0
    while True:
        match = _charref_regular_exp.search(s, start)  # Search for the pattern
        if not match:  # If no more matches, break the loop
            break
        # Replace the matched text
        replacement = _replace_charref(match.group(1))
        s = s[:match.start()] + replacement + s[match.end():]
        # Update the start index to avoid infinite loop
        start = match.start() + len(replacement)
    return s

class ParserBase:
    """Parser base class which provides some common support methods used
    by the SGML/HTML and XHTML parsers."""

    def __init__(self):
        pass
        # if self.__class__ is ParserBase:
        #     raise RuntimeError(
        #         "ParserBase must be subclassed")

    def reset(self):
        self.lineno = 1
        self.offset = 0

    def getpos(self):
        """Return current line number and offset."""
        return self.lineno, self.offset

    # Internal -- update line number and offset.  This should be
    # called for each piece of data exactly once, in order -- in other
    # words the concatenation of all the input strings to this
    # function should be exactly the entire input.
    def updatepos(self, i, j):
        if i >= j:
            return j
        rawdata = self.rawdata
        nlines = rawdata.count("\n", i, j)
        if nlines:
            self.lineno = self.lineno + nlines
            pos = rawdata.rindex("\n", i, j) # Should not fail
            self.offset = j-(pos+1)
        else:
            self.offset = self.offset + j-i
        return j

    _decl_otherchars = ''

    # TRANSLATION NOTE: this function is inside a class `ParserBase.`
    # Internal -- parse declaration (for use by subclasses).
    def parse_declaration(self, i):
        rawdata = self.rawdata
        j = i + 2
        assert rawdata[i:j] == "<!", "unexpected call to parse_declaration"
        if rawdata[j:j+1] == ">":
            # the empty comment <!>
            return j + 1
        if rawdata[j:j+1] in ("-", ""):
            # Start of comment followed by buffer boundary,
            # or just a buffer boundary.
            return -1
        # A simple, practical version could look like: ((name|stringlit) S*) + '>'
        n = len(rawdata)
        if rawdata[j:j+2] == '--': #comment
            # Locate --.*-- as the body of the comment
            return self.parse_comment(i, 1)
        elif rawdata[j] == '[': #marked section
            # Locate [statusWord [...arbitrary SGML...]] as the body of the marked section
            # Where statusWord is one of TEMP, CDATA, IGNORE, INCLUDE, RCDATA
            # Note that this is extended by Microsoft Office "Save as Web" function
            # to include [if...] and [endif].
            return self.parse_marked_section(i, 1)
        else: #all other declaration elements
            decltype, j = self._scan_name(j, i)
        if j < 0:
            return j
        if decltype == "doctype":
            self._decl_otherchars = ''
        while j < n:
            c = rawdata[j]
            if c == ">":
                # end of declaration syntax
                data = rawdata[i+2:j]
                if decltype == "doctype":
                    self.handle_decl(data)
                else:
                    # According to the HTML5 specs sections "8.2.4.44 Bogus
                    # comment state" and "8.2.4.45 Markup declaration open
                    # state", a comment token should be emitted.
                    # Calling unknown_decl provides more flexibility though.
                    self.unknown_decl(data)
                return j + 1
            if c in "\"'":
                m = _declstringlit.match(rawdata, j)
                if not m:
                    return -1 # incomplete
                j = m.end()
            elif c in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ":
                name, j = self._scan_name(j, i)
            elif c in self._decl_otherchars:
                j = j + 1
            elif c == "[":
                # this could be handled in a separate doctype parser
                if decltype == "doctype":
                    j = self._parse_doctype_subset(j + 1, i)
                elif decltype in {"attlist", "linktype", "link", "element"}:
                    # must tolerate []'d groups in a content model in an element declaration
                    # also in data attribute specifications of attlist declaration
                    # also link type declaration subsets in linktype declarations
                    # also link attribute specification lists in link declarations
                    raise AssertionError("unsupported '[' char in %s declaration" % decltype)
                else:
                    raise AssertionError("unexpected '[' char in declaration")
            else:
                raise AssertionError("unexpected %r char in declaration" % rawdata[j])
            if j < 0:
                return j
        return -1 # incomplete

    # TRANSLATION NOTE: these functions are inside a class `ParserBase.`
    # Internal -- parse a marked section
    # Override this to handle MS-word extension syntax <![if word]>content<![endif]>
    def parse_marked_section(self, i, report):
        rawdata= self.rawdata
        assert rawdata[i:i+3] == '<![', "unexpected call to parse_marked_section()"
        sectName, j = self._scan_name( i+3, i )
        if j < 0:
            return j
        if sectName in {"temp", "cdata", "ignore", "include", "rcdata"}:
            # look for standard ]]> ending
            match= _markedsectionclose.search(rawdata, i+3)
        elif sectName in {"if", "else", "endif"}:
            # look for MS Office ]> ending
            match= _msmarkedsectionclose.search(rawdata, i+3)
        else:
            raise AssertionError(
                'unknown status keyword %r in marked section' % rawdata[i+3:j]
            )
        if not match:
            return -1
        if report:
            j = match.start(0)
            self.unknown_decl(rawdata[i+3: j])
        return match.end(0)

    # Internal -- parse comment, return length or -1 if not terminated
    def parse_comment(self, i, report=1):
        rawdata = self.rawdata
        if rawdata[i:i+4] != '<!--':
            raise AssertionError('unexpected call to parse_comment()')
        match = _commentclose.search(rawdata, i+4)
        if not match:
            return -1
        if report:
            j = match.start(0)
            self.handle_comment(rawdata[i+4: j])
        return match.end(0)

    # TRANSLATION NOTE: this function is inside a class `ParserBase.`
    # Internal -- scan past the internal subset in a <!DOCTYPE declaration,
    # returning the index just past any whitespace following the trailing ']'.
    def _parse_doctype_subset(self, i, declstartpos):
        rawdata = self.rawdata
        n = len(rawdata)
        j = i
        while j < n:
            c = rawdata[j]
            if c == "<":
                s = rawdata[j:j+2]
                if s == "<":
                    # end of buffer; incomplete
                    return -1
                if s != "<!":
                    self.updatepos(declstartpos, j + 1)
                    raise AssertionError(
                        "unexpected char in internal subset (in %r)" % s
                    )
                if (j + 2) == n:
                    # end of buffer; incomplete
                    return -1
                if (j + 4) > n:
                    # end of buffer; incomplete
                    return -1
                if rawdata[j:j+4] == "<!--":
                    j = self.parse_comment(j, 0)
                    if j < 0:
                        return j
                    continue
                name, j = self._scan_name(j + 2, declstartpos)
                if j == -1:
                    return -1
                if name not in {"attlist", "element", "entity", "notation"}:
                    self.updatepos(declstartpos, j + 2)
                    raise AssertionError(
                        "unknown declaration %r in internal subset" % name
                    )
                # handle the individual names
                meth = getattr(self, "_parse_doctype_" + name)
                j = meth(j, declstartpos)
                if j < 0:
                    return j
            elif c == "%":
                # parameter entity reference
                if (j + 1) == n:
                    # end of buffer; incomplete
                    return -1
                s, j = self._scan_name(j + 1, declstartpos)
                if j < 0:
                    return j
                if rawdata[j] == ";":
                    j = j + 1
            elif c == "]":
                j = j + 1
                while j < n and rawdata[j].isspace():
                    j = j + 1
                if j < n:
                    if rawdata[j] == ">":
                        return j
                    self.updatepos(declstartpos, j)
                    raise AssertionError("unexpected char after internal subset")
                else:
                    return -1
            elif c.isspace():
                j = j + 1
            else:
                self.updatepos(declstartpos, j)
                raise AssertionError("unexpected char %r in internal subset" % c)
        # end of buffer reached
        return -1

    # TRANSLATION NOTE: this function is inside a class `ParserBase.`
    # Internal -- scan past <!ELEMENT declarations
    def _parse_doctype_element(self, i, declstartpos):
        name, j = self._scan_name(i, declstartpos)
        if j == -1:
            return -1
        # style content model; just skip until '>'
        rawdata = self.rawdata
        if '>' in rawdata[j:]:
            return rawdata.find(">", j) + 1
        return -1

    # Internal -- scan past <!ATTLIST declarations
    def _parse_doctype_attlist(self, i, declstartpos):
        pass # Not reachable

    # TRANSLATION NOTE: these functions are inside a class `ParserBase.`
    # Internal -- scan past <!NOTATION declarations
    def _parse_doctype_notation(self, i, declstartpos):
        name, j = self._scan_name(i, declstartpos)
        if j < 0:
            return j
        rawdata = self.rawdata
        while 1:
            c = rawdata[j:j+1]
            if not c:
                # end of buffer; incomplete
                return -1
            if c == '>':
                return j + 1
            if c in "'\"":
                m = _declstringlit.match(rawdata, j)
                if not m:
                    return -1
                j = m.end()
            else:
                name, j = self._scan_name(j, declstartpos)
                if j < 0:
                    return j

    # TRANSLATION NOTE: these functions are inside a class `ParserBase.`
    # Internal -- scan past <!ENTITY declarations
    def _parse_doctype_entity(self, i, declstartpos):
        rawdata = self.rawdata
        if rawdata[i:i+1] == "%":
            j = i + 1
            while 1:
                c = rawdata[j:j+1]
                if not c:
                    return -1
                if c.isspace():
                    j = j + 1
                else:
                    break
        else:
            j = i
        name, j = self._scan_name(j, declstartpos)
        if j < 0:
            return j
        while 1:
            c = self.rawdata[j:j+1]
            if not c:
                return -1
            if c in "'\"":
                m = _declstringlit.match(rawdata, j)
                if m:
                    j = m.end()
                else:
                    return -1    # incomplete
            elif c == ">":
                return j + 1
            else:
                name, j = self._scan_name(j, declstartpos)
                if j < 0:
                    return j

    # TRANSLATION NOTE: these functions are inside a class `ParserBase.`
    # Internal -- scan a name token and the new position and the token, or
    # return -1 if we've reached the end of the buffer.
    def _scan_name(self, i, declstartpos):
        rawdata = self.rawdata
        n = len(rawdata)
        if i == n:
            return SCAN_NAME_DEFAULT
        m = _declname.match(rawdata, i)
        if m:
            s = m.group()
            name = s.strip()
            if (i + len(s)) == n:
                return SCAN_NAME_DEFAULT  # end of buffer
            return name.lower(), m.end()
        else:
            self.updatepos(declstartpos, i)
            raise AssertionError(
                "expected name token at %r" % rawdata[declstartpos:declstartpos+20]
            )

    # To be overridden -- handlers for unknown objects
    def unknown_decl(self, data):
        pass

class HTMLParser(ParserBase):
    """Find tags and other markup and call handler functions.

    Usage:
        p = HTMLParser()
        p.feed(data)
        ...
        p.close()

    Start tags are handled by calling self.handle_starttag() or
    self.handle_startendtag(); end tags by self.handle_endtag().  The
    data between tags is passed from the parser to the derived class
    by calling self.handle_data() with the data as argument (the data
    may be split up in arbitrary chunks).  If convert_charrefs is
    True the character references are converted automatically to the
    corresponding Unicode character (and self.handle_data() is no
    longer split in chunks), otherwise they are passed by calling
    self.handle_entityref() or self.handle_charref() with the string
    containing respectively the named or numeric reference as the
    argument.
    """

    def __init__(self, convert_charrefs=True):
        """Initialize and reset this instance.

        If convert_charrefs is True (the default), all character references
        are automatically converted to the corresponding Unicode characters.
        """
        self.CDATA_CONTENT_ELEMENTS = CDATA_CONTENT_ELEMENTS
        self.convert_charrefs = convert_charrefs
        self.reset()

    def reset(self):
        """Reset this instance.  Loses all unprocessed data."""
        self.rawdata = ''
        self.lasttag = '???'
        self.interesting = interesting_normal
        self.cdata_elem = None
        # ParserBase.reset(self)
        self.lineno = 1
        self.offset = 0

    def feed(self, data):
        r"""Feed data to the parser.

        Call this as often as you want, with as little or as much text
        as you want (may include '\n').
        """
        self.rawdata = self.rawdata + data
        self.goahead(0)

    def close(self):
        """Handle any buffered data."""
        self.goahead(1)

    __starttag_text = None

    def get_starttag_text(self):
        """Return full source of start tag: '<...>'."""
        return self.__starttag_text

    def set_cdata_mode(self, elem):
        self.cdata_elem = elem.lower()
        self.interesting = re.compile(r'</\s*%s\s*>' % self.cdata_elem, re.I)

    def clear_cdata_mode(self):
        self.interesting = interesting_normal
        self.cdata_elem = None

    # TRANSLATION NOTE: the following function(s) is inside a class `HTMLParser`
    # Internal -- handle data as far as reasonable.  May leave state
    # and data to be processed by a subsequent call.  If 'end' is
    # true, force handling all data as if followed by EOF marker.
    def goahead(self, end):
        def handle_leftangle():
            nonlocal i
            if starttagopen.match(rawdata, i): # < + letter
                k = self.parse_starttag(i)
            elif rawdata.startswith("</", i):
                k = self.parse_endtag(i)
            elif rawdata.startswith("<!--", i):
                k = self.parse_comment(i, 1)
            elif rawdata.startswith("<?", i):
                k = self.parse_pi(i)
            elif rawdata.startswith("<!", i):
                k = self.parse_html_declaration(i)
            elif (i + 1) < n:
                self.handle_data("<")
                k = i + 1
            else:
                return "break"
            if k < 0:
                if not end:
                    return "break"
                k = rawdata.find('>', i + 1)
                if k < 0:
                    k = rawdata.find('<', i + 1)
                    if k < 0:
                        k = i + 1
                else:
                    k += 1
                if self.convert_charrefs and not self.cdata_elem:
                    self.handle_data(unescape(rawdata[i:k]))
                else:
                    self.handle_data(rawdata[i:k])
            i = self.updatepos(i, k)
        
        def handle_charref():
            nonlocal i
            match = charref.match(rawdata, i)
            if match:
                name = match.group()[2:-1]
                self.handle_charref(name)
                k = match.end()
                if not rawdata.startswith(';', k-1):
                    k = k - 1
                i = self.updatepos(i, k)
                return "continue"
            else:
                if ";" in rawdata[i:]:  # bail by consuming &#
                    self.handle_data(rawdata[i:i+2])
                    i = self.updatepos(i, i+2)
                return "break"

        def handle_entityref():
            nonlocal i
            match = entityref.match(rawdata, i)
            if match:
                name = match.group(1)
                self.handle_entityref(name)
                k = match.end()
                if not rawdata.startswith(';', k-1):
                    k = k - 1
                i = self.updatepos(i, k)
                return "continue"
            match = incomplete.match(rawdata, i)
            if match:
                # match.group() will contain at least 2 chars
                if end and match.group() == rawdata[i:]:
                    k = match.end()
                    if k <= i:
                        k = n
                    i = self.updatepos(i, i + 1)
                # incomplete
                return "break"
            elif (i + 1) < n:
                # not the end of the buffer, and can't be confused
                # with some other construct
                self.handle_data("&")
                i = self.updatepos(i, i + 1)
            else:
                return "break"
                    
        rawdata = self.rawdata
        i = 0
        n = len(rawdata)
        while i < n:
            if self.convert_charrefs and not self.cdata_elem:
                j = rawdata.find('<', i)
                if j < 0:
                    amppos = rawdata.rfind('&', max(i, n-34))
                    if (amppos >= 0 and
                        not re.compile(r'[\s;]').search(rawdata, amppos)):
                        break  # wait till we get all the text
                    j = n
            else:
                match = self.interesting.search(rawdata, i)  # < or &
                if match:
                    j = match.start()
                else:
                    if self.cdata_elem:
                        break
                    j = n
            if i < j:
                if self.convert_charrefs and not self.cdata_elem:
                    self.handle_data(unescape(rawdata[i:j]))
                else:
                    self.handle_data(rawdata[i:j])
            i = self.updatepos(i, j)
            if i == n: break

            if rawdata.startswith('<', i):
                act = handle_leftangle()
                if act == "break":
                    break
                elif act == "continue":
                    continue
                else:
                    pass
            elif rawdata.startswith("&#", i):
                _act = handle_charref()
                if _act == "break":
                    break
                elif _act == "continue":
                    continue
                else:
                    pass
            elif rawdata.startswith('&', i):
                _act = handle_entityref()
                if _act == "break":
                    break
                elif _act == "continue":
                    continue
                else:
                    pass
            else:
                assert 0, "interesting.search() lied"
        # end while
        if end and i < n and not self.cdata_elem:
            if self.convert_charrefs and not self.cdata_elem:
                self.handle_data(unescape(rawdata[i:n]))
            else:
                self.handle_data(rawdata[i:n])
            i = self.updatepos(i, n)
        self.rawdata = rawdata[i:]

    # TRANSLATION NOTE: the following function(s) is inside a class `HTMLParser`
    # Internal -- parse html declarations, return length or -1 if not terminated
    # See w3.org/TR/html5/tokenization.html#markup-declaration-open-state
    # See also parse_declaration in _markupbase
    def parse_html_declaration(self, i):
        rawdata = self.rawdata
        assert rawdata[i:i+2] == '<!', ('unexpected call to '
                                        'parse_html_declaration()')
        if rawdata[i:i+4] == '<!--':
            # this case is actually already handled in goahead()
            return self.parse_comment(i, 1)
        elif rawdata[i:i+3] == '<![':
            return self.parse_marked_section(i, 1)
        elif rawdata[i:i+9].lower() == '<!doctype':
            # find the closing >
            gtpos = rawdata.find('>', i+9)
            if gtpos == -1:
                return -1
            self.handle_decl(rawdata[i+2:gtpos])
            return gtpos+1
        else:
            return self.parse_bogus_comment(i, 1)

    # Internal -- parse bogus comment, return length or -1 if not terminated
    # see http://www.w3.org/TR/html5/tokenization.html#bogus-comment-state
    def parse_bogus_comment(self, i, report=1):
        rawdata = self.rawdata
        assert rawdata[i:i+2] in ('<!', '</'), ('unexpected call to '
                                                'parse_comment()')
        pos = rawdata.find('>', i+2)
        if pos == -1:
            return -1
        if report:
            self.handle_comment(rawdata[i+2:pos])
        return pos + 1

    # Internal -- parse processing instr, return end or -1 if not terminated
    def parse_pi(self, i):
        rawdata = self.rawdata
        assert rawdata[i:i+2] == '<?', 'unexpected call to parse_pi()'
        match = tool_functions.piclose.search(rawdata, i+2) # >
        if not match:
            return -1
        j = match.start()
        self.handle_pi(rawdata[i+2: j])
        j = match.end()
        return j

    # TRANSLATION NOTE: the following function(s) is inside a class `HTMLParser`
    # Internal -- handle starttag, return end or -1 if not terminated
    def parse_starttag(self, i):
        self.__starttag_text = None
        endpos = self.check_for_whole_start_tag(i)
        if endpos < 0:
            return endpos
        rawdata = self.rawdata
        self.__starttag_text = rawdata[i:endpos]

        # Now parse the data between i+1 and j into a tag and attrs
        attrs = []
        match = tagfind_tolerant.match(rawdata, i+1)
        assert match, 'unexpected call to parse_starttag()'
        k = match.end()
        self.lasttag = tag = match.group(1).lower()
        while k < endpos:
            m = attrfind_tolerant.match(rawdata, k)
            if not m:
                break
            attrname, rest, attrvalue = m.group(1, 2, 3)
            if not rest:
                attrvalue = None
            elif attrvalue[:1] == '\'' == attrvalue[-1:] or \
                 attrvalue[:1] == '"' == attrvalue[-1:]:
                attrvalue = attrvalue[1:-1]
            if attrvalue:
                attrvalue = unescape(attrvalue)
            attrs.append((attrname.lower(), attrvalue))
            k = m.end()

        end = rawdata[k:endpos].strip()
        if end not in (">", "/>"):
            self.handle_data(rawdata[i:endpos])
            return endpos
        if end.endswith('/>'):
            # XHTML-style empty tag: <span attr="value" />
            self.handle_startendtag(tag, attrs)
        else:
            self.handle_starttag(tag, attrs)
            if tag in self.CDATA_CONTENT_ELEMENTS:
                self.set_cdata_mode(tag)
        return endpos

    # TRANSLATION NOTE: the following function(s) is inside a class `HTMLParser`
    # Internal -- check to see if we have a complete starttag; return end
    # or -1 if incomplete.
    def check_for_whole_start_tag(self, i):
        rawdata = self.rawdata
        m = locatestarttagend_tolerant.match(rawdata, i)
        if m:
            j = m.end()
            next = rawdata[j:j+1]
            if next == ">":
                return j + 1
            if next == "/":
                if rawdata.startswith("/>", j):
                    return j + 2
                if rawdata.startswith("/", j):
                    # buffer boundary
                    return -1
                # else bogus input
                if j > i:
                    return j
                else:
                    return i + 1
            if next == "":
                # end of input
                return -1
            if next in ("abcdefghijklmnopqrstuvwxyz=/"
                        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
                # end of input in or before attribute value, or we have the
                # '/' from a '/>' ending
                return -1
            if j > i:
                return j
            else:
                return i + 1
        raise AssertionError("we should not get here!")

    # TRANSLATION NOTE: the following function(s) is inside a class `HTMLParser`
    # Internal -- parse endtag, return end or -1 if incomplete
    def parse_endtag(self, i):
        rawdata = self.rawdata
        assert rawdata[i:i+2] == "</", "unexpected call to parse_endtag"
        match = endendtag.search(rawdata, i+1) # >
        if not match:
            return -1
        gtpos = match.end()
        match = endtagfind.match(rawdata, i) # </ + tag + >
        if not match:
            if self.cdata_elem is not None:
                self.handle_data(rawdata[i:gtpos])
                return gtpos
            # find the name: w3.org/TR/html5/tokenization.html#tag-name-state
            namematch = tagfind_tolerant.match(rawdata, i+2)
            if not namematch:
                # w3.org/TR/html5/tokenization.html#end-tag-open-state
                if rawdata[i:i+3] == '</>':
                    return i+3
                else:
                    return self.parse_bogus_comment(i, 1)
            tagname = namematch.group(1).lower()
            # consume and ignore other stuff between the name and the >
            # Note: this is not 100% correct, since we might have things like
            # </tag attr=">">, but looking for > after the name should cover
            # most of the cases and is much simpler
            gtpos = rawdata.find('>', namematch.end())
            self.handle_endtag(tagname)
            return gtpos+1

        elem = match.group(1).lower() # script or style
        if self.cdata_elem is not None:
            if elem != self.cdata_elem:
                self.handle_data(rawdata[i:gtpos])
                return gtpos

        self.handle_endtag(elem)
        self.clear_cdata_mode()
        return gtpos

    # TRANSLATION NOTE: the following function(s) is inside a class `HTMLParser`
    # Overridable -- finish processing of start+end tag: <tag.../>
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    # Overridable -- handle start tag
    def handle_starttag(self, tag, attrs):
        pass

    # Overridable -- handle end tag
    def handle_endtag(self, tag):
        pass

    # Overridable -- handle character reference
    def handle_charref(self, name):
        pass

    # Overridable -- handle entity reference
    def handle_entityref(self, name):
        pass

    # Overridable -- handle data
    def handle_data(self, data):
        pass

    # Overridable -- handle comment
    def handle_comment(self, data):
        pass

    # Overridable -- handle declaration
    def handle_decl(self, decl):
        pass

    # Overridable -- handle processing instruction
    def handle_pi(self, data):
        pass

    def unknown_decl(self, data):
        pass


class MyHTMLParserTester(HTMLParser):
    def handle_starttag(self, tag, attrs):
        print("Encountered a start tag:", tag, attrs)
        listener_event_list.append(("starttag", tag, attrs))
    def handle_endtag(self, tag):
        print("Encountered an end tag :", tag)
        listener_event_list.append(("endtag", tag))
    def handle_data(self, data):
        print("Encountered some data  :", data)
        listener_event_list.append(("data", data))
    def handle_comment(self, data):
        print("Encountered comment    :", data)
        listener_event_list.append(("comment", data))
    def handle_entityref(self, name):
        print("entityref:", name)
        listener_event_list.append(("entityref", name))
    def handle_charref(self, name):
        print("charref  name:", name)
        listener_event_list.append(("charref", name))
    def handle_decl(self, data):
        print("decl     data:", data)
        listener_event_list.append(("decl", data))
    def handle_pi(self, data):  
        print("pi       data:", data)
        listener_event_list.append(("pi", data))
    def unknown_decl(self, data):
        print("unknown  data:", data)
        listener_event_list.append(("unknown", data))

def test():
    p = MyHTMLParserTester()
    p.feed(_example_html)
    # print("----- call functions -----")
    listener_event_list.append(("PRINT", p.getpos()))
    listener_event_list.append(("PRINT", p.get_starttag_text()))
    listener_event_list.append(("PRINT", p.parse_declaration(0)))
    p.close()

def additional_test():
    p = MyHTMLParserTester()
    p.rawdata = "<!DOCTYPE html>"
    parse_res = p.parse_declaration(0)
    assert(parse_res == 15)
    p.reset()

    p.rawdata = "<!DOCTYPE '2'>"
    parse_res = p.parse_declaration(0)
    assert(parse_res == 14)
    p.reset()

    p.rawdata = "<!DOCTYPE [<!-->]> "
    parse_res = p.parse_declaration(0)
    assert(parse_res == -1)
    p.reset()

    p.rawdata = "<!DOCTYPE [%hello]> "
    parse_res = p.parse_declaration(0)
    assert(parse_res == 19)
    p.reset()

    p.rawdata = "<!DOCTYPE [ ]> "
    parse_res = p.parse_declaration(0)
    assert(parse_res == 14)
    p.reset()
    p.close()

def additional_test2():
    p = MyHTMLParserTester()
    p.convert_charrefs = False
    p.feed("&abc<")
    # parse_res = p.parse_declaration(0)
    # assert(parse_res == -1)
    p.reset()

    p.convert_charrefs = False
    p.feed("&#abc<")
    # parse_res = p.parse_declaration(0)
    # assert(parse_res == -1)
    p.reset()

    p.convert_charrefs = False
    p.feed("&<")
    # parse_res = p.parse_declaration(0)
    # assert(parse_res == -1)
    p.reset()

    p.convert_charrefs = False
    p.feed("&#<")
    # parse_res = p.parse_declaration(0)
    # assert(parse_res == -1)
    p.reset()
    p.close()

def additional_test3():
    p = MyHTMLParserTester()
    p.handle_startendtag("tag", [])
    p.reset()
    p.handle_charref("name")
    p.reset()
    p.handle_entityref("name")
    p.reset()
    p.handle_data("data")
    p.reset()
    p.handle_comment("data")
    p.reset()
    p.handle_decl("data")
    p.reset()
    p.handle_pi("data")
    p.reset()
    p.unknown_decl("data")
    p.reset()

    p = HTMLParser()
    p.handle_startendtag("tag", [])
    p.reset()
    p.handle_charref("name")
    p.reset()
    p.handle_entityref("name")
    p.reset()
    p.handle_data("data")
    p.reset()
    p.handle_comment("data")
    p.reset()
    p.handle_decl("data")
    p.reset()
    p.handle_pi("data")
    p.reset()
    p.unknown_decl("data")
    p.reset()
    p.close()

def additional_test4():
    p = HTMLParser()
    p.rawdata = "<abc/"
    parse_res = p.check_for_whole_start_tag(0)
    assert(parse_res == -1)
    p.reset()
    p.rawdata = '<tagname attr="value'
    parse_res = p.check_for_whole_start_tag(0)
    assert(parse_res == -1)
    p.reset()
    p.rawdata = '<tagname attr'
    parse_res = p.check_for_whole_start_tag(0)
    assert(parse_res == -1)
    p.reset()
    p.rawdata = '<tagname /'
    parse_res = p.check_for_whole_start_tag(0)
    assert(parse_res == -1)
    p.reset()
    p.rawdata = '<tagname attr = "value" /'
    parse_res = p.check_for_whole_start_tag(0)
    assert(parse_res == -1)
    p.reset()
    p.rawdata = '<tagname "value" /'
    parse_res = p.check_for_whole_start_tag(0)
    assert(parse_res == -1)
    p.reset()
    p.close()

def additional_test5():
    res = escape("abc<>/'")
    assert(res == "abc&lt;&gt;/&#x27;")
    res = escape("<>")
    assert(res == "&lt;&gt;")
    res = escape("abc")
    assert(res == "abc")
    res = escape("abc&")
    assert(res == "abc&amp;")

    res = unescape("abc&lt;&gt;/&#x27;")
    assert(res == "abc<>/'")
    res = unescape("&lt;&gt;")
    assert(res == "<>")
    res = unescape("abc")
    assert(res == "abc")
    res = unescape("abc&amp;")
    assert(res == "abc&")

def additional_test6():
    p = HTMLParser()
    p.rawdata = "element>"
    p._parse_doctype_element(0, 0)
    p.reset()

    p.rawdata = "attlist element"
    p._parse_doctype_attlist(0, 0)
    p.reset()

    p.rawdata = "notation element"
    p._parse_doctype_notation(0, 0)
    p.reset()

    p.rawdata = "notation'"
    p._parse_doctype_notation(0, 0)
    p.reset()

    p.rawdata = "%element element"
    p._parse_doctype_entity(0, 0)
    p.reset()
    p.close()

def additional_tests():
    additional_test()
    additional_test2()
    additional_test3()
    additional_test4()
    additional_test5()
    additional_test6()

### Global Begin

name2codepoint = {
    'AElig':    0x00c6, # latin capital letter AE = latin capital ligature AE, U+00C6 ISOlat1
    # rest omitted
}
codepoint2name = {}
entitydefs = {}
for (name, codepoint) in name2codepoint.items():
    codepoint2name[codepoint] = name
    entitydefs[name] = chr(codepoint)
del name, codepoint

_charref_regular_exp = tool_functions._charref_regular_exp
_declname = tool_functions._declname

_declstringlit = tool_functions._declstringlit
_commentclose = tool_functions._commentclose
_markedsectionclose = tool_functions._markedsectionclose
_msmarkedsectionclose = tool_functions._msmarkedsectionclose
interesting_normal = tool_functions.interesting_normal
incomplete = tool_functions.incomplete
entityref = tool_functions.entityref
charref = tool_functions.charref
starttagopen = tool_functions.starttagopen
piclose = tool_functions.piclose
commentclose = tool_functions.commentclose
tagfind_tolerant = tool_functions.tagfind_tolerant
attrfind_tolerant = tool_functions.attrfind_tolerant
locatestarttagend_tolerant = tool_functions.locatestarttagend_tolerant
endendtag = tool_functions.endendtag
endtagfind = tool_functions.endtagfind
_example_html = tool_functions._example_html
_charref_regular_exp_match = _charref_regular_exp.match
_declname_match = _declname.match
_declstringlit_match = _declstringlit.match
_commentclose_match = _commentclose.match
_declstringlit_match = _declstringlit.match
_declname_match = _declname.match
_declstringlit_match = _declstringlit.match
_declstringlit_match = _declstringlit.match
_markedsectionclose_match = _markedsectionclose.match
_msmarkedsectionclose_match = _msmarkedsectionclose.match
interesting_normal_match = interesting_normal.match
incomplete_match = incomplete.match
entityref_match = entityref.match
charref_match = charref.match
starttagopen_match = starttagopen.match
piclose_match = piclose.match
commentclose_match = commentclose.match
tagfind_tolerant_match = tagfind_tolerant.match
attrfind_tolerant_match = attrfind_tolerant.match
locatestarttagend_tolerant_match = locatestarttagend_tolerant.match
endendtag_match = endendtag.match
endtagfind_match = endtagfind.match
CDATA_CONTENT_ELEMENTS = ["script", "style"]
SCAN_NAME_DEFAULT = [None, -1]
listener_event_list = []
test()
additional_tests()
