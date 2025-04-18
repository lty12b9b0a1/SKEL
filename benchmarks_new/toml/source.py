from datetime import tzinfo, timedelta
from collections import OrderedDict
import datetime
import re
import sys
from decimal import Decimal
import datetime
import io
from os import linesep
import re
import sys
import tracer_skip as tool_functions
import copy

class func_dict(dict):
    pass

def _detect_pathlib_path(p):
    if (3, 4) <= sys.version_info:
        import pathlib
        if isinstance(p, pathlib.PurePath):
            return True
    return False


def _ispath(p):
    if isinstance(p, (bytes, str)):
        return True
    return _detect_pathlib_path(p)


def _getpath(p):
    if (3, 6) <= sys.version_info:
        import os
        return os.fspath(p)
    if _detect_pathlib_path(p):
        return str(p)
    return p


class TomlDecodeError(ValueError):
    """Base toml Exception / Error."""

    def __init__(self, msg, doc, pos):
        lineno = doc.count('\n', 0, pos) + 1
        colno = pos - doc.rfind('\n', 0, pos)
        emsg = '{} (line {} column {} char {})'.format(msg, lineno, colno, pos)
        ValueError.__init__(self, emsg)
        self.msg = msg
        self.doc = doc
        self.pos = pos
        self.lineno = lineno
        self.colno = colno


class CommentValue(object):
    def __init__(self, val, comment, beginline, _dict):
        self.val = val
        separator = "\n" if beginline else " "
        self.comment = separator + comment
        self._dict = _dict

    def __getitem__(self, key):
        return self.val[key]

    def __setitem__(self, key, value):
        self.val[key] = value

    def dump(self, dump_value_func):
        retstr = dump_value_func(self.val)
        if isinstance(self.val, self._dict):
            return self.comment + "\n" + str(retstr)
        else:
            return str(retstr) + self.comment


def _strictly_valid_num(n):
    n = n.strip()
    if not n:
        return False
    if n[0] == '_':
        return False
    if n[-1] == '_':
        return False
    if "_." in n or "._" in n:
        return False
    if len(n) == 1:
        return True
    if n[0] == '0' and n[1] not in ['.', 'o', 'b', 'x']:
        return False
    if n[0] == '+' or n[0] == '-':
        n = n[1:]
        if len(n) > 1 and n[0] == '0' and n[1] != '.':
            return False
    if '__' in n:
        return False
    return True


def load(f, _dict=func_dict, decoder=None):
    """Parses named file or files as toml and returns a dictionary

    Args:
        f: Path to the file to open, array of files to read into single dict
           or a file descriptor
        _dict: (optional) Specifies the class of the returned toml dictionary
        decoder: The decoder to use

    Returns:
        Parsed toml file represented as a dictionary

    Raises:
        TypeError -- When f is invalid type
        TomlDecodeError: Error while decoding toml
        IOError / FileNotFoundError -- When an array with no valid (existing)
        (Python 2 / Python 3)          file paths is passed
    """

    pass # Not Reachable




def loads(s, _dict=func_dict, decoder=None):
    def handle_keyname():
        nonlocal key, openstring, openstrchar, keyname, dottedkey, prev_key
        key += item
        if item == '\n':
            raise TomlDecodeError("Key name found without value. Reached end of line.", original, i)
        if openstring:
            if item == openstrchar:
                oddbackslash = False
                k = 1
                while i >= k and sl[i - k] == '\\':
                    oddbackslash = not oddbackslash
                    k += 1
                if not oddbackslash:
                    keyname = 2
                    openstring = False
                    openstrchar = ""
            return "continue"
        elif keyname == 1:
            if item.isspace():
                keyname = 2
                return "continue"
            elif item == '.':
                dottedkey = True
                return "continue"
            elif item.isalnum() or item == '_' or item == '-':
                return "continue"
            elif (dottedkey and sl[i - 1] == '.' and
                (item == '"' or item == "'")):
                openstring = True
                openstrchar = item
                return "continue"
        elif keyname == 2:
            if item.isspace():
                if dottedkey:
                    nextitem = sl[i + 1]
                    if not nextitem.isspace() and nextitem != '.':
                        keyname = 1
                return "continue"
            if item == '.':
                dottedkey = True
                nextitem = sl[i + 1]
                if not nextitem.isspace() and nextitem != '.':
                    keyname = 1
                return "continue"
        if item == '=':
            keyname = 0
            prev_key = key[:-1].rstrip()
            key = ''
            dottedkey = False
        else:
            raise TomlDecodeError("Found invalid character in key name: '" +
                                item + "'. Try quoting the key name.",
                                original, i)
    
    def handle_single_quote_1():
        nonlocal multilinestr, openstring, openstrchar
        k = 1
        try:
            while sl[i - k] == "'":
                k += 1
                if k == 3:
                    break
        except IndexError:
            pass
        if k == 3:
            multilinestr = not multilinestr
            openstring = multilinestr
        else:
            openstring = not openstring
        if openstring:
            openstrchar = "'"
        else:
            openstrchar = ""
    
    def handle_single_quote_2():
        nonlocal multilinestr, openstring, openstrchar
        oddbackslash = False
        k = 1
        tripquote = False
        try:
            while sl[i - k] == '"':
                k += 1
                if k == 3:
                    tripquote = True
                    break
            if k == 1 or (k == 3 and tripquote):
                while sl[i - k] == '\\':
                    oddbackslash = not oddbackslash
                    k += 1
        except IndexError:
            pass
        if not oddbackslash:
            if tripquote:
                multilinestr = not multilinestr
                openstring = multilinestr
            else:
                openstring = not openstring
        if openstring:
            openstrchar = '"'
        else:
            openstrchar = ""
    
    def handle_comment():
        j = i
        comment = ""
        try:
            while sl[j] != '\n':
                comment += s[j]
                sl[j] = ' '
                j += 1
        except IndexError:
            return "break"
        if not openarr:
            decoder.preserve_comment(line_no, prev_key, comment, beginline)
    
    def handle_backslash():
        nonlocal multilinestr, keyname, openstring, key, beginline, line_no
        if item == '\n':
            if openstring or multilinestr:
                if not multilinestr:
                    raise TomlDecodeError("Unbalanced quotes", original, i)
                if ((sl[i - 1] == "'" or sl[i - 1] == '"') and (
                        sl[i - 2] == sl[i - 1])):
                    sl[i] = sl[i - 1]
                    if sl[i - 3] == sl[i - 1]:
                        sl[i - 3] = ' '
            elif openarr:
                sl[i] = ' '
            else:
                beginline = True
            line_no += 1
        elif beginline and sl[i] != ' ' and sl[i] != '\t':
            beginline = False
            if not keygroup and not arrayoftables:
                if sl[i] == '=':
                    raise TomlDecodeError("Found empty keyname. ", original, i)
                keyname = 1
                key += item
    
    def handle_bracket():
        nonlocal openarr, keygroup, arrayoftables
        if item == '[' and (not openstring and not keygroup and
                            not arrayoftables):
            if beginline:
                if len(sl) > i + 1 and sl[i + 1] == '[':
                    arrayoftables = True
                else:
                    keygroup = True
            else:
                openarr += 1
        if item == ']' and not openstring:
            if keygroup:
                keygroup = False
            elif arrayoftables:
                if sl[i - 1] == ']':
                    arrayoftables = False
            else:
                openarr -= 1
    
    def handle_remaining():
        def handle_multikey():
            nonlocal multibackslash, multilinestr, multikey
            if multibackslash:
                multilinestr += line
            else:
                multilinestr += line
            multibackslash = False
            closed = False
            if multilinestr[0] == '[':
                closed = line[-1] == ']'
            elif len(line) > 2:
                closed = (line[-1] == multilinestr[0] and
                        line[-2] == multilinestr[0] and
                        line[-3] == multilinestr[0])
            if closed:
                try:
                    value, vtype = decoder.load_value(multilinestr)
                except ValueError as err:
                    raise TomlDecodeError(str(err), original, pos)
                currentlevel[multikey] = value
                multikey = None
                multilinestr = ""
            else:
                k = len(multilinestr) - 1
                while k > -1 and multilinestr[k] == '\\':
                    multibackslash = not multibackslash
                    k -= 1
                if multibackslash:
                    multilinestr = multilinestr[:-1]
                else:
                    multilinestr += "\n"
            return "continue"
        
        def handle_start_bracket():
            def handle_groupname():
                i = 0
                while i < len(groups):
                    groups[i] = groups[i].strip()
                    if len(groups[i]) > 0 and (groups[i][0] == '"' or
                                            groups[i][0] == "'"):
                        groupstr = groups[i]
                        j = i + 1
                        while ((not groupstr[0] == groupstr[-1]) or
                            len(groupstr) == 1):
                            j += 1
                            if j > len(groups) + 2:
                                raise TomlDecodeError("Invalid group name '" +
                                                    groupstr + "' Something " +
                                                    "went wrong.", original, pos)
                            groupstr = '.'.join(groups[i:j]).strip()
                        groups[i] = groupstr[1:-1]
                        groups[i + 1:j] = []
                    else:
                        if not _groupname_re.match(groups[i]):
                            raise TomlDecodeError("Invalid group name '" +
                                                groups[i] + "'. Try quoting it.",
                                                original, pos)
                    i += 1
                
            
            nonlocal line, currentlevel, arrayoftables
            
            arrayoftables = False
            if len(line) == 1:
                raise TomlDecodeError("Opening key group bracket on line by itself.", original, pos)
            if line[1] == '[':
                arrayoftables = True
                line = line[2:]
                splitstr = ']]'
            else:
                line = line[1:]
                splitstr = ']'
            i = 1
            quotesplits = decoder._get_split_on_quotes(line)
            quoted = False
            for quotesplit in quotesplits:
                if not quoted and splitstr in quotesplit:
                    break
                i += quotesplit.count(splitstr)
                quoted = not quoted
                
            line = line.split(splitstr, i)
            if len(line) < i + 1 or line[-1].strip() != "":
                raise TomlDecodeError("Key group not on a line by itself.",
                                    original, pos)
                
            groups = splitstr.join(line[:-1]).split('.')
            handle_groupname()
            currentlevel = retval
            
            for i in range(len(groups)):
                group = groups[i]
                if group == "":
                    raise TomlDecodeError("Can't have a keygroup with an empty name", original, pos)
                try:
                    currentlevel[group]
                    if i == len(groups) - 1:
                        if group in implicitgroups:
                            implicitgroups.remove(group)
                            if arrayoftables:
                                raise TomlDecodeError("An implicitly defined table can't be an array",
                                                    original, pos)
                        elif arrayoftables:
                            currentlevel[group].append(decoder.get_empty_table()
                                                    )
                        else:
                            raise TomlDecodeError("What? " + group +
                                                " already exists?" +
                                                str(currentlevel),
                                                original, pos)
                except TypeError:
                    currentlevel = currentlevel[-1]
                    if group not in currentlevel:
                        currentlevel[group] = decoder.get_empty_table()
                        if i == len(groups) - 1 and arrayoftables:
                            currentlevel[group] = [decoder.get_empty_table()]
                except KeyError:
                    if i != len(groups) - 1:
                        implicitgroups.append(group)
                    currentlevel[group] = decoder.get_empty_table()
                    if i == len(groups) - 1 and arrayoftables:
                        currentlevel[group] = [decoder.get_empty_table()]
                currentlevel = currentlevel[group]
                if arrayoftables:
                    try:
                        currentlevel = currentlevel[-1]
                    except KeyError:
                        pass


        nonlocal currentlevel
        
        s = ''.join(sl)
        s = s.split('\n')
        multikey = None
        multilinestr = ""
        multibackslash = False
        pos = 0

        for idx, line in enumerate(s):
            if idx > 0:
                pos += len(s[idx - 1]) + 1

            decoder.embed_comments(idx, currentlevel)

            if not multilinestr or multibackslash or '\n' not in multilinestr:
                line = line.strip()
            if line == "" and (not multikey or multibackslash):
                continue
            if multikey:
                act = handle_multikey()
                if act == "continue":
                    continue
            if line[0] == '[':
                handle_start_bracket()
            elif line[0] == "{":
                if line[-1] != "}":
                    raise TomlDecodeError("Line breaks are not allowed in inline objects", original, pos)
                try:
                    decoder.load_inline_object(line, currentlevel, multikey,
                                            multibackslash)
                except ValueError as err:
                    raise TomlDecodeError(str(err), original, pos)
            elif "=" in line:
                try:
                    ret = decoder.load_line(line, currentlevel, multikey,
                                            multibackslash)
                except ValueError as err:
                    raise TomlDecodeError(str(err), original, pos)
                if ret is not None:
                    multikey, multilinestr, multibackslash = ret
        return retval
    
    
    """Parses string as toml

    Args:
        s: String to be parsed
        _dict: (optional) Specifies the class of the returned toml dictionary

    Returns:
        Parsed toml file represented as a dictionary

    Raises:
        TypeError: When a non-string is passed
        TomlDecodeError: Error while decoding toml
    """
    
    implicitgroups = []
    if decoder is None:
        decoder = TomlDecoder(_dict)
    retval = decoder.get_empty_table()
    currentlevel = retval
    if not isinstance(s, str):
        raise TypeError("Expecting something like a string")

    if not isinstance(s, str):
        s = s.decode('utf8')

    original = s
    sl = list(s)
    openarr = 0
    openstring = False
    openstrchar = ""
    multilinestr = False
    arrayoftables = False
    beginline = True
    keygroup = False
    dottedkey = False
    keyname = 0
    key = ''
    prev_key = ''
    line_no = 1

    for i, item in enumerate(sl):
        if item == '\r' and len(sl) > (i + 1) and sl[i + 1] == '\n':
            sl[i] = ' '
            continue
        if keyname:
            act = handle_keyname()
            if act == "continue":
                continue
        if item == "'" and openstrchar != '"':
            handle_single_quote_1()
        if item == '"' and openstrchar != "'":
            handle_single_quote_2()
        if item == '#' and (not openstring and not keygroup and
                            not arrayoftables):
            act = handle_comment()
            if act == "break":
                break
        
        handle_bracket()
        handle_backslash()
        
    if keyname:
        raise TomlDecodeError("Key name found without value. Reached end of file.", original, len(s))
    if openstring:  # reached EOF and have an unterminated string
        raise TomlDecodeError("Unterminated string found. Reached end of file.", original, len(s))
    
    return handle_remaining()

def _load_date(val):
    microsecond = 0
    tz = None
    try:
        if len(val) > 19:
            if val[19] == '.':
                if val[-1].upper() == 'Z':
                    subsecondval = val[20:-1]
                    tzval = "Z"
                else:
                    subsecondvalandtz = val[20:]
                    if '+' in subsecondvalandtz:
                        splitpoint = subsecondvalandtz.index('+')
                        subsecondval = subsecondvalandtz[:splitpoint]
                        tzval = subsecondvalandtz[splitpoint:]
                    elif '-' in subsecondvalandtz:
                        splitpoint = subsecondvalandtz.index('-')
                        subsecondval = subsecondvalandtz[:splitpoint]
                        tzval = subsecondvalandtz[splitpoint:]
                    else:
                        tzval = None
                        subsecondval = subsecondvalandtz
                if tzval is not None:
                    tz = TomlTz(tzval)
                microsecond = int(int(subsecondval) *
                                  (10 ** (6 - len(subsecondval))))
            else:
                tz = TomlTz(val[19:].upper())
    except ValueError:
        tz = None
    if "-" not in val[1:]:
        return None
    try:
        if len(val) == 10:
            d = datetime.date(
                int(val[:4]), int(val[5:7]),
                int(val[8:10]))
        else:
            d = datetime.datetime(
                int(val[:4]), int(val[5:7]),
                int(val[8:10]), int(val[11:13]),
                int(val[14:16]), int(val[17:19]), microsecond, tz)
    except ValueError:
        return None
    return d


def _load_unicode_escapes(v, hexbytes, prefix):
    skip = False
    i = len(v) - 1
    while i > -1 and v[i] == '\\':
        skip = not skip
        i -= 1
    for hx in hexbytes:
        if skip:
            skip = False
            i = len(hx) - 1
            while i > -1 and hx[i] == '\\':
                skip = not skip
                i -= 1
            v += prefix
            v += hx
            continue
        hxb = ""
        i = 0
        hxblen = 4
        if prefix == "\\U":
            hxblen = 8
        hxb = ''.join(hx[i:i + hxblen]).lower()
        if hxb.strip('0123456789abcdef'):
            raise ValueError("Invalid escape sequence: " + hxb)
        if hxb[0] == "d" and hxb[1].strip('01234567'):
            raise ValueError("Invalid escape sequence: " + hxb +
                             ". Only scalar unicode points are allowed.")
        v += unichr(int(hxb, 16))
        v += str(hx[len(hxb):])
    return v


def _unescape(v):
    """Unescape characters in a TOML string."""
    i = 0
    backslash = False
    while i < len(v):
        if backslash:
            backslash = False
            if v[i] in _escapes:
                v = v[:i - 1] + _escape_to_escapedchars[v[i]] + v[i + 1:]
            elif v[i] == '\\':
                v = v[:i - 1] + v[i:]
            elif v[i] == 'u' or v[i] == 'U':
                i += 1
            else:
                raise ValueError("Reserved escape sequence used")
            continue
        elif v[i] == '\\':
            backslash = True
        i += 1
    return v


class InlineTableDict(object):
    """Sentinel subclass of dict for inline tables."""

class DynamicInlineTableDict(dict): ### dynamic hierarchy is not supported
    """Concrete sentinel subclass for inline tables.
    It is a subclass of _dict which is passed in dynamically at load
    time

    It is also a subclass of InlineTableDict
    """

class TomlDecoder(object):

    def __init__(self, _dict=func_dict):
        self._dict = _dict

    def get_empty_table(self):
        return self._dict()

    def get_empty_inline_table(self):

        return DynamicInlineTableDict()

    def load_inline_object(self, line, currentlevel, multikey=False,
                           multibackslash=False):
        candidate_groups = line[1:-1].split(",")
        groups = []
        if len(candidate_groups) == 1 and not candidate_groups[0].strip():
            candidate_groups.pop()
        while len(candidate_groups) > 0:
            candidate_group = candidate_groups.pop(0)
            try:
                _, value = candidate_group.split('=', 1)
            except ValueError:
                raise ValueError("Invalid inline table encountered")
            value = value.strip()
            if ((value[0] == value[-1] and value[0] in ('"', "'")) or (
                    value[0] in '-0123456789' or
                    value in ('true', 'false') or
                    (value[0] == "[" and value[-1] == "]") or
                    (value[0] == '{' and value[-1] == '}'))):
                groups.append(candidate_group)
            elif len(candidate_groups) > 0:
                candidate_groups[0] = (candidate_group + "," +
                                       candidate_groups[0])
            else:
                raise ValueError("Invalid inline table value encountered")
        for group in groups:
            status = self.load_line(group, currentlevel, multikey,
                                    multibackslash)
            if status is not None:
                break

    def _get_split_on_quotes(self, line):
        doublequotesplits = line.split('"')
        quoted = False
        quotesplits = []
        if len(doublequotesplits) > 1 and "'" in doublequotesplits[0]:
            singlequotesplits = doublequotesplits[0].split("'")
            doublequotesplits = doublequotesplits[1:]
            while len(singlequotesplits) % 2 == 0 and len(doublequotesplits):
                singlequotesplits[-1] += '"' + doublequotesplits[0]
                doublequotesplits = doublequotesplits[1:]
                if "'" in singlequotesplits[-1]:
                    singlequotesplits = (singlequotesplits[:-1] +
                                         singlequotesplits[-1].split("'"))
            quotesplits += singlequotesplits
        for doublequotesplit in doublequotesplits:
            if quoted:
                quotesplits.append(doublequotesplit)
            else:
                quotesplits += doublequotesplit.split("'")
                quoted = not quoted
        return quotesplits

    def load_line(self, line, currentlevel, multikey, multibackslash):
        i = 1
        quotesplits = self._get_split_on_quotes(line)
        quoted = False
        for quotesplit in quotesplits:
            if not quoted and '=' in quotesplit:
                break
            i += quotesplit.count('=')
            quoted = not quoted
        pair = line.split('=', i)
        strictly_valid = _strictly_valid_num(pair[-1])
        if _number_with_underscores.match(pair[-1]):
            pair[-1] = pair[-1].replace('_', '')
        while len(pair[-1]) and (pair[-1][0] != ' ' and pair[-1][0] != '\t' and
                                 pair[-1][0] != "'" and pair[-1][0] != '"' and
                                 pair[-1][0] != '[' and pair[-1][0] != '{' and
                                 pair[-1].strip() != 'true' and
                                 pair[-1].strip() != 'false'):
            try:
                float(pair[-1])
                break
            except ValueError:
                pass
            if _load_date(pair[-1]) is not None:
                break
            if TIME_RE.match(pair[-1]):
                break
            i += 1
            prev_val = pair[-1]
            pair = line.split('=', i)
            if prev_val == pair[-1]:
                raise ValueError("Invalid date or number")
            if strictly_valid:
                strictly_valid = _strictly_valid_num(pair[-1])
        pair = ['='.join(pair[:-1]).strip(), pair[-1].strip()]
        if '.' in pair[0]:
            if '"' in pair[0] or "'" in pair[0]:
                quotesplits = self._get_split_on_quotes(pair[0])
                quoted = False
                levels = []
                for quotesplit in quotesplits:
                    if quoted:
                        levels.append(quotesplit)
                    else:
                        levels += [level.strip() for level in
                                   quotesplit.split('.')]
                    quoted = not quoted
            else:
                levels = pair[0].split('.')
            while levels[-1] == "":
                levels = levels[:-1]
            for level in levels[:-1]:
                if level == "":
                    continue
                if level not in currentlevel:
                    currentlevel[level] = self.get_empty_table()
                currentlevel = currentlevel[level]
            pair[0] = levels[-1].strip()
        elif (pair[0][0] == '"' or pair[0][0] == "'") and \
                (pair[0][-1] == pair[0][0]):
            pair[0] = _unescape(pair[0][1:-1])
        k, koffset = self._load_line_multiline_str(pair[1])
        if k > -1:
            while k > -1 and pair[1][k + koffset] == '\\':
                multibackslash = not multibackslash
                k -= 1
            if multibackslash:
                multilinestr = pair[1][:-1]
            else:
                multilinestr = pair[1] + "\n"
            multikey = pair[0]
        else:
            value, vtype = self.load_value(pair[1], strictly_valid)
        try:
            currentlevel[pair[0]]
            raise ValueError("Duplicate keys!")
        except TypeError:
            raise ValueError("Duplicate keys!")
        except KeyError:
            if multikey:
                return multikey, multilinestr, multibackslash
            else:
                currentlevel[pair[0]] = value

    def _load_line_multiline_str(self, p):
        poffset = 0
        if len(p) < 3:
            return -1, poffset
        if p[0] == '[' and (p.strip()[-1] != ']' and
                            self._load_array_isstrarray(p)):
            newp = p[1:].strip().split(',')
            while len(newp) > 1 and newp[-1][0] != '"' and newp[-1][0] != "'":
                newp = newp[:-2] + [newp[-2] + ',' + newp[-1]]
            newp = newp[-1]
            poffset = len(p) - len(newp)
            p = newp
        if p[0] != '"' and p[0] != "'":
            return -1, poffset
        if p[1] != p[0] or p[2] != p[0]:
            return -1, poffset
        if len(p) > 5 and p[-1] == p[0] and p[-2] == p[0] and p[-3] == p[0]:
            return -1, poffset
        return len(p) - 1, poffset

    def load_value(self, v, strictly_valid=True):
        def handle_remaining():
            nonlocal v
            if parsed_date is not None:
                return (parsed_date, "date")
            if not strictly_valid:
                raise ValueError("Weirdness with leading zeroes or "
                                "underscores in your number.")
            itype = "int"
            neg = False
            if v[0] == '-':
                neg = True
                v = v[1:]
            elif v[0] == '+':
                v = v[1:]
            v = v.replace('_', '')
            lowerv = v.lower()
            if '.' in v or ('x' not in v and ('e' in v or 'E' in v)):
                if '.' in v and v.split('.', 1)[1] == '':
                    raise ValueError("This float is missing digits after "
                                    "the point")
                if v[0] not in '0123456789':
                    raise ValueError("This float doesn't have a leading "
                                    "digit")
                v = float(v)
                itype = "float"
            elif len(lowerv) == 3 and (lowerv == 'inf' or lowerv == 'nan'):
                v = float(v)
                itype = "float"
            if itype == "int":
                v = int(v, 0)
            if neg:
                return (0 - v, itype)
            return (v, itype)
        
        if not v:
            raise ValueError("Empty value is invalid")
        if v == 'true':
            return (True, "bool")
        elif v.lower() == 'true':
            raise ValueError("Only all lowercase booleans allowed")
        elif v == 'false':
            return (False, "bool")
        elif v.lower() == 'false':
            raise ValueError("Only all lowercase booleans allowed")
        elif v[0] == '"' or v[0] == "'":
            quotechar = v[0]
            testv = v[1:].split(quotechar)
            triplequote = False
            triplequotecount = 0
            if len(testv) > 1 and testv[0] == '' and testv[1] == '':
                testv = testv[2:]
                triplequote = True
            closed = False
            for tv in testv:
                if tv == '':
                    if triplequote:
                        triplequotecount += 1
                    else:
                        closed = True
                else:
                    oddbackslash = False
                    try:
                        i = -1
                        j = tv[i]
                        while j == '\\':
                            oddbackslash = not oddbackslash
                            i -= 1
                            j = tv[i]
                    except IndexError:
                        pass
                    if not oddbackslash:
                        if closed:
                            raise ValueError("Found tokens after a closed " +
                                            "string. Invalid TOML.")
                        else:
                            if not triplequote or triplequotecount > 1:
                                closed = True
                            else:
                                triplequotecount = 0
            if quotechar == '"':
                escapeseqs = v.split('\\')[1:]
                backslash = False
                for i in escapeseqs:
                    if i == '':
                        backslash = not backslash
                    else:
                        if i[0] not in _escapes and (i[0] != 'u' and
                                                    i[0] != 'U' and
                                                    not backslash):
                            raise ValueError("Reserved escape sequence used")
                        if backslash:
                            backslash = False
                for prefix in ["\\u", "\\U"]:
                    if prefix in v:
                        hexbytes = v.split(prefix)
                        v = _load_unicode_escapes(hexbytes[0], hexbytes[1:],
                                                prefix)
                v = _unescape(v)
            if len(v) > 1 and v[1] == quotechar and (len(v) < 3 or
                                                    v[1] == v[2]):
                v = v[2:-2]
            return (v[1:-1], "str")

        elif v[0] == '[':
            return (self.load_array(v), "array")
        elif v[0] == '{':
            inline_object = self.get_empty_inline_table()
            self.load_inline_object(v, inline_object)
            return (inline_object, "inline_object")
        elif TIME_RE.match(v):
            h, m, s, _, ms = TIME_RE.match(v).groups()
            time = datetime.time(int(h), int(m), int(s), int(ms) if ms else 0)
            return (time, "time")
        else:
            parsed_date = _load_date(v)
            return handle_remaining()
    
    def bounded_string(self, s):
        if len(s) == 0:
            return True
        if s[-1] != s[0]:
            return False
        i = -2
        backslash = False
        while len(s) + i > 0:
            if s[i] == "\\":
                backslash = not backslash
                i -= 1
            else:
                break
        return not backslash

    def _load_array_isstrarray(self, a):
        a = a[1:-1].strip()
        if a != '' and (a[0] == '"' or a[0] == "'"):
            return True
        return False

    def load_array(self, a):
        retval = []
        a = a.strip()
        if '[' not in a[1:-1] or "" != a[1:-1].split('[')[0].strip():
            strarray = self._load_array_isstrarray(a)
            if not a[1:-1].strip().startswith('{'):
                a = a[1:-1].split(',')
            else:
                # a is an inline object, we must find the matching parenthesis
                # to define groups
                new_a = []
                start_group_index = 1
                end_group_index = 2
                open_bracket_count = 1 if a[start_group_index] == '{' else 0
                in_str = False
                while end_group_index < len(a[1:]):
                    if a[end_group_index] == '"' or a[end_group_index] == "'":
                        if in_str:
                            backslash_index = end_group_index - 1
                            while (backslash_index > -1 and
                                   a[backslash_index] == '\\'):
                                in_str = not in_str
                                backslash_index -= 1
                        in_str = not in_str
                    if not in_str and a[end_group_index] == '{':
                        open_bracket_count += 1
                    if in_str or a[end_group_index] != '}':
                        end_group_index += 1
                        continue
                    elif a[end_group_index] == '}' and open_bracket_count > 1:
                        open_bracket_count -= 1
                        end_group_index += 1
                        continue

                    # Increase end_group_index by 1 to get the closing bracket
                    end_group_index += 1

                    new_a.append(a[start_group_index:end_group_index])

                    # The next start index is at least after the closing
                    # bracket, a closing bracket can be followed by a comma
                    # since we are in an array.
                    start_group_index = end_group_index + 1
                    while (start_group_index < len(a[1:]) and
                           a[start_group_index] != '{'):
                        start_group_index += 1
                    end_group_index = start_group_index + 1
                a = new_a
            b = 0
            if strarray:
                while b < len(a) - 1:
                    ab = a[b].strip()
                    while (not self.bounded_string(ab) or
                           (len(ab) > 2 and
                            ab[0] == ab[1] == ab[2] and
                            ab[-2] != ab[0] and
                            ab[-3] != ab[0])):
                        a[b] = a[b] + ',' + a[b + 1]
                        ab = a[b].strip()
                        if b < len(a) - 2:
                            a = a[:b + 1] + a[b + 2:]
                        else:
                            a = a[:b + 1]
                    b += 1
        else:
            al = list(a[1:-1])
            a = []
            openarr = 0
            j = 0
            for i in range(len(al)):
                if al[i] == '[':
                    openarr += 1
                elif al[i] == ']':
                    openarr -= 1
                elif al[i] == ',' and not openarr:
                    a.append(''.join(al[j:i]))
                    j = i + 1
            a.append(''.join(al[j:]))
        for i in range(len(a)):
            a[i] = a[i].strip()
            if a[i] != '':
                nval, ntype = self.load_value(a[i])
                retval.append(nval)
        return retval

    def preserve_comment(self, line_no, key, comment, beginline):
        pass

    def embed_comments(self, idx, currentlevel):
        pass


class TomlPreserveCommentDecoder(TomlDecoder):

    def __init__(self, _dict=func_dict):
        self.saved_comments = {}
        super(TomlPreserveCommentDecoder, self).__init__(_dict)

    def preserve_comment(self, line_no, key, comment, beginline):
        self.saved_comments[line_no] = (key, comment, beginline)

    def embed_comments(self, idx, currentlevel):
        if idx not in self.saved_comments:
            return

        key, comment, beginline = self.saved_comments[idx]
        currentlevel[key] = CommentValue(currentlevel[key], comment, beginline,
                                         self._dict)



def dump(o, f, encoder=None):
    """Writes out dict as toml to a file

    Args:
        o: Object to dump into toml
        f: File descriptor where the toml should be stored
        encoder: The ``TomlEncoder`` to use for constructing the output string

    Returns:
        String containing the toml corresponding to dictionary

    Raises:
        TypeError: When anything other than file descriptor is passed
    """

    if not f.write:
        raise TypeError("You can only dump an object to a file descriptor")
    d = dumps(o, encoder=encoder)
    f.write(d)
    return d


def dumps(o, encoder=None):
    """Stringifies input dict as toml

    Args:
        o: Object to dump into toml
        encoder: The ``TomlEncoder`` to use for constructing the output string

    Returns:
        String containing the toml corresponding to dict

    Examples:
        ```python
        >>> import toml
        >>> output = {
        ... 'a': "I'm a string",
        ... 'b': ["I'm", "a", "list"],
        ... 'c': 2400
        ... }
        >>> toml.dumps(output)
        'a = "I\'m a string"\nb = [ "I\'m", "a", "list",]\nc = 2400\n'
        ```
    """

    retval = ""
    if encoder is None:
        encoder = TomlEncoder(o.__class__)
    addtoretval, sections = encoder.dump_sections(o, "")
    retval += addtoretval
    while sections:
        newsections = encoder.get_empty_table()
        for section in sections:
            addtoretval, addtosections = encoder.dump_sections(
                sections[section], section)

            if addtoretval or (not addtoretval and not addtosections):
                if retval and retval[-2:] != "\n\n":
                    retval += "\n"
                retval += "[" + section + "]\n"
                if addtoretval:
                    retval += addtoretval
            for s in addtosections:
                newsections[section + "." + s] = addtosections[s]
        sections = newsections
    return retval


def _dump_str(v):

    v = "%r" % v
    if v[0] == 'u':
        v = v[1:]
    singlequote = v.startswith("'")
    if singlequote or v.startswith('"'):
        v = v[1:-1]
    if singlequote:
        v = v.replace("\\'", "'")
        v = v.replace('"', '\\"')
    v = v.split("\\x")
    while len(v) > 1:
        i = -1
        if not v[0]:
            v = v[1:]
        v[0] = v[0].replace("\\\\", "\\")
        # No, I don't know why != works and == breaks
        joinx = v[0][i] != "\\"
        while v[0][:i] and v[0][i] == "\\":
            joinx = not joinx
            i -= 1
        if joinx:
            joiner = "x"
        else:
            joiner = "u00"
        v = [v[0] + joiner + v[1]] + v[2:]
    return str('"' + v[0] + '"')


def _dump_float(v):
    return "{}".format(v).replace("e+0", "e+").replace("e-0", "e-")


def _dump_time(v):
    utcoffset = v.utcoffset()
    if utcoffset is None:
        return v.isoformat()
    # The TOML norm specifies that it's local time thus we drop the offset
    return v.isoformat()[:-6]

def _dump_bool(v):
    return str(v).lower()

def _dump_int(v):
    return v

def _dump_datetime(v):
    return v.isoformat().replace('+00:00', 'Z')

def _dump_date(v):
    return v.isoformat()

class TomlEncoder(object):

    def __init__(self, _dict=func_dict, preserve=False):
        self._dict = _dict
        self.preserve = preserve
        self.dump_funcs = {
            "str": _dump_str,
            "list": self.dump_list,
            "bool": _dump_bool,
            "int": _dump_int,
            "float": _dump_float,
        }

    def get_empty_table(self):
        return self._dict()

    def dump_list(self, v):
        retval = "["
        for u in v:
            retval += " " + str(self.dump_value(u)) + ","
        retval += "]"
        return retval

    def dump_inline_table(self, section):
        """Preserve inline table in its compact syntax instead of expanding
        into subsection.

        https://github.com/toml-lang/toml#user-content-inline-table
        """
        retval = ""
        if isinstance(section, dict):
            val_list = []
            for k, v in section.items():
                val = self.dump_inline_table(v)
                val_list.append(k + " = " + val)
            retval += "{ " + ", ".join(val_list) + " }\n"
            return retval
        else:
            return str(self.dump_value(section))

    def dump_value(self, v):
        # Lookup function corresponding to v's type
        dump_fn = None
        for t in self.dump_funcs:
            if (t == "str" and isinstance(v, str) or
                t == "list" and isinstance(v, list) or
                t == "bool" and isinstance(v, bool) or
                t == "int" and isinstance(v, int) or
                t == "float" and isinstance(v, float) or
                t == "CommentValue" and isinstance(v, CommentValue)):
                dump_fn = self.dump_funcs[t]
                break

        if dump_fn is None and hasattr(v, '__iter__'):
            dump_fn = self.dump_funcs["list"]
        # Evaluate function (if it exists) else return v
        return dump_fn(v) if dump_fn is not None else self.dump_funcs["str"](v)

    def dump_sections(self, o, sup):
        retstr = ""
        if sup != "" and sup[-1] != ".":
            sup += '.'
        retdict = self._dict()
        arraystr = ""
        for section in o:
            section = str(section)
            qsection = section
            if not re.match(r'^[A-Za-z0-9_-]+$', section):
                qsection = _dump_str(section)
            if not isinstance(o[section], dict):
                arrayoftables = False
                if isinstance(o[section], list):
                    for a in o[section]:
                        if isinstance(a, dict):
                            arrayoftables = True
                if arrayoftables:
                    for a in o[section]:
                        arraytabstr = "\n"
                        arraystr += "[[" + sup + qsection + "]]\n"
                        s, d = self.dump_sections(a, sup + qsection)
                        if s:
                            if s[0] == "[":
                                arraytabstr += s
                            else:
                                arraystr += s
                        while d:
                            newd = self._dict()
                            for dsec in d:
                                s1, d1 = self.dump_sections(d[dsec], sup +
                                                            qsection + "." +
                                                            dsec)
                                if s1:
                                    arraytabstr += ("[" + sup + qsection +
                                                    "." + dsec + "]\n")
                                    arraytabstr += s1
                                for s1 in d1:
                                    newd[dsec + "." + s1] = d1[s1]
                            d = newd
                        arraystr += arraytabstr
                else:
                    if o[section] is not None:
                        retstr += (qsection + " = " +
                                   str(self.dump_value(o[section])) + '\n')
            elif self.preserve and isinstance(o[section], InlineTableDict):
                retstr += (qsection + " = " +
                           self.dump_inline_table(o[section]))
            else:
                retdict[qsection] = o[section]
        retstr += arraystr
        return (retstr, retdict)


class TomlPreserveInlineDictEncoder(TomlEncoder):

    def __init__(self, _dict=func_dict):
        super(TomlPreserveInlineDictEncoder, self).__init__(_dict, True)


class TomlArraySeparatorEncoder(TomlEncoder):

    def __init__(self, _dict=func_dict, preserve=False, separator=","):
        super(TomlArraySeparatorEncoder, self).__init__(_dict, preserve)
        if separator.strip() == "":
            separator = "," + separator
        elif separator.strip(' \t\n\r,'):
            raise ValueError("Invalid separator for arrays")
        self.separator = separator

    def dump_list(self, v):
        t = []
        retval = "["
        for u in v:
            t.append(self.dump_value(u))
        while t != []:
            s = []
            for u in t:
                if isinstance(u, list):
                    for r in u:
                        s.append(r)
                else:
                    retval += " " + str(u) + self.separator
            t = s
        retval += "]"
        return retval


class TomlNumpyEncoder(TomlEncoder):

    def __init__(self, _dict=func_dict, preserve=False):
        import numpy as np
        super(TomlNumpyEncoder, self).__init__(_dict, preserve)
        self.dump_funcs[np.float16] = _dump_float
        self.dump_funcs[np.float32] = _dump_float
        self.dump_funcs[np.float64] = _dump_float
        self.dump_funcs[np.int16] = self._dump_int
        self.dump_funcs[np.int32] = self._dump_int
        self.dump_funcs[np.int64] = self._dump_int

    def _dump_int(self, v):
        return "{}".format(int(v))


class TomlPreserveCommentEncoder(TomlEncoder):

    def __init__(self, _dict=func_dict, preserve=False):
        super(TomlPreserveCommentEncoder, self).__init__(_dict, preserve)
        self.dump_funcs["CommentValue"] = lambda v: v.dump(self.dump_value)


class TomlPathlibEncoder(TomlEncoder):

    def _dump_pathlib_path(self, v):
        return _dump_str(str(v))

    def dump_value(self, v):
        if (3, 4) <= sys.version_info:
            import pathlib
            if isinstance(v, pathlib.PurePath):
                v = str(v)
        return TomlEncoder(TomlPathlibEncoder, self).dump_value(v)

class TomlOrderedDecoder(TomlDecoder):

    def __init__(self):
        super(self.__class__, self).__init__(_dict=OrderedDict)


class TomlOrderedEncoder(TomlEncoder):

    def __init__(self):
        super(self.__class__, self).__init__(_dict=OrderedDict)

class TomlTz(tzinfo):
    def __init__(self, toml_offset):
        if toml_offset == "Z":
            self._raw_offset = "+00:00"
        else:
            self._raw_offset = toml_offset
        self._sign = -1 if self._raw_offset[0] == '-' else 1
        self._hours = int(self._raw_offset[1:3])
        self._minutes = int(self._raw_offset[4:6])

    def __getinitargs__(self):
        return (self._raw_offset,)

    def __deepcopy__(self, memo):
        return self.__class__(self._raw_offset)

    def tzname(self, dt):
        return "UTC" + self._raw_offset

    def utcoffset(self, dt):
        return self._sign * timedelta(hours=self._hours, minutes=self._minutes)

    def dst(self, dt):
        return timedelta(0)

def convert(v):
    if isinstance(v, list):
        return [convert(vv) for vv in v]
    elif v.get('type', None) is None or v.get('value', None) is None:
        return {k: convert(vv) for (k, vv) in v.items()}
    elif v['type'] == 'string':
        return v['value']
    elif v['type'] == 'integer':
        return int(v['value'])
    elif v['type'] == 'float':
        return float(v['value'])
    elif v['type'] == 'bool':
        return True if v['value'] == 'true' else False
    elif v['type'] in ['datetime', 'datetime-local', 'date-local', 'time-local']:
        return loads('a=' + v['value'])['a']
    else:
        raise Exception(f'unknown type: {v}')


def tag(value):
    if isinstance(value, dict):
        return {k: tag(v) for (k, v) in value.items()}
    elif isinstance(value, list):
        return [tag(v) for v in value]
    elif isinstance(value, str):
        return {'type': 'string', 'value': value}
    elif isinstance(value, bool):
        return {'type': 'bool', 'value': str(value).lower()}
    elif isinstance(value, int):
        return {'type': 'integer', 'value': str(value)}
    elif isinstance(value, float):
        return {'type': 'float', 'value': repr(value)}
    elif isinstance(value, datetime.datetime):
        return {
            'type': 'datetime-local' if value.tzinfo is None else 'datetime',
            'value': value.isoformat().replace('+00:00', 'Z'),
        }
    elif isinstance(value, datetime.date):
        return {'type': 'date-local', 'value': value.isoformat()}
    elif isinstance(value, datetime.time):
        return {'type': 'time-local', 'value': value.strftime('%H:%M:%S.%f')}
    assert False, 'Unknown type: %s' % type(value)


def tester(name):
    decode_input = tool_functions.get_input(name)
    decode_result = loads(decode_input)
    decode_result = tag(decode_result)
    # print(decode_result)

    encode_input = {k: convert(v) for (k, v) in decode_result.items()}
    encode_result = dumps(encode_input)
    # print(encode_result)

def test_bug_148():
    assert 'a = "\\u0064"\n' == dumps({'a': '\\x64'})
    assert 'a = "\\\\x64"\n' == dumps({'a': '\\\\x64'})
    assert 'a = "\\\\\\u0064"\n' == dumps({'a': '\\\\\\x64'})

def test__dict():
    assert isinstance(loads(
        TEST_STR, _dict=func_dict), dict)

def test_dict_decoder():
    _test_dict_decoder = TomlDecoder(func_dict)
    assert isinstance(loads(
        TEST_STR, decoder=_test_dict_decoder), dict)

def test_array_sep():
    encoder = TomlArraySeparatorEncoder(separator=",\t")
    d = {"a": [1, 2, 3]}
    tmp = dumps(d, encoder=encoder)
    o = loads(tmp)
    tmp2 = dumps(o, encoder=encoder)
    assert o == loads(tmp2)

def test_tuple():
    d = {"a": (3, 4)}
    encoder = TomlEncoder(func_dict)
    tmp = dumps(d, encoder)
    o = loads(tmp)
    tmp2 = dumps(o, encoder)
    assert o == loads(tmp2)


def test_commutativity():
    encoder = TomlEncoder(func_dict)
    tmp = dumps(TEST_DICT, encoder)
    o = loads(tmp)
    tmp2 = dumps(o, encoder)
    assert o == loads(tmp2)


def test_comment_preserve_decoder_encoder():
    tmp = loads(tool_functions.test_str, decoder=TomlPreserveCommentDecoder())
    s = dumps(tmp, encoder=TomlPreserveCommentEncoder())
    assert len(s) == len(tool_functions.test_str) and sorted(tool_functions.test_str) == sorted(s)


def test():
    tester("Comment")
    tester("Boolean")
    tester("Integer")
    tester("Float")
    tester("Table")
    tester("Inline Table")
    tester("String")
    tester("Array")
    tester("Array of Tables")
    test_bug_148()
    test__dict()
    test_dict_decoder()
    test_array_sep()
    test_tuple()
    test_commutativity()
    test_comment_preserve_decoder_encoder()
    additional_test()
    additional_test2()
    additional_test3()
    additional_test4()
    additional_test5()

def unichr(s):
    return chr(s)

def additional_test():
    decoder = TomlDecoder(func_dict)
    cur = {}
    multikey = False
    multibackslash = False
    decoder.load_line("'a.x'=2=3", cur, multikey, multibackslash)
    assert(cur == {'a.x': {'=2': 3}})

def additional_test2():
    decoder = TomlDecoder(func_dict)
    input_str = "[{'x' = 1}]"
    res = decoder.load_array(input_str
                    )
    assert(res == [{'x': 1}])
    input_str = "[{'x' = 1}, {'y' = 2}]"
    res = decoder.load_array(input_str
                    )
    assert(res == [{'x': 1}, {'y': 2}])

def additional_test3():
    v = "abc\\"
    hexbytes = ['0064']
    prefix = 'u'
    res = _load_unicode_escapes(v, hexbytes, prefix)
    assert(res == 'abc\\u0064')

def additional_test4():
    v = "\\\\"
    res = _unescape(v)
    assert(res == '\\')
    v = "\\u"
    res = _unescape(v)
    assert(res == '\\u')

def additional_test5():
    s = """['"test"']"""
    t = loads(s)
    assert(t == {'"test"': {}})
    s = """["abc"]"""
    t = loads(s)
    assert(t == {'abc': {}})

### Preprocessing:
# We remove several tests due to the following reasons:
# 1. The lack of corresponding libraries in JS: "pathlib", "tzinfo"
# 2. Currently unsupported datatypes: "ordereddict", "decimal", "numpy"
# 3. Nondeterministic code or reflective code: `id()`, `time.now()`
# 4. Dynamic hierachy, or hierachy from built-in class
# These tests are not related to the main functionality of the program.

### Global Begin

TIME_RE = re.compile(r"([0-9]{2}):([0-9]{2}):([0-9]{2})(\.([0-9]{3,6}))?")
# Matches a TOML number, which allows underscores for readability
_number_with_underscores = re.compile('([0-9])(_([0-9]))*')

_groupname_re = re.compile(r'^[A-Za-z0-9_-]+$')

# Unescape TOML string values.

# content after the \
_escapes = ['0', 'b', 'f', 'n', 'r', 't', '"']
# What it should be replaced by
_escapedchars = ['\0', '\b', '\f', '\n', '\r', '\t', '\"']
# Used for substitution
_escape_to_escapedchars = dict(zip(_escapes, _escapedchars))

TEST_STR = """
[a]\r
b = 1\r
c = 2
"""

TEST_DICT = {"a": {"b": 1, "c": 2}}


test()
