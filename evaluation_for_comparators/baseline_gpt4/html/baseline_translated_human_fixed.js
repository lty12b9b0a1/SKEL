var {_example_html, _invalid_charrefs, _invalid_codepoints, _charref_regular_exp, _declname, _declstringlit, _commentclose, _markedsectionclose, _msmarkedsectionclose, interesting_normal, incomplete, entityref, charref, starttagopen, piclose, commentclose, tagfind_tolerant, attrfind_tolerant, locatestarttagend_tolerant, endendtag, endtagfind, _html5} = require('./tracer_skip.js');
var tool_functions = {"_example_html":_example_html, "_invalid_charrefs":_invalid_charrefs, "_invalid_codepoints":_invalid_codepoints, "_charref_regular_exp":_charref_regular_exp, "_declname":_declname, "_declstringlit":_declstringlit, "_commentclose":_commentclose, "_markedsectionclose":_markedsectionclose, "_msmarkedsectionclose":_msmarkedsectionclose, "interesting_normal":interesting_normal, "incomplete":incomplete, "entityref":entityref, "charref":charref, "starttagopen":starttagopen, "piclose":piclose, "commentclose":commentclose, "tagfind_tolerant":tagfind_tolerant, "attrfind_tolerant":attrfind_tolerant, "locatestarttagend_tolerant":locatestarttagend_tolerant, "endendtag":endendtag, "endtagfind":endtagfind, "_html5":_html5};

function escape(s, quote = true) {
    /**
    * Replace special characters "&", "<" and ">" to HTML-safe sequences.
    * If the optional flag quote is true (the default), the quotation mark
    * characters, both double quote (") and single quote (') characters are also
    * translated.
    */
    s = s.replace(/&/g, "&amp;"); // Must be done first!
    s = s.replace(/</g, "&lt;");
    s = s.replace(/>/g, "&gt;");
    if (quote) {
        s = s.replace(/"/g, "&quot;");
        s = s.replace(/'/g, "&#x27;");
    }
    return s;
}
function _replace_charref(s) {
    if (s[0] === '#') {
        // numeric charref
        var num;
        if (s[1] === 'x' || s[1] === 'X') {
            num = parseInt(s.slice(2).replace(';', ''), 16);
        } else {
            num = parseInt(s.slice(1).replace(';', ''));
        }
        if (('contains' in tool_functions._invalid_charrefs && tool_functions._invalid_charrefs.contains(num)) || (!('contains' in tool_functions._invalid_charrefs) && num in tool_functions._invalid_charrefs)) {
            return tool_functions._invalid_charrefs[num];
        }
        if (0xD800 <= num && num <= 0xDFFF || num > 0x10FFFF) {
            return '\uFFFD';
        }
        if (('contains' in tool_functions._invalid_codepoints && tool_functions._invalid_codepoints.contains(num)) || (!('contains' in tool_functions._invalid_codepoints) && num in tool_functions._invalid_codepoints)) {
            return '';
        }
        return String.fromCharCode(num);
    } else {
        // named charref
        if (('contains' in tool_functions._html5 && tool_functions._html5.contains(s)) || (!('contains' in tool_functions._html5) && s in tool_functions._html5)) {
            return tool_functions._html5[s];
        }
        // find the longest matching name (as defined by the standard)
        for (var x = s.length - 1; x > 1; x--) {
            if (('contains' in tool_functions._html5 && tool_functions._html5.contains(s.substring(0, x))) || (!('contains' in tool_functions._html5) && s.substring(0, x) in tool_functions._html5)) {
                return tool_functions._html5[s.substring(0, x)] + s.substring(x);
            }
        }
        return '&' + s;
    }
}
function unescape(s) {
    if (!s.includes('&')) {
        return s;
    }
    var start = 0;
    while (true) {
        var match = _charref_regular_exp.exec(s);
        if (!match) {
            break;
        }
        var replacement = _replace_charref(match[1]);
        s = s.substring(0, match.index) + replacement + s.substring(match.index + match[0].length);
        start = match.index + replacement.length;
        _charref_regular_exp.lastIndex = start;
    }
    return s;
}
class ParserBase {
    constructor() {
        // if (new.target === ParserBase) {
        //     throw new Error("ParserBase must be subclassed");
        // }
    }

    reset() {
        this.lineno = 1;
        this.offset = 0;
    }

    getpos() {
        return [this.lineno, this.offset];
    }

    updatepos(i, j) {
        if (i >= j) {
            return j;
        }
        let rawdata = this.rawdata;
        let nlines = (rawdata.substring(i, j).match(/\n/g) || []).length;
        if (nlines) {
            this.lineno += nlines;
            let pos = rawdata.lastIndexOf("\n", j - 1);
            this.offset = j - (pos + 1);
        } else {
            this.offset += j - i;
        }
        return j;
    }

    parse_declaration(i) {
        var rawdata = this.rawdata;
        var j = i + 2;
        if (rawdata.substring(i, j) !== "<!") {
            throw new Error("unexpected call to parse_declaration");
        }
        if (rawdata.substring(j, j + 1) === ">") {
            // the empty comment <!>
            return j + 1;
        }
        if (["-", ""].includes(rawdata.substring(j, j + 1))) {
            // Start of comment followed by buffer boundary,
            // or just a buffer boundary.
            return -1;
        }
        // A simple, practical version could look like: ((name|stringlit) S*) + '>'
        var n = rawdata.length;
        if (rawdata.substring(j, j + 2) === '--') { //comment
            // Locate --.*-- as the body of the comment
            return this.parse_comment(i, 1);
        } else if (rawdata[j] === '[') { //marked section
            // Locate [statusWord [...arbitrary SGML...]] as the body of the marked section
            // Where statusWord is one of TEMP, CDATA, IGNORE, INCLUDE, RCDATA
            // Note that this is extended by Microsoft Office "Save as Web" function
            // to include [if...] and [endif].
            return this.parse_marked_section(i, 1);
        } else { //all other declaration elements
            var decltype_j = this._scan_name(j, i);
            var decltype = decltype_j[0];
            j = decltype_j[1];
        }
        if (j < 0) {
            return j;
        }
        if (decltype === "doctype") {
            this._decl_otherchars = '';
        }
        while (j < n) {
            var c = rawdata[j];
            if (c === ">") {
                // end of declaration syntax
                var data = rawdata.substring(i + 2, j);
                if (decltype === "doctype") {
                    this.handle_decl(data);
                } else {
                    // According to the HTML5 specs sections "8.2.4.44 Bogus
                    // comment state" and "8.2.4.45 Markup declaration open
                    // state", a comment token should be emitted.
                    // Calling unknown_decl provides more flexibility though.
                    this.unknown_decl(data);
                }
                return j + 1;
            }
            if (c === "\"" || c === "'") {
                var m = _declstringlit.match(rawdata, j);
                if (!m) {
                    return -1; // incomplete
                }
                j = m.end();
            } else if ("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(c)) {
                var name_j = this._scan_name(j, i);
                name = name_j[0];
                j = name_j[1];
            } else if (this._decl_otherchars.includes(c)) {
                j = j + 1;
            } else if (c === "[") {
                // this could be handled in a separate doctype parser
                if (decltype === "doctype") {
                    j = this._parse_doctype_subset(j + 1, i);
                } else if (["attlist", "linktype", "link", "element"].includes(decltype)) {
                    // must tolerate []'d groups in a content model in an element declaration
                    // also in data attribute specifications of attlist declaration
                    // also link type declaration subsets in linktype declarations
                    // also link attribute specification lists in link declarations
                    throw new Error("unsupported '[' char in " + decltype + " declaration");
                } else {
                    throw new Error("unexpected '[' char in declaration");
                }
            } else {
                throw new Error("unexpected " + rawdata[j] + " char in declaration");
            }
            if (j < 0) {
                return j;
            }
        }
        return -1; // incomplete    
    }

    parse_marked_section(i, report) {
        var rawdata = this.rawdata;
        if (rawdata.substring(i, i + 3) !== '<![') {
            throw new Error("unexpected call to parse_marked_section()");
        }
        var sectName_j = this._scan_name(i + 3, i);
        var sectName = sectName_j[0];
        var j = sectName_j[1];
        if (j < 0) {
            return j;
        }
        var standardSections = new Set(["temp", "cdata", "ignore", "include", "rcdata"]);
        var msOfficeSections = new Set(["if", "else", "endif"]);
        var match;
        if (standardSections.has(sectName)) {
            // look for standard ]]> ending
            match = _markedsectionclose.exec(rawdata.substring(i + 3));
        } else if (msOfficeSections.has(sectName)) {
            // look for MS Office ]> ending
            match = _msmarkedsectionclose.exec(rawdata.substring(i + 3));
        } else {
            throw new Error('unknown status keyword ' + rawdata.substring(i + 3, j) + ' in marked section');
        }
        if (!match) {
            return -1;
        }
        if (report) {
            j = match.index + i + 3;
            this.unknown_decl(rawdata.substring(i + 3, j));
        }
        return match.index + match[0].length + i + 3;        
    }

    parse_comment(i, report = 1) {
        let rawdata = this.rawdata;
        if (rawdata.substring(i, i + 4) !== '<!--') {
            throw new Error('unexpected call to parse_comment()');
        }
        let match = _commentclose.exec(rawdata.substring(i + 4));
        if (!match) {
            return -1;
        }
        if (report) {
            var j = match.index;
            this.handle_comment(rawdata.substring(i + 4, i + 4 + j));
        }
        return i + 4 + match.index + match[0].length; 
    }

    _parse_doctype_subset(i, declstartpos) {
        let rawdata = this.rawdata;
        let n = rawdata.length;
        let j = i;
        while (j < n) {
            let c = rawdata[j];
            if (c === '<') {
                let s = rawdata.substring(j, j + 2);
                if (s === '<') {
                    return -1; // end of buffer; incomplete
                }
                if (s !== '<!') {
                    this.updatepos(declstartpos, j + 1);
                    throw new Error(`unexpected char in internal subset (in ${s})`);
                }
                if (j + 2 === n) {
                    return -1; // end of buffer; incomplete
                }
                if (j + 4 > n) {
                    return -1; // end of buffer; incomplete
                }
                if (rawdata.substring(j, j + 4) === '<!--') {
                    j = this.parse_comment(j, 0);
                    if (j < 0) {
                        return j;
                    }
                    continue;
                }
                let [name, newJ] = this._scan_name(j + 2, declstartpos);
                j = newJ;
                if (j === -1) {
                    return -1;
                }
                if (!["attlist", "element", "entity", "notation"].includes(name)) {
                    this.updatepos(declstartpos, j + 2);
                    throw new Error(`unknown declaration ${name} in internal subset`);
                }
                let meth = this[`_parse_doctype_${name}`];
                j = meth.call(this, j, declstartpos);
                if (j < 0) {
                    return j;
                }
            } else if (c === '%') {
                if (j + 1 === n) {
                    return -1; // end of buffer; incomplete
                }
                let [s, newJ] = this._scan_name(j + 1, declstartpos);
                j = newJ;
                if (j < 0) {
                    return j;
                }
                if (rawdata[j] === ';') {
                    j++;
                }
            } else if (c === ']') {
                j++;
                while (j < n && /\s/.test(rawdata[j])) {
                    j++;
                }
                if (j < n) {
                    if (rawdata[j] === '>') {
                        return j;
                    }
                    this.updatepos(declstartpos, j);
                    throw new Error("unexpected char after internal subset");
                } else {
                    return -1;
                }
            } else if (/\s/.test(c)) {
                j++;
            } else {
                this.updatepos(declstartpos, j);
                throw new Error(`unexpected char ${c} in internal subset`);
            }
        }
        return -1; // end of buffer reached
    }

    _parse_doctype_element(i, declstartpos) {
        let [name, j] = this._scan_name(i, declstartpos);
        if (j === -1) {
            return -1;
        }
        let rawdata = this.rawdata;
        if (rawdata.substring(j).includes('>')) {
            return rawdata.indexOf(">", j) + 1;
        }
        return -1;
    }

    _parse_doctype_attlist(i, declstartpos) {
        // Not reachable
    }

    _parse_doctype_notation(i, declstartpos) {
        let [name, j] = this._scan_name(i, declstartpos);
        if (j < 0) {
            return j;
        }
        let rawdata = this.rawdata;
        while (true) {
            let c = rawdata.substring(j, j + 1);
            if (!c) {
                return -1; // end of buffer; incomplete
            }
            if (c === '>') {
                return j + 1;
            }
            if ("'\"".includes(c)) {
                let m = _declstringlit.match(rawdata, j);
                if (!m) {
                    return -1;
                }
                j = m.end();
            } else {
                [name, j] = this._scan_name(j, declstartpos);
                if (j < 0) {
                    return j;
                }
            }
        }
    }

    _parse_doctype_entity(i, declstartpos) {
        let rawdata = this.rawdata;
        let j;
        if (rawdata.substring(i, i + 1) === "%") {
            j = i + 1;
            while (true) {
                let c = rawdata.substring(j, j + 1);
                if (!c) {
                    return -1;
                }
                if (/\s/.test(c)) {
                    j++;
                } else {
                    break;
                }
            }
        } else {
            j = i;
        }
        let [name, newJ] = this._scan_name(j, declstartpos);
        j = newJ;
        if (j < 0) {
            return j;
        }
        while (true) {
            let c = rawdata.substring(j, j + 1);
            if (!c) {
                return -1;
            }
            if ("'\"".includes(c)) {
                let m = _declstringlit.match(rawdata, j);
                if (m) {
                    j = m.end();
                } else {
                    return -1; // incomplete
                }
            } else if (c === ">") {
                return j + 1;
            } else {
                [name, j] = this._scan_name(j, declstartpos);
                if (j < 0) {
                    return j;
                }
            }
        }
    }

    _scan_name(i, declstartpos) {
        var rawdata = this.rawdata;
        var n = rawdata.length;
        if (i === n) {
            return [null, -1];
        }
        var m = _declname.exec(rawdata.substring(i));
        if (m) {
            var s = m[0];
            var name = s.trim();
            if ((i + s.length) === n) {
                return [null, -1];
                // end of buffer
            }
            return [name.toLowerCase(), m.index + m[0].length + i];
        } else {
            this.updatepos(declstartpos, i);
            throw new AssertionError(
                "expected name token at " + JSON.stringify(rawdata.substring(declstartpos, declstartpos + 20))
            );
        }    
    }

    unknown_decl(data) {
        // To be overridden
    }
}
class HTMLParser extends ParserBase {
    constructor(convert_charrefs = true) {
        super();
        this.CDATA_CONTENT_ELEMENTS = ["script", "style"];
        this.convert_charrefs = convert_charrefs;
        this.reset();
    }

    reset() {
        this.rawdata = '';
        this.lasttag = '???';
        this.interesting = interesting_normal;
        this.cdata_elem = null;
        this.lineno = 1;
        this.offset = 0;
    }

    feed(data) {
        this.rawdata += data;
        this.goahead(0);
    }

    close() {
        this.goahead(1);
    }

    get_starttag_text() {
        return this.__starttag_text;
    }

    set_cdata_mode(elem) {
        this.cdata_elem = elem.toLowerCase();
        this.interesting = new RegExp('</\\s*' + this.cdata_elem + '\\s*>', 'i');
    }

    clear_cdata_mode() {
        this.interesting = interesting_normal;
        this.cdata_elem = null;
    }

    goahead(end) {

        var rawdata = this.rawdata;
        var i = 0;
        var n = rawdata.length;
        while (i < n) {
            if (this.convert_charrefs && !this.cdata_elem) {
                var j = rawdata.indexOf('<', i);
                if (j < 0) {
                    var amppos = rawdata.lastIndexOf('&', Math.max(i, n - 34));
                    if (amppos >= 0 && !/[\s;]/.test(rawdata.substring(amppos))) {
                        break;
                    }
                    j = n;
                }
            } else {
                var match = this.interesting.exec(rawdata.substring(i));
                if (match) {
                    j = match.index + i;
                } else {
                    if (this.cdata_elem) {
                        break;
                    }
                    j = n;
                }
            }
            if (i < j) {
                if (this.convert_charrefs && !this.cdata_elem) {
                    this.handle_data(unescape(rawdata.substring(i, j)));
                } else {
                    this.handle_data(rawdata.substring(i, j));
                }
            }
            i = this.updatepos(i, j);
            if (i == n) break;
            if (rawdata.startsWith('<', i)) {
                if (starttagopen.exec(rawdata.slice(i, i+2))) { // < + letter
                    var k = this.parse_starttag(i);
                } else if (Array.from(rawdata).slice(i, i + "</".length).join('') === "</" ) {
                    var k = this.parse_endtag(i);
                } else if (Array.from(rawdata).slice(i, i + "<!--".length).join('') === "<!--" ) {
                    var k = this.parse_comment(i, 1);
                } else if (Array.from(rawdata).slice(i, i + "<?".length).join('') === "<?" ) {
                    var k = this.parse_pi(i);
                } else if (Array.from(rawdata).slice(i, i + "<!".length).join('') === "<!" ) {
                    var k = this.parse_html_declaration(i);
                } else if (i + 1 < n) {
                    this.handle_data("<");
                    var k = i + 1;
                } else {
                    break;
                }
                if (k < 0) {
                    if (!end) {
                        break;
                    }
                    k = rawdata.indexOf('>', i + 1);
                    if (k < 0) {
                        k = rawdata.indexOf('<', i + 1);
                        if (k < 0) {
                            k = i + 1;
                        }
                    } else {
                        k += 1;
                    }
                    if (this.convert_charrefs && !this.cdata_elem) {
                        this.handle_data(unescape(rawdata.substring(i, k)));
                    } else {
                        this.handle_data(rawdata.substring(i, k));
                    }
                }
                i = this.updatepos(i, k);
            } else if (rawdata.startsWith("&#", i)) {
                var _act = handle_charref();
                if (_act === "break") {
                    break;
                } else if (_act === "continue") {
                    continue;
                } else {
                    // pass
                }
            } else if (rawdata.startsWith('&', i)) {
                var _act = handle_entityref();
                if (_act === "break") {
                    break;
                } else if (_act === "continue") {
                    continue;
                } else {
                    // pass
                }
            } else {
                throw new Error("interesting.search() lied");
            }
        }
        if (end && i < n && !this.cdata_elem) {
            if (this.convert_charrefs && !this.cdata_elem) {
                this.handle_data(unescape(rawdata.substring(i, n)));
            } else {
                this.handle_data(rawdata.substring(i, n));
            }
            i = this.updatepos(i, n);
        }
        this.rawdata = rawdata.substring(i);    
    }

    parse_html_declaration(i){
        
        var rawdata = this.rawdata;
        if (rawdata.substring(i, i + 2) !== '<!') {
            throw new Error('unexpected call to parse_html_declaration()');
        }
        if (rawdata.substring(i, i + 4) === '<!--') {
            // this case is actually already handled in goahead()
            return this.parse_comment(i, 1);
        } else if (rawdata.substring(i, i + 3) === '<![') {
            return this.parse_marked_section(i, 1);
        } else if (rawdata.substring(i, i + 9).toLowerCase() === '<!doctype') {
            // find the closing >
            var gtpos = rawdata.indexOf('>', i + 9);
            if (gtpos === -1) {
                return -1;
            }
            this.handle_decl(rawdata.substring(i + 2, gtpos));
            return gtpos + 1;
        } else {
            return this.parse_bogus_comment(i, 1);
        }    

    }

    parse_bogus_comment(i, report){
var rawdata = this.rawdata;
    if (!(rawdata.substring(i, i + 2) === '<!' || rawdata.substring(i, i + 2) === '</')) {
        throw new Error('unexpected call to parse_comment()');
    }
    var pos = rawdata.indexOf('>', i + 2);
    if (pos === -1) {
        return -1;
    }
    if (report) {
        this.handle_comment(rawdata.substring(i + 2, pos));
    }
    return pos + 1;
    
    
    }
    
    parse_pi(i){
var rawdata = this.rawdata;
    if (rawdata.substring(i, i + 2) !== '<?') {
        throw new Error('unexpected call to parse_pi()');
    }
    var match = tool_functions.piclose.exec(rawdata.substring(i + 2));
    if (!match) {
        return -1;
    }
    var j = match.index + i + 2;
    this.handle_pi(rawdata.substring(i + 2, j));
    j = match.index + match[0].length + i + 2;
    return j;
    
    
    }

    parse_starttag(i) {
        this.__starttag_text = null;
        var endpos = this.check_for_whole_start_tag(i);
        if (endpos < 0) {
            var _return_value = endpos;
            return _return_value;
        }
        var rawdata = this.rawdata;
        this.__starttag_text = rawdata.substring(i, endpos);
    
        // Now parse the data between i+1 and j into a tag and attrs
    
        var attrs = [];
        var match = tagfind_tolerant.exec(rawdata.substring(i + 1));
        if (!match) throw new Error('unexpected call to parse_starttag()');
        var k = match.index + match[0].length + i + 1;
        var tag = match[1].toLowerCase();
        this.lasttag = tag;
        while (k < endpos) {
            var m = rawdata.slice(k-1).match(attrfind_tolerant);
            if (m[2] == undefined) {
                break;
            }
            var attrname = m[1], rest = m[2], attrvalue = m[3];
            if (!rest) {
                attrvalue = null;
            } else if ((attrvalue[0] == "'" && attrvalue[attrvalue.length-1] == "'") || (attrvalue[0] == '"' && attrvalue[attrvalue.length-1] == '"')) {
                attrvalue = attrvalue.slice(1, -1);
            }
            if (attrvalue) {
                attrvalue = unescape(attrvalue);
            }
            attrs.push([attrname.toLowerCase(), attrvalue]);
            k += m[0].length;
        }
    
        var end = rawdata.substring(k, endpos).trim();
        if (end !== ">" && end !== "/>") {
            this.handle_data(rawdata.substring(i, endpos));
            var _return_value = endpos;
            return _return_value;
        }
        if (end.endsWith('/>')) {
            // XHTML-style empty tag: <span attr="value" />
            this.handle_startendtag(tag, attrs);
        } else {
            this.handle_starttag(tag, attrs);
            if (tag === "script" || tag === "style") {
                this.set_cdata_mode(tag);
            }
        }
        var _return_value = endpos;
        return _return_value;
    }

    check_for_whole_start_tag(i){
        var rawdata = this.rawdata;
        var m = locatestarttagend_tolerant.exec(rawdata.substring(i));
        if (m) {
            var j = m.index + m[0].length + i;
            var next = rawdata.substring(j, j + 1);
            if (next === ">") {
                return j + 1;
            }
            if (next === "/") {
                if (rawdata.startsWith("/>", j)) {
                    return j + 2;
                }
                if (rawdata.startsWith("/", j)) {
                    // buffer boundary
                    return -1;
                }
                // else bogus input
                if (j > i) {
                    return j;
                } else {
                    return i + 1;
                }
            }
            if (next === "") {
                // end of input
                return -1;
            }
            if ("abcdefghijklmnopqrstuvwxyz=/ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(next)) {
                // end of input in or before attribute value, or we have the
                // '/' from a '/>' ending
                return -1;
            }
            if (j > i) {
                return j;
            } else {
                return i + 1;
            }
        }
        throw new Error("we should not get here!");    
    }    

    parse_endtag(i){
        var rawdata = this.rawdata;
        if (rawdata.substring(i, i+2) !== "</") throw new Error("unexpected call to parse_endtag");
        var match = endendtag.exec(rawdata.substring(i+1));
        if (!match) {
            return -1;
        }
        var gtpos = match.index + match[0].length + i + 1;
        match = endtagfind.exec(rawdata.substring(i));
        if (!match) {
            if (this.cdata_elem !== null) {
                this.handle_data(rawdata.substring(i, gtpos));
                return gtpos;
            }
            var namematch = tagfind_tolerant.exec(rawdata.substring(i+2));
            if (!namematch) {
                if (rawdata.substring(i, i+3) === '</>') {
                    return i+3;
                } else {
                    return this.parse_bogus_comment(i, 1);
                }
            }
            var tagname = namematch[1].toLowerCase();
            gtpos = rawdata.indexOf('>', namematch.index + namematch[0].length + i + 2);
            this.handle_endtag(tagname);
            return gtpos + 1;
        }
        var elem = match[1].toLowerCase();
        if (this.cdata_elem !== null) {
            if (elem !== this.cdata_elem) {
                this.handle_data(rawdata.substring(i, gtpos));
                return gtpos;
            }
        }
        this.handle_endtag(elem);
        this.clear_cdata_mode();
        return gtpos;    
    }

    handle_startendtag(tag, attrs) {
        this.handle_starttag(tag, attrs);
        this.handle_endtag(tag);
    }

    handle_starttag(tag, attrs) {
        // Overridable method
    }

    handle_endtag(tag) {
        // Overridable method
    }

    handle_charref(name) {
        // Overridable method
    }

    handle_entityref(name) {
        // Overridable method
    }

    handle_data(data) {
        // Overridable method
    }

    handle_comment(data) {
        // Overridable method
    }

    handle_decl(decl) {
        // Overridable method
    }

    handle_pi(data) {
        // Overridable method
    }

    unknown_decl(data) {
        // Overridable method
    }
}
class MyHTMLParserTester extends HTMLParser{
    constructor() {
        super();
        this.listener_event_list = [];
    }

    handleStartTag(tag, attrs) {
        console.log("Encountered a start tag:", tag, attrs);
        this.listener_event_list.push(["starttag", tag, attrs]);
    }

    handleEndTag(tag) {
        console.log("Encountered an end tag :", tag);
        this.listener_event_list.push(["endtag", tag]);
    }

    handleData(data) {
        console.log("Encountered some data  :", data);
        this.listener_event_list.push(["data", data]);
    }

    handleComment(data) {
        console.log("Encountered comment    :", data);
        this.listener_event_list.push(["comment", data]);
    }

    handleEntityRef(name) {
        console.log("entityref:", name);
        this.listener_event_list.push(["entityref", name]);
    }

    handleCharRef(name) {
        console.log("charref  name:", name);
        this.listener_event_list.push(["charref", name]);
    }

    handleDecl(data) {
        console.log("decl     data:", data);
        this.listener_event_list.push(["decl", data]);
    }

    handlePi(data) {
        console.log("pi       data:", data);
        this.listener_event_list.push(["pi", data]);
    }

    unknownDecl(data) {
        console.log("unknown  data:", data);
        this.listener_event_list.push(["unknown", data]);
    }
}
function test() {
    let p = new MyHTMLParserTester();
    p.feed(_example_html);
    // console.log("----- call functions -----");
    listener_event_list.push(["PRINT", p.getpos()]);
    listener_event_list.push(["PRINT", p.get_starttag_text()]);
    listener_event_list.push(["PRINT", p.parse_declaration(0)]);
    p.close();
}
function additional_test() {
    let p = new MyHTMLParserTester();
    p.rawdata = "<!DOCTYPE html>";
    let parse_res = p.parse_declaration(0);
    console.assert(parse_res === 15);
    p.reset();

    p.rawdata = "<!DOCTYPE '2'>";
    parse_res = p.parse_declaration(0);
    console.assert(parse_res === 14);
    p.reset();

    p.rawdata = "<!DOCTYPE [<!-->]>";
    parse_res = p.parse_declaration(0);
    console.assert(parse_res === -1);
    p.reset();

    p.rawdata = "<!DOCTYPE [%hello]> ";
    parse_res = p.parse_declaration(0);
    console.assert(parse_res === 19);
    p.reset();

    p.rawdata = "<!DOCTYPE [ ]> ";
    parse_res = p.parse_declaration(0);
    console.assert(parse_res === 14);
    p.reset();
    p.close();
}
function additional_test2() {
    let p = new MyHTMLParserTester();
    p.convertCharrefs = false;
    p.feed("&abc<");
    // let parse_res = p.parseDeclaration(0);
    // console.assert(parse_res === -1);
    p.reset();

    p.convertCharrefs = false;
    p.feed("&#abc<");
    // parse_res = p.parseDeclaration(0);
    // console.assert(parse_res === -1);
    p.reset();

    p.convertCharrefs = false;
    p.feed("&<");
    // parse_res = p.parseDeclaration(0);
    // console.assert(parse_res === -1);
    p.reset();

    p.convertCharrefs = false;
    p.feed("&#<");
    // parse_res = p.parseDeclaration(0);
    // console.assert(parse_res === -1);
    p.reset();
    p.close();
}
function additional_test3() {
    let p = new MyHTMLParserTester();
    p.handle_startendtag("tag", []);
    p.reset();
    p.handle_charref("name");
    p.reset();
    p.handle_entityref("name");
    p.reset();
    p.handle_data("data");
    p.reset();
    p.handle_comment("data");
    p.reset();
    p.handle_decl("data");
    p.reset();
    p.handle_pi("data");
    p.reset();
    p.unknown_decl("data");
    p.reset();

    p = new HTMLParser();
    p.handle_startendtag("tag", []);
    p.reset();
    p.handle_charref("name");
    p.reset();
    p.handle_entityref("name");
    p.reset();
    p.handle_data("data");
    p.reset();
    p.handle_comment("data");
    p.reset();
    p.handle_decl("data");
    p.reset();
    p.handle_pi("data");
    p.reset();
    p.unknown_decl("data");
    p.reset();
    p.close();
}
function additional_test4() {
    let p = new HTMLParser();
    p.rawdata = "<abc/";
    let parse_res = p.check_for_whole_start_tag(0);
    console.assert(parse_res === -1);
    p.reset();
    p.rawdata = '<tagname attr="value';
    parse_res = p.check_for_whole_start_tag(0);
    console.assert(parse_res === -1);
    p.reset();
    p.rawdata = '<tagname attr';
    parse_res = p.check_for_whole_start_tag(0);
    console.assert(parse_res === -1);
    p.reset();
    p.rawdata = '<tagname /';
    parse_res = p.check_for_whole_start_tag(0);
    console.assert(parse_res === -1);
    p.reset();
    p.rawdata = '<tagname attr = "value" /';
    parse_res = p.check_for_whole_start_tag(0);
    console.assert(parse_res === -1);
    p.reset();
    p.rawdata = '<tagname "value" /';
    parse_res = p.check_for_whole_start_tag(0);
    console.assert(parse_res === -1);
    p.reset();
    p.close();
}
function additional_test5() {
    let res = escape("abc<>/'");
    console.assert(res === "abc&lt;&gt;/&#x27;");
    res = escape("<>");
    console.assert(res === "&lt;&gt;");
    res = escape("abc");
    console.assert(res === "abc");
    res = escape("abc&");
    console.assert(res === "abc&amp;");

    res = unescape("abc&lt;&gt;/&#x27;");
    console.assert(res === "abc<>/'");
    res = unescape("&lt;&gt;");
    console.assert(res === "<>");
    res = unescape("abc");
    console.assert(res === "abc");
    res = unescape("abc&amp;");
    console.assert(res === "abc&");
}
function additional_test6() {
    let p = new HTMLParser();
    p.rawdata = "element>";
    p._parse_doctype_element(0, 0);
    p.reset();

    p.rawdata = "attlist element";
    p._parse_doctype_attlist(0, 0);
    p.reset();

    p.rawdata = "notation element";
    p._parse_doctype_notation(0, 0);
    p.reset();

    p.rawdata = "notation'";
    p._parse_doctype_notation(0, 0);
    p.reset();

    p.rawdata = "%element element";
    p._parse_doctype_entity(0, 0);
    p.reset();
    p.close();
}
function additional_tests() {
    additional_test();
    additional_test2();
    additional_test3();
    additional_test4();
    additional_test5();
    additional_test6();
}

// Global Begin
name2codepoint = {
    'AElig': 0x00c6
};
codepoint2name = {};
entitydefs = {};
for (var name in name2codepoint) {
    var codepoint = name2codepoint[name];
    codepoint2name[codepoint] = name;
    entitydefs[name] = String.fromCharCode(codepoint);
}

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
_example_html = tool_functions._example_html;

_charref_regular_exp_match = _charref_regular_exp.exec
_declname_match = _declname.exec
_declstringlit_match = _declstringlit.exec
_commentclose_match = _commentclose.exec
_declstringlit_match = _declstringlit.exec
_declname_match = _declname.exec
_declstringlit_match = _declstringlit.exec
_declstringlit_match = _declstringlit.exec
_markedsectionclose_match = _markedsectionclose.exec
_msmarkedsectionclose_match = _msmarkedsectionclose.exec
interesting_normal_match = interesting_normal.exec
incomplete_match = incomplete.exec
entityref_match = entityref.exec
charref_match = charref.exec
starttagopen_match = starttagopen.exec
piclose_match = piclose.exec
commentclose_match = commentclose.exec
tagfind_tolerant_match = tagfind_tolerant.exec
attrfind_tolerant_match = attrfind_tolerant.exec
locatestarttagend_tolerant_match = locatestarttagend_tolerant.exec
endendtag_match = endendtag.exec
endtagfind_match = endtagfind.exec
CDATA_CONTENT_ELEMENTS = ["script", "style"]
SCAN_NAME_DEFAULT = [null, -1]
listener_event_list = [];

test();
additional_tests();