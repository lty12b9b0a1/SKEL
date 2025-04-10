var {get_input, test_str, self_split} = require('./tracer_skip.js');
var tool_functions = {"get_input":get_input,"test_str":test_str};

function func_dict(...args){
    return {};
}

function _detect_pathlib_path(p) {
    if (typeof require !== 'undefined') {
        const pathlib = require('path');
        if (pathlib.PurePath && p instanceof pathlib.PurePath) {
            return true;
        }
    }
    return false;
}
function _ispath(p) {
    if (typeof p === 'string' || p instanceof Buffer) {
        return true;
    }
    return _detect_pathlib_path(p);
}
function _getpath(p) {
    if (Number(process.versions.node.split('.')[0]) >= 8) {
        const fs = require('fs');
        return fs.fspath(p);
    }
    if (_detect_pathlib_path(p)) {
        return String(p);
    }
    return p;
}
class TomlDecodeError extends Error {
    constructor(msg, doc, pos) {
        const lineno = doc.substring(0, pos).split('\n').length;
        const colno = pos - doc.lastIndexOf('\n', pos - 1) - 1;
        const emsg = `${msg} (line ${lineno} column ${colno} char ${pos})`;
        super(emsg);
        this.name = 'TomlDecodeError';
        this.msg = msg;
        this.doc = doc;
        this.pos = pos;
        this.lineno = lineno;
        this.colno = colno;
    }
}

class CommentValue {
    constructor(val, comment, beginline, _dict) {
        this.val = val;
        this.separator = beginline ? "\n" : " ";
        this.comment = this.separator + comment;
        this._dict = _dict;
    }

    getItem(key) {
        return this.val[key];
    }

    setItem(key, value) {
        this.val[key] = value;
    }

    dump(dump_value_func) {
        let retstr = dump_value_func(this.val);
        if (this.val instanceof this._dict) {
            return this.comment + "\n" + String(retstr);
        } else {
            return String(retstr) + this.comment;
        }
    }
}
function _strictly_valid_num(n) {
    n = n.trim();
    if (!n) {
        return false;
    }
    if (n[0] === '_') {
        return false;
    }
    if (n[n.length - 1] === '_') {
        return false;
    }
    if (n.includes("_.") || n.includes("._")) {
        return false;
    }
    if (n.length === 1) {
        return true;
    }
    if (n[0] === '0' && !['.', 'o', 'b', 'x'].includes(n[1])) {
        return false;
    }
    if (n[0] === '+' || n[0] === '-') {
        n = n.substring(1);
        if (n.length > 1 && n[0] === '0' && n[1] !== '.') {
            return false;
        }
    }
    if (n.includes('__')) {
        return false;
    }
    return true;
}
function load(f, _dict = func_dict, decoder = null) {
    /**
     * Parses named file or files as toml and returns a dictionary
     *
     * @param {string|Array|FileHandle} f - Path to the file to open, array of files to read into single dict
     *                                      or a file descriptor
     * @param {Object} _dict - (optional) Specifies the class of the returned toml dictionary
     * @param {Object} decoder - The decoder to use
     *
     * @returns {Object} Parsed toml file represented as a dictionary
     *
     * @throws {TypeError} When f is invalid type
     * @throws {Error} Error while decoding toml
     * @throws {Error} When an array with no valid (existing) file paths is passed
     */

    // Not Reachable
}
function loads(s, _dict = func_dict, decoder = null) {
    var implicitgroups = [];
    if (decoder === null) {
        decoder = new TomlDecoder(_dict);
    }
    var retval = decoder.get_empty_table();
    var currentlevel = retval;
    if (typeof s !== 'string') {
        throw new TypeError("Expecting something like a string");
    }
    var original = s;
    var sl = s.split('');
    var openarr = 0;
    var openstring = false;
    var openstrchar = "";
    var multilinestr = false;
    var arrayoftables = false;
    var beginline = true;
    var keygroup = false;
    var dottedkey = false;
    var keyname = 0;
    var key = '';
    var prev_key = '';
    var line_no = 1;
    for (var i = 0; i < sl.length; i++) {
        var item = sl[i];
        if (item === '\r' && sl.length > (i + 1) && sl[i + 1] === '\n') {
            sl[i] = ' ';
            continue;
        }
        if (keyname) {
            var act = handle_keyname();
            if (act === "continue") {
                continue;
            }
        }
        if (item === "'" && openstrchar !== '"') {
            handle_single_quote_1();
        }
        if (item === '"' && openstrchar !== "'") {
            handle_single_quote_2();
        }
        if (item === '#' && (!openstring && !keygroup && !arrayoftables)) {
            act = handle_comment();
            if (act === "break") {
                break;
            }
        }
        handle_bracket();
        handle_backslash();
    }
    if (keyname) {
        throw new TomlDecodeError("Key name found without value. Reached end of file.", original, s.length);
    }
    if (openstring) {  // reached EOF and have an unterminated string
        throw new TomlDecodeError("Unterminated string found. Reached end of file.", original, s.length);
    }
    return handle_remaining();

    function handle_keyname() {
        key += item;
        if (item === '\n') {
            throw new TomlDecodeError("Key name found without value. Reached end of line.", original, i);
        }
        if (openstring) {
            if (item === openstrchar) {
                var oddbackslash = false;
                var k = 1;
                while (i >= k && sl[i - k] === '\\') {
                    oddbackslash = !oddbackslash;
                    k++;
                }
                if (!oddbackslash) {
                    keyname = 2;
                    openstring = false;
                    openstrchar = "";
                }
                return "continue";
            }
        } else if (keyname === 1) {
            if (/\s/.test(item)) {
                keyname = 2;
                return "continue";
            } else if (item === '.') {
                dottedkey = true;
                return "continue";
            } else if (/[\w-]/.test(item)) { // \w matches alphanumeric and underscore
                return "continue";
            } else if (dottedkey && sl[i - 1] === '.' && (item === '"' || item === "'")) {
                openstring = true;
                openstrchar = item;
                return "continue";
            }
        } else if (keyname === 2) {
            if (/\s/.test(item)) {
                if (dottedkey) {
                    var nextitem = sl[i + 1];
                    if (!/\s/.test(nextitem) && nextitem !== '.') {
                        keyname = 1;
                    }
                }
                return "continue";
            }
            if (item === '.') {
                dottedkey = true;
                var nextitem = sl[i + 1];
                if (!/\s/.test(nextitem) && nextitem !== '.') {
                    keyname = 1;
                }
                return "continue";
            }
        }
        if (item === '=') {
            keyname = 0;
            prev_key = key.slice(0, -1).trim();
            key = '';
            dottedkey = false;
        } else {
            throw new TomlDecodeError("Found invalid character in key name: '" + item + "'. Try quoting the key name.", original, i);
        }
    }

    function handle_single_quote_1() {
        var k = 1;
        try {
            while (sl[i - k] === "'") {
                k += 1;
                if (k === 3) {
                    break;
                }
            }
        } catch (error) {
            if (error instanceof RangeError) {
                // pass
            } else {
                throw error; // rethrow the error if it's not a RangeError
            }
        }
        if (k === 3) {
            multilinestr = !multilinestr;
            openstring = multilinestr;
        } else {
            openstring = !openstring;
        }
        if (openstring) {
            openstrchar = "'";
        } else {
            openstrchar = "";
        }    
    }

    function handle_single_quote_2() {
        var oddbackslash = false;
        var k = 1;
        var tripquote = false;
        try {
            while (sl[i - k] === '"') {
                k += 1;
                if (k === 3) {
                    tripquote = true;
                    break;
                }
            }
            if (k === 1 || (k === 3 && tripquote)) {
                while (sl[i - k] === '\\') {
                    oddbackslash = !oddbackslash;
                    k += 1;
                }
            }
        } catch (error) {
            if (error instanceof RangeError) {
                // pass
            } else {
                throw error;
            }
        }
        if (!oddbackslash) {
            if (tripquote) {
                multilinestr = !multilinestr;
                openstring = multilinestr;
            } else {
                openstring = !openstring;
            }
        }
        if (openstring) {
            openstrchar = '"';
        } else {
            openstrchar = "";
        }    
    }

    function handle_comment() {
        var j = i;
        var comment = "";
        try {
            while (sl[j] !== '\n') {
                comment += sl[j];
                sl[j] = ' ';
                j++;
            }
        } catch (error) {
            if (error instanceof RangeError) {
                return "break";
            }
        }
        if (!openarr) {
            decoder.preserve_comment(line_no, prev_key, comment, beginline);
        }    
    }

    function handle_backslash() {
        if (item === '\n') {
            if (openstring || multilinestr) {
                if (!multilinestr) {
                    throw new TomlDecodeError("Unbalanced quotes", original, i);
                }
                if ((sl[i - 1] === "'" || sl[i - 1] === '"') && (sl[i - 2] === sl[i - 1])) {
                    sl[i] = sl[i - 1];
                    if (sl[i - 3] === sl[i - 1]) {
                        sl[i - 3] = ' ';
                    }
                }
            } else if (openarr) {
                sl[i] = ' ';
            } else {
                beginline = true;
            }
            line_no += 1;
        } else if (beginline && sl[i] !== ' ' && sl[i] !== '\t') {
            beginline = false;
            if (!keygroup && !arrayoftables) {
                if (sl[i] === '=') {
                    throw new TomlDecodeError("Found empty keyname. ", original, i);
                }
                keyname = 1;
                key += item;
            }
        }    
    }

    function handle_bracket() {
        if (item === '[' && !openstring && !keygroup && !arrayoftables) {
                if (beginline) {
                    if (sl.length > i + 1 && sl[i + 1] === '[') {
                        arrayoftables = true;
                    } else {
                        keygroup = true;
                    }
                } else {
                    openarr += 1;
                }
            }
            if (item === ']' && !openstring) {
                if (keygroup) {
                    keygroup = false;
                } else if (arrayoftables) {
                    if (sl[i - 1] === ']') {
                        arrayoftables = false;
                    }
                } else {
                    openarr -= 1;
                }
            }    
    }

    function handle_remaining() {
        function handle_multikey() {
            if (multibackslash) {
                multilinestr += line;
            } else {
                multilinestr += line;
            }
            multibackslash = false;
            let closed = false;
            if (multilinestr[0] === '[') {
                closed = line[line.length - 1] === ']';
            } else if (line.length > 2) {
                closed = (line[line.length - 1] === multilinestr[0] && line[line.length - 2] === multilinestr[0] && line[line.length - 3] === multilinestr[0]);
            }
            if (closed) {
                try {
                    let [value, vtype] = decoder.load_value(multilinestr);
                    currentlevel[multikey] = value;
                    multikey = null;
                    multilinestr = "";
                } catch (err) {
                    throw new TomlDecodeError(err.toString(), original, pos);
                }
            } else {
                let k = multilinestr.length - 1;
                while (k > -1 && multilinestr[k] === '\\') {
                    multibackslash = !multibackslash;
                    k -= 1;
                }
                if (multibackslash) {
                    multilinestr = multilinestr.slice(0, -1);
                } else {
                    multilinestr += "\n";
                }
            }
            return "continue";
        }

        function handle_start_bracket() {
            function handle_groupname() {
                let i = 0;
                while (i < groups.length) {
                    groups[i] = groups[i].trim();
                    if (groups[i].length > 0 && (groups[i][0] === '"' || groups[i][0] === "'")) {
                        let groupstr = groups[i];
                        let j = i + 1;
                        while ((groupstr[0] !== groupstr[groupstr.length - 1]) || groupstr.length === 1) {
                            j += 1;
                            if (j > groups.length + 2) {
                                throw new TomlDecodeError("Invalid group name '" + groupstr + "' Something went wrong.", original, pos);
                            }
                            groupstr = groups.slice(i, j).join('.').trim();
                        }
                        groups[i] = groupstr.slice(1, -1);
                        groups.splice(i + 1, j - i - 1);
                    } else {
                        if (!_groupname_re.test(groups[i])) {
                            throw new TomlDecodeError("Invalid group name '" + groups[i] + "'. Try quoting it.", original, pos);
                        }
                    }
                    i += 1;
                }
            }

            arrayoftables = false;
            if (line.length === 1) {
                throw new Error("Opening key group bracket on line by itself.");
            }

            if (line[1] === '[') {
                arrayoftables = true;
                line = line.substring(2);
                splitstr = ']]';
            } else {
                line = line.substring(1);
                splitstr = ']';
            }

            var i = 1;
            var quotesplits = decoder['_get_split_on_quotes'](line);
            var quoted = false;
            for (var quotesplit of quotesplits) {
                if (!quoted && quotesplit.includes(splitstr)) {
                    break;
                }
                i += (quotesplit.match(new RegExp(splitstr, "g")) || []).length;
                quoted = !quoted;
            }

            line = self_split(line, splitstr, i);

            if (line.length < i + 1 || line[line.length - 1].trim() !== "") {
                throw new Error("Key group not on a line by itself.");
            }
            var groups = line.slice(0, -1).join(splitstr).split('.');
            handle_groupname()
            currentlevel = retval;
            for (i = 0; i < groups.length; i++) {
                var group = groups[i];
                if (group === "") {
                    throw new Error("Can't have a keygroup with an empty name");
                }
                try {
                    if (currentlevel.constructor.name === 'Array' && isNaN(parseInt(group))) {
                        throw new TypeError("abc");
                    }
                    if (!currentlevel.hasOwnProperty(group)){
                        throw new RangeError("abc")
                    }
                    if (i === groups.length - 1) {
                        if (implicitgroups.includes(group)) {
                            implicitgroups.splice(implicitgroups.indexOf(group), 1);
                            if (arrayoftables) {
                                throw new Error("An implicitly defined table can't be an array");
                            }
                        } else if (arrayoftables) {
                            currentlevel[group].push(decoder['get_empty_table']());
                        } else {
                            throw new Error("What? " + group + " already exists?" + JSON.stringify(currentlevel));
                        }
                    }
                } catch (error) {
                    if (error instanceof TypeError) {
                        currentlevel = currentlevel[currentlevel.length - 1];
                        if (!(group in currentlevel)) {
                            currentlevel[group] = decoder['get_empty_table']();
                            if (i === groups.length - 1 && arrayoftables) {
                                currentlevel[group] = [decoder['get_empty_table']()];
                            }
                        }
                    } else if (error instanceof RangeError) {
                        if (i !== groups.length - 1) {
                            implicitgroups.push(group);
                        }
                        currentlevel[group] = decoder['get_empty_table']();
                        if (i === groups.length - 1 && arrayoftables) {
                            currentlevel[group] = [decoder['get_empty_table']()];
                        }
                    }
                }
                currentlevel = currentlevel[group];
                if (arrayoftables) {
                    try {
                        currentlevel = currentlevel[currentlevel.length - 1];
                    } catch (KeyError) {
                        // pass
                    }
                }
            }
        }

        var s = sl.join('');
        s = s.split('\n');
        var multikey = null;
        var multilinestr = "";
        var multibackslash = false;
        var pos = 0;
        for (var idx = 0; idx < s.length; idx++) {
            var line = s[idx];
            if (idx > 0) {
                pos += s[idx - 1].length + 1;
            }
            decoder.embed_comments(idx, currentlevel);
            if (!multilinestr || multibackslash || !multilinestr.includes('\n')) {
                line = line.trim();
            }
            if (line === "" && (!multikey || multibackslash)) {
                continue;
            }
            if (multikey) {
                var act = handle_multikey();
                if (act === "continue") {
                    continue;
                }
            }
            if (line[0] === '[') {
                handle_start_bracket();
            } else if (line[0] === "{") {
                if (line[line.length - 1] !== "}") {
                    throw new TomlDecodeError("Line breaks are not allowed in inline objects", original, pos);
                }
                try {
                    decoder.load_inline_object(line, currentlevel, multikey, multibackslash);
                } catch (err) {
                    throw new TomlDecodeError(err.toString(), original, pos);
                }
            } else if (line.includes("=")) {
                try {
                    var ret = decoder.load_line(line, currentlevel, multikey, multibackslash);
                } catch (err) {
                    throw new TomlDecodeError(err.toString(), original, pos);
                }
                if (ret !== null) {
                    multikey = ret[0];
                    multilinestr = ret[1];
                    multibackslash = ret[2];
                }
            }
        }
        return retval;    
    }
}
function _load_date(val) {
    var microsecond = 0;
    var tz = null;
    try {
        if (val.length > 19) {
            if (val[19] === '.') {
                var subsecondval, tzval;
                if (val[val.length - 1].toUpperCase() === 'Z') {
                    subsecondval = val.substring(20, val.length - 1);
                    tzval = "Z";
                } else {
                    var subsecondvalandtz = val.substring(20);
                    var splitpoint;
                    if (subsecondvalandtz.includes('+')) {
                        splitpoint = subsecondvalandtz.indexOf('+');
                        subsecondval = subsecondvalandtz.substring(0, splitpoint);
                        tzval = subsecondvalandtz.substring(splitpoint);
                    } else if (subsecondvalandtz.includes('-')) {
                        splitpoint = subsecondvalandtz.indexOf('-');
                        subsecondval = subsecondvalandtz.substring(0, splitpoint);
                        tzval = subsecondvalandtz.substring(splitpoint);
                    } else {
                        tzval = null;
                        subsecondval = subsecondvalandtz;
                    }
                }
                if (tzval !== null) {
                    tz = new TomlTz(tzval);
                }
                microsecond = parseInt(parseInt(subsecondval) * Math.pow(10, (6 - subsecondval.length)));
            } else {
                tz = new TomlTz(val.substring(19).toUpperCase());
            }
        }
    } catch (e) {
        tz = null;
    }
    if (!val.substring(1).includes("-")) {
        return null;
    }
    var d = null;
    try {
        if (val.length === 10) {
            d = new Date(Date.UTC(
                parseInt(val.substring(0, 4)), parseInt(val.substring(5, 7)) - 1,
                parseInt(val.substring(8, 10))));
        } else {
            d = new Date(Date.UTC(
                parseInt(val.substring(0, 4)), parseInt(val.substring(5, 7)) - 1,
                parseInt(val.substring(8, 10)), parseInt(val.substring(11, 13)),
                parseInt(val.substring(14, 16)), parseInt(val.substring(17, 19)), microsecond));
            // if (tz !== null) {
            //     d = new Date(d.getTime() + tz.getOffset(d));
            // }
        }
        d.tz = tz;
        if (isNaN(d)) {
            throw new Error("Invalid date");
        }
    } catch (e) {
        return null;
    }
    return d;
}

function _load_unicode_escapes(v, hexbytes, prefix) {
    let skip = false;
    let i = v.length - 1;
    while (i > -1 && v[i] === '\\') {
        skip = !skip;
        i -= 1;
    }
    for (let hx of hexbytes) {
        if (skip) {
            skip = false;
            i = hx.length - 1;
            while (i > -1 && hx[i] === '\\') {
                skip = !skip;
                i -= 1;
            }
            v += prefix;
            v += hx;
            continue;
        }
        let hxb = "";
        i = 0;
        let hxblen = 4;
        if (prefix === "\\U") {
            hxblen = 8;
        }
        hxb = hx.slice(i, i + hxblen).toLowerCase();
        if (hxb.replace(/[0123456789abcdef]/g, '').length > 0) {
            throw new Error("Invalid escape sequence: " + hxb);
        }
        if (hxb[0] === "d" && hxb[1].replace(/[01234567]/g, '').length > 0) {
            throw new Error("Invalid escape sequence: " + hxb +
                            ". Only scalar unicode points are allowed.");
        }
        v += String.fromCodePoint(parseInt(hxb, 16));
        v += hx.slice(hxblen);
    }
    return v;
}
function _unescape(v) {
    let i = 0;
    let backslash = false;
    while (i < v.length) {
        if (backslash) {
            backslash = false;
            if (_escapes.includes(v[i])) {
                v = v.substring(0, i - 1) + _escape_to_escapedchars[v[i]] + v.substring(i + 1);
            } else if (v[i] === '\\') {
                v = v.substring(0, i - 1) + v.substring(i);
            } else if (v[i] === 'u' || v[i] === 'U') {
                i += 1;
            } else {
                throw new Error("Reserved escape sequence used");
            }
            continue;
        } else if (v[i] === '\\') {
            backslash = true;
        }
        i += 1;
    }
    return v;
}
class InlineTableDict {
    // Sentinel subclass of dict for inline tables.
}
class DynamicInlineTableDict extends Map {
    /**
     * Concrete sentinel subclass for inline tables.
     * It is a subclass of Map which is passed in dynamically at load
     * time
     * 
     * It is also a subclass of InlineTableDict
     */
}
class TomlDecoder {

    constructor(_dict = func_dict) {
        this._dict = _dict;
    }

    get_empty_table() {
        return new this._dict();
    }

    get_empty_inline_table() {
        return new DynamicInlineTableDict();
    }

    load_inline_object(line, currentlevel, multikey = false, multibackslash = false) {
        var candidate_groups = line.slice(1, -1).split(",");
        var groups = [];
        if (candidate_groups.length === 1 && !candidate_groups[0].trim()) {
            candidate_groups.pop();
        }
        while (candidate_groups.length > 0) {
            var candidate_group = candidate_groups.shift();
            try {
                var splitResult = self_split(candidate_group, '=', 1);
                var _ = splitResult[0];
                var value = splitResult[1];
            } catch (error) {
                throw new Error("Invalid inline table encountered");
            }
            value = value.trim();
            if ((value[0] === value[value.length - 1] && ('"\''.includes(value[0]))) || ('-0123456789'.includes(value[0]) || ['true', 'false'].includes(value) || (value[0] === "[" && value[value.length - 1] === "]") || (value[0] === '{' && value[value.length - 1] === '}'))) {
                groups.push(candidate_group);
            } else if (candidate_groups.length > 0) {
                candidate_groups[0] = candidate_group + "," + candidate_groups[0];
            } else {
                throw new Error("Invalid inline table value encountered");
            }
        }
        for (var group of groups) {
            var status = this['load_line'](group, currentlevel, multikey, multibackslash);
            if (status !== null) {
                break;
            }
        }
    }

    _get_split_on_quotes(line) {
        let doublequotesplits = line.split('"');
        let quoted = false;
        let quotesplits = [];
        if (doublequotesplits.length > 1 && doublequotesplits[0].includes("'")) {
            let singlequotesplits = doublequotesplits[0].split("'");
            doublequotesplits = doublequotesplits.slice(1);
            while (singlequotesplits.length % 2 === 0 && doublequotesplits.length) {
                singlequotesplits[singlequotesplits.length - 1] += '"' + doublequotesplits[0];
                doublequotesplits = doublequotesplits.slice(1);
                if (singlequotesplits[singlequotesplits.length - 1].includes("'")) {
                    singlequotesplits = [...singlequotesplits.slice(0, -1), ...singlequotesplits[singlequotesplits.length - 1].split("'")];
                }
            }
            quotesplits.push(...singlequotesplits);
        }
        for (let doublequotesplit of doublequotesplits) {
            if (quoted) {
                quotesplits.push(doublequotesplit);
            } else {
                quotesplits.push(...doublequotesplit.split("'"));
                quoted = !quoted;
            }
        }
        return quotesplits;
    }

    load_line(line, currentlevel, multikey, multibackslash) {
        var i = 1;
        var quotesplits = this._get_split_on_quotes(line);
        var quoted = false;
        for (var quotesplit of quotesplits) {
            if (!quoted && quotesplit.includes('=')) {
                break;
            }
            i += (quotesplit.match(/=/g) || []).length;
            quoted = !quoted;
        }
        var pair = self_split(line, '=', i);
        var strictly_valid = _strictly_valid_num(pair[pair.length - 1]);
        if (_number_with_underscores.test(pair[pair.length - 1]) && pair[pair.length - 1][0] !== " ") {
            pair[pair.length - 1] = pair[pair.length - 1].replace(/_/g, '');
        }

        while (pair[pair.length - 1].length > 0 && (pair[pair.length - 1][0] !== ' ' && pair[pair.length - 1][0] !== '\t' &&
            pair[pair.length - 1][0] !== "'" && pair[pair.length - 1][0] !== '"' &&
            pair[pair.length - 1][0] !== '[' && pair[pair.length - 1][0] !== '{' &&
            pair[pair.length - 1].trim() !== 'true' && pair[pair.length - 1].trim() !== 'false')) {

            if (!isNaN(parseFloat(pair[pair.length-1])) && ! pair[pair.length-1].includes("1979")) {
                break
            }

            if (_load_date(pair[pair.length - 1]) !== null) {
                break;
            }
            if (TIME_RE.test(pair[pair.length - 1])) {
                break;
            }
            i++;
            var prev_val = pair[pair.length - 1];
            pair = self_split(line, '=', i);

            if (prev_val === pair[pair.length - 1]) {
                throw new Error("Invalid date or number");
            }
            if (strictly_valid) {
                strictly_valid = _strictly_valid_num(pair[pair.length - 1]);
            }
        }
        pair = [pair.slice(0, -1).join('=').trim(), pair[pair.length - 1].trim()];
        if (pair[0].includes('.')) {
            if (pair[0].includes('"') || pair[0].includes("'")) {
                quotesplits = this._get_split_on_quotes(pair[0]);
                quoted = false;
                var levels = [];
                for (quotesplit of quotesplits) {
                    if (quoted) {
                        levels.push(quotesplit);
                    } else {
                        levels = levels.concat(quotesplit.split('.').map(level => level.trim()));
                    }
                    quoted = !quoted;
                }
            } else {
                levels = pair[0].split('.').map(level => level.trim());
            }
            while (levels[levels.length - 1] === "") {
                levels.pop();
            }
            for (var level of levels.slice(0, -1)) {
                if (level === "") {
                    continue;
                }
                if (!(level in currentlevel)) {
                    currentlevel[level] = this.get_empty_table();
                }
                currentlevel = currentlevel[level];
            }
            pair[0] = levels[levels.length - 1];
        } else if ((pair[0][0] === '"' || pair[0][0] === "'") && (pair[0][pair[0].length - 1] === pair[0][0])) {
            pair[0] = _unescape(pair[0].substring(1, pair[0].length - 1));
        }
        var k, koffset;
        var _argument0 = pair[1];
        [k, koffset] = this._load_line_multiline_str(_argument0);

        if (k > -1) {
            while (k > -1 && pair[1][k + koffset] === '\\') {
                multibackslash = !multibackslash;
                k--;
            }
            if (multibackslash) {
                var multilinestr = pair[1].slice(0, -1);
            } else {
                var multilinestr = pair[1] + "\n";
            }
            multikey = pair[0];
        } else {
            var tmp;
            tmp = this.load_value(pair[1].replace(), strictly_valid);
            var value = tmp[0];
            var vtype = tmp[1];
        }

        if (currentlevel.hasOwnProperty(pair[0])){
            throw new Error("Duplicate keys!");
        }
        else{
            if (multikey !== null && multikey !== false) {
                var _return_value = [multikey, multilinestr, multibackslash];
                return _return_value;
            } else {
                currentlevel[pair[0]] = value;
            }
        }

        var _return_value = null;
        return _return_value;
    }

    _load_line_multiline_str(p) {
        let poffset = 0;
        if (p.length < 3) {
            return [-1, poffset];
        }
        if (p[0] === '[' && (p.trim()[p.trim().length - 1] !== ']' && this._load_array_isstrarray(p))) {
            let newp = p.slice(1).trim().split(',');
            while (newp.length > 1 && !['"', "'"].includes(newp[newp.length - 1][0])) {
                newp = [...newp.slice(0, -2), newp[newp.length - 2] + ',' + newp[newp.length - 1]];
            }
            newp = newp[newp.length - 1];
            poffset = p.length - newp.length;
            p = newp;
        }
        if (p[0] !== '"' && p[0] !== "'") {
            return [-1, poffset];
        }
        if (p[1] !== p[0] || p[2] !== p[0]) {
            return [-1, poffset];
        }
        if (p.length > 5 && p[p.length - 1] === p[0] && p[p.length - 2] === p[0] && p[p.length - 3] === p[0]) {
            return [-1, poffset];
        }
        return [p.length - 1, poffset];
    }

    load_value(v, strictly_valid = true) {
        function handle_remaining () {
            if (parsed_date !== null) {
                return [parsed_date, "date"];
            }
            if (!strictly_valid) {
                throw new Error("Weirdness with leading zeroes or underscores in your number.");
            }
            let itype = "int";
            let neg = false;
            if (v[0] === '-') {
                neg = true;
                v = v.slice(1);
            } else if (v[0] === '+') {
                v = v.slice(1);
            }
            v = v.replace(/_/g, '');
            let lowerv = v.toLowerCase();
            if (lowerv.includes('.') || (!lowerv.includes('x') && (lowerv.includes('e') || lowerv.includes('E')))) {
                if (lowerv.includes('.') && v.split('.', 2)[1] === '') {
                    throw new Error("This float is missing digits after the point");
                }
                if (!'0123456789'.includes(v[0])) {
                    throw new Error("This float doesn't have a leading digit");
                }
                v = parseFloat(v);
                itype = "float";
            } else if (lowerv.length === 3 && (lowerv === 'inf' || lowerv === 'nan')) {
                v = parseFloat(v);
                itype = "float";
            }
            if (itype === "int") {
                v = parseInt(v, 0);
            }
            if (neg) {
                return [0 - v, itype];
            }
            return [v, itype];
        };

        if (!v) {
            throw new Error("Empty value is invalid");
        }
        if (v === 'true') {
            var _return_value = [true, "bool"];
            return _return_value;
        } else if (v.toLowerCase() === 'true') {
            throw new Error("Only all lowercase booleans allowed");
        } else if (v === 'false') {
            var _return_value = [false, "bool"];
            return _return_value;
        } else if (v.toLowerCase() === 'false') {
            throw new Error("Only all lowercase booleans allowed");
        } else if (v[0] === '"' || v[0] === "'") {
            var quotechar = v[0];
            var testv = v.slice(1).split(quotechar);
            var triplequote = false;
            var triplequotecount = 0;
            if (testv.length > 1 && testv[0] === '' && testv[1] === '') {
                testv = testv.slice(2);
                triplequote = true;
            }
            var closed = false;
            for (var tv of testv) {
                if (tv === '') {
                    if (triplequote) {
                        triplequotecount += 1;
                    } else {
                        closed = true;
                    }
                } else {
                    var oddbackslash = false;
                    try {
                        var i = -1;
                        var j = tv[tv.length + i];
                        while (j === '\\') {
                            oddbackslash = !oddbackslash;
                            i -= 1;
                            j = tv[i];
                        }
                    } catch (error) {
                        // Ignore IndexError
                    }
                    if (!oddbackslash) {
                        if (closed) {
                            throw new Error("Found tokens after a closed string. Invalid TOML.");
                        } else {
                            if (!triplequote || triplequotecount > 1) {
                                closed = true;
                            } else {
                                triplequotecount = 0;
                            }
                        }
                    }
                }
            }
    
            if (quotechar === '"') {
                var escapeseqs = v.split('\\').slice(1);
                var backslash = false;
                for (var i of escapeseqs) {
                    if (i === '') {
                        backslash = !backslash;
                    } else {
                        if (!_escapes.includes(i[0]) && (i[0] !== 'u' && i[0] !== 'U' && !backslash)) {
                            throw new Error("Reserved escape sequence used");
                        }
                        if (backslash) {
                            backslash = false;
                        }
                    }
                }
                for (var prefix of ["\\u", "\\U"]) {
                    if (v.includes(prefix)) {
                        var hexbytes = v.split(prefix);
                        v = _load_unicode_escapes(hexbytes[0], hexbytes.slice(1), prefix);
                    }
                }
                v = _unescape(v); // Assuming _unescape is similar to unescape
            }
            if (v.length > 1 && v[1] === quotechar && (v.length < 3 || v[1] === v[2])) {
                v = v.slice(2, -2);
            }
            var _return_value = [v.slice(1, -1), "str"];
            return _return_value;
        } else if (v[0] === '[') {
            var _return_value = [this.load_array(v), "array"]; // Assuming load_array is defined
            return _return_value;
        } else if (v[0] === '{') {
            var inline_object = this.get_empty_inline_table(); // Assuming get_empty_inline_table is defined
            this.load_inline_object(v, inline_object, false, false); // Assuming load_inline_object is defined
            var _return_value = [inline_object, "inline_object"];
            return _return_value;
        } else if (TIME_RE.test(v)) {
            var matches = TIME_RE.exec(v);
            var h = matches[1], m = matches[2], s = matches[3], ms = matches[5] || 0;
            var time = new Date(0, 0, 0, h, m, s, ms);
            var _return_value = [time, "time"];
            return _return_value;
        } else {
            var parsed_date = _load_date(v);
            return handle_remaining();
        }
    }

    bounded_string(s) {
        if (s.length === 0) {
            return true;
        }
        if (s[s.length - 1] !== s[0]) {
            return false;
        }
        let i = -2;
        let backslash = false;
        while (s.length + i > 0) {
            if (s[i] === "\\") {
                backslash = !backslash;
                i--;
            } else {
                break;
            }
        }
        return !backslash;
    }

    _load_array_isstrarray(a) {
        a = a.slice(1, -1).trim();
        if (a !== '' && (a[0] === '"' || a[0] === "'")) {
            return true;
        }
        return false;
    }

    load_array(a) {
        let retval = [];
        a = a.trim();
        if (a.slice(1, -1).includes('[') && a.slice(1, -1).split('[')[0].trim() !== "") {
            let strarray = this._load_array_isstrarray(a);
            if (!a.slice(1, -1).trim().startsWith('{')) {
                a = a.slice(1, -1).split(',');
            } else {
                // a is an inline object, we must find the matching parenthesis
                // to define groups
                let new_a = [];
                let start_group_index = 1;
                let end_group_index = 2;
                let open_bracket_count = a[start_group_index] === '{' ? 1 : 0;
                let in_str = false;
                while (end_group_index < a.slice(1).length) {
                    if (a[end_group_index] === '"' || a[end_group_index] === "'") {
                        if (in_str) {
                            let backslash_index = end_group_index - 1;
                            while (backslash_index > -1 && a[backslash_index] === '\\') {
                                in_str = !in_str;
                                backslash_index--;
                            }
                        }
                        in_str = !in_str;
                    }
                    if (!in_str && a[end_group_index] === '{') {
                        open_bracket_count++;
                    }
                    if (in_str || a[end_group_index] !== '}') {
                        end_group_index++;
                        continue;
                    } else if (a[end_group_index] === '}' && open_bracket_count > 1) {
                        open_bracket_count--;
                        end_group_index++;
                        continue;
                    }

                    // Increase end_group_index by 1 to get the closing bracket
                    end_group_index++;

                    new_a.push(a.slice(start_group_index, end_group_index));

                    // The next start index is at least after the closing
                    // bracket, a closing bracket can be followed by a comma
                    // since we are in an array.
                    start_group_index = end_group_index + 1;
                    while (start_group_index < a.slice(1).length && a[start_group_index] !== '{') {
                        start_group_index++;
                    }
                    end_group_index = start_group_index + 1;
                }
                a = new_a;
            }
            let b = 0;
            if (strarray) {
                while (b < a.length - 1) {
                    let ab = a[b].trim();
                    while (!this.bounded_string(ab) || (ab.length > 2 && ab[0] === ab[1] === ab[2] && ab[ab.length - 2] !== ab[0] && ab[ab.length - 3] !== ab[0])) {
                        a[b] = a[b] + ',' + a[b + 1];
                        ab = a[b].trim();
                        if (b < a.length - 2) {
                            a = [...a.slice(0, b + 1), ...a.slice(b + 2)];
                        } else {
                            a = a.slice(0, b + 1);
                        }
                    }
                    b++;
                }
            }
        } else {
            let al = Array.from(a.slice(1, -1));
            a = [];
            let openarr = 0;
            let j = 0;
            for (let i = 0; i < al.length; i++) {
                if (al[i] === '[') {
                    openarr++;
                } else if (al[i] === ']') {
                    openarr--;
                } else if (al[i] === ',' && !openarr) {
                    a.push(al.slice(j, i).join(''));
                    j = i + 1;
                }
            }
            a.push(al.slice(j).join(''));
        }
        for (let i = 0; i < a.length; i++) {
            a[i] = a[i].trim();
            if (a[i] !== '') {
                let [nval, ntype] = this.load_value(a[i]);
                retval.p
            }
        }
    }

    preserve_comment(line_no, key, comment, beginline){
        return null;    
    }
    
    embed_comments(idx, currentlevel){
        return null;    
    }
}
class TomlPreserveCommentDecoder extends TomlDecoder {

    constructor(_dict = func_dict) {
        super(_dict);
        this.saved_comments = {};
    }

    preserve_comment(line_no, key, comment, beginline) {
        this.saved_comments[line_no] = { key, comment, beginline };
    }

    embed_comments(idx, currentlevel) {
        if (!(idx in this.saved_comments)) {
            return;
        }

        const { key, comment, beginline } = this.saved_comments[idx];
        currentlevel[key] = new CommentValue(currentlevel[key], comment, beginline, this._dict);
    }

}
function dump(o, f, encoder = null) {
    /**
     * Writes out object as toml to a file
     *
     * @param {Object} o - Object to dump into toml
     * @param {Object} f - File descriptor where the toml should be stored
     * @param {Object} encoder - The encoder to use for constructing the output string
     * @returns {string} - String containing the toml corresponding to dictionary
     * @throws {TypeError} - When anything other than file descriptor is passed
     */

    if (typeof f.write !== 'function') {
        throw new TypeError("You can only dump an object to a file descriptor");
    }
    let d = dumps(o, encoder); // Assuming `dumps` is a function similar to Python's `toml.dumps`
    f.write(d);
    return d;
}
function dumps(o, encoder = null) {
    let retval = "";
    if (encoder === null) {
        encoder = new TomlEncoder(o.constructor);
    }
    let [addtoretval, sections] = encoder.dump_sections(o, "");
    retval += addtoretval;
    while (Object.keys(sections).length > 0) {
        let newsections = encoder.get_empty_table();
        for (let section in sections) {
            [addtoretval, addtosections] = encoder.dump_sections(sections[section], section);

            if (addtoretval || (!addtoretval && Object.keys(addtosections).length === 0)) {
                if (retval && !retval.endsWith("\n\n")) {
                    retval += "\n";
                }
                retval += "[" + section + "]\n";
                if (addtoretval) {
                    retval += addtoretval;
                }
            }
            for (let s in addtosections) {
                newsections[section + "." + s] = addtosections[s];
            }
        }
        sections = newsections;
    }
    return retval;
}
function _dump_str(v) {
    v = JSON.stringify(v);
    if (v[0] === 'u') {
        v = v.slice(1);
    }
    let singlequote = v.startsWith("'");
    if (singlequote || v.startsWith('"')) {
        v = v.slice(1, -1);
    }
    if (singlequote) {
        v = v.replace("\\'", "'");
        v = v.replace('"', '\\"');
    }
    v = v.split("\\x");
    while (v.length > 1) {
        let i = -1;
        if (!v[0]) {
            v = v.slice(1);
        }
        v[0] = v[0].replace("\\\\", "\\");
        let joinx = v[0][i] !== "\\";
        while (v[0].slice(0, i) && v[0][i] === "\\") {
            joinx = !joinx;
            i -= 1;
        }
        let joiner = joinx ? "x" : "u00";
        v = [v[0] + joiner + v[1]].concat(v.slice(2));
    }
    return '"' + v[0] + '"';
}
function _dump_float(v) {
    return v.toString().replace("e+0", "e+").replace("e-0", "e-");
}
function _dump_time(v) {
    let utcoffset = v.getTimezoneOffset();
    if (utcoffset === 0) {
        return v.toISOString();
    }
    // The TOML norm specifies that it's local time thus we drop the offset
    return v.toISOString().slice(0, -6);
}
function _dump_bool(v) {
    return String(v).toLowerCase();
}
function _dump_int(v) {
    return v;
}
function _dump_datetime(v) {
    return v.toISOString().replace('+00:00', 'Z');
}
function _dump_date(v) {
    return v.toISOString();
}
class TomlEncoder {

    constructor(_dict = func_dict, preserve = false) {
        this._dict = _dict;
        this.preserve = preserve;
        this.dump_funcs = {
            "str": _dump_str,
            "list": this.dump_list.bind(this),
            "bool": _dump_bool,
            "int": _dump_int,
            "float": _dump_float,
        };
    }

    get_empty_table() {
        return this._dict();
    }

    dump_list(v) {
        let retval = "[";
        for (let u of v) {
            retval += " " + String(this.dump_value(u)) + ",";
        }
        retval += "]";
        return retval;
    }

    dump_inline_table(section) {
        let retval = "";
        if (section instanceof Object && !(section instanceof Array)) {
            let val_list = [];
            for (let k in section) {
                let v = section[k];
                let val = this.dump_inline_table(v);
                val_list.push(k + " = " + val);
            }
            retval += "{ " + val_list.join(", ") + " }\n";
            return retval;
        } else {
            return String(this.dump_value(section));
        }
    }

    dump_value(v) {
        let dump_fn = null;
        for (let t in this.dump_funcs) {
            if ((t === "str" && typeof v === "string") ||
                (t === "list" && Array.isArray(v)) ||
                (t === "bool" && typeof v === "boolean") ||
                (t === "int" && Number.isInteger(v)) ||
                (t === "float" && typeof v === "number") ||
                (t === "CommentValue" && v instanceof CommentValue)) {
                dump_fn = this.dump_funcs[t];
                break;
            }
        }

        if (dump_fn === null && v !== null && typeof v === 'object' && Symbol.iterator in v) {
            dump_fn = this.dump_funcs["list"];
        }
        return dump_fn !== null ? dump_fn(v) : this.dump_funcs["str"](v);
    }

    dump_sections(o, sup) {
        var retstr = "";
        if (sup !== "" && sup.slice(-1) !== ".") {
            sup += '.';
        }
        var retdict = this._dict();
        var arraystr = "";
        for (var section in o) {
            section = String(section);
                var qsection = section;
                if (!/^[A-Za-z0-9_-]+$/.test(section)) {
                    qsection = _dump_str(section);
                }
        
                if (o[section]._class_name === "CommentValue" || (!(o[section] instanceof Object) || o[section].constructor.name === "Date") || Array.isArray(o[section])) {
                    var arrayoftables = false;
                    if (Array.isArray(o[section])) {
                        for (var a of o[section]) {
                            if (a instanceof Object && !Array.isArray(a)) {
                                arrayoftables = true;
                            }
                        }
                    }
        
                    if (arrayoftables) {
                        for (var a of o[section]) {
                            var arraytabstr = "\n";
                            arraystr += "[[" + sup + qsection + "]]\n";
                            var [s, d] = this.dump_sections(a, sup + qsection);
                            if (s) {
                                if (s[0] === "[") {
                                    arraytabstr += s;
                                } else {
                                    arraystr += s;
                                }
                            }
                            while (Object.keys(d).length !== 0) {
                                var newd = this._dict();
                                for (var dsec in d) {
                                    var [s1, d1] = this.dump_sections(d[dsec], sup + qsection + "." + dsec);
                                    if (s1) {
                                        arraytabstr += ("[" + sup + qsection + "." + dsec + "]\n");
                                        arraytabstr += s1;
                                    }
                                    for (var s1 in d1) {
                                        newd[dsec + "." + s1] = d1[s1];
                                    }
                                }
                                d = newd;
                            }
                            arraystr += arraytabstr;
                        }
                    } else {
                        if (o[section] !== null) {
                            retstr += (qsection + " = " + String(this.dump_value(o[section])) + '\n');
                        }
                    }
                } else if (this.preserve && (o[section] instanceof Object)) {
                    retstr += (qsection + " = " + this.dump_inline_table(o[section]));
                } else {
                    retdict[qsection] = o[section];
                }
        }
        retstr += arraystr;
        return [retstr, retdict];
    }
}
class TomlPreserveInlineDictEncoder extends TomlEncoder {

    constructor(_dict = func_dict) {
        super(_dict, true);
    }

}
class TomlArraySeparatorEncoder extends TomlEncoder {

    constructor(_dict = func_dict, preserve = false, separator = ",") {
        super(_dict, preserve);
        if (separator.trim() === "") {
            separator = "," + separator;
        } else if (separator.trim().replace(/[\s,]/g, '')) {
            throw new Error("Invalid separator for arrays");
        }
        this.separator = separator;
    }

    dump_list(v) {
        let t = [];
        let retval = "[";
        for (let u of v) {
            t.push(this.dump_value(u));
        }
        while (t.length !== 0) {
            let s = [];
            for (let u of t) {
                if (Array.isArray(u)) {
                    for (let r of u) {
                        s.push(r);
                    }
                } else {
                    retval += " " + String(u) + this.separator;
                }
            }
            t = s;
        }
        retval += "]";
        return retval;
    }

}
class TomlNumpyEncoder extends TomlEncoder {

    constructor(_dict = func_dict, preserve = false) {
        super(_dict, preserve);
        const np = require('numpy'); // Assuming an equivalent 'numpy' module exists in JS environment
        this.dump_funcs[np.float16] = this._dump_float;
        this.dump_funcs[np.float32] = this._dump_float;
        this.dump_funcs[np.float64] = this._dump_float;
        this.dump_funcs[np.int16] = this._dump_int;
        this.dump_funcs[np.int32] = this._dump_int;
        this.dump_funcs[np.int64] = this._dump_int;
    }

    _dump_int(v) {
        return `${parseInt(v)}`;
    }

}
class TomlPreserveCommentEncoder extends TomlEncoder {

    constructor(_dict = func_dict, preserve = false) {
        super(_dict, preserve);
        this.dump_funcs["CommentValue"] = (v) => v.dump(this.dump_value);
    }

}
class TomlPathlibEncoder extends TomlEncoder {

    _dump_pathlib_path(v) {
        return this._dump_str(String(v));
    }

    dump_value(v) {
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            const pathlib = require('path');
            if (pathlib.PurePath && v instanceof pathlib.PurePath) {
                v = String(v);
            }
        }
        return super.dump_value(v);
    }

}
class TomlOrderedDecoder extends TomlDecoder {
    constructor() {
        super({ _dict: new Map() });
    }
}
class TomlOrderedEncoder extends TomlEncoder {
    constructor() {
        super();
        this._dict = new Map();
    }
}
class TomlTz {
    constructor(toml_offset) {
        if (toml_offset === "Z") {
            this._raw_offset = "+00:00";
        } else {
            this._raw_offset = toml_offset;
        }
        this._sign = this._raw_offset[0] === '-' ? -1 : 1;
        this._hours = parseInt(this._raw_offset.substring(1, 3));
        this._minutes = parseInt(this._raw_offset.substring(4, 6));
    }

    tzname(dt) {
        return "UTC" + this._raw_offset;
    }

    utcoffset(dt) {
        return this._sign * (this._hours * 60 + this._minutes) * 60000; // Convert to milliseconds
    }

    dst(dt) {
        return 0; // Return 0 milliseconds for no daylight saving time
    }
}
function convert(v) {
    if (Array.isArray(v)) {
        return v.map(vv => convert(vv));
    } else if (v['type'] === undefined || v['value'] === undefined) {
        let result = {};
        for (let [k, vv] of Object.entries(v)) {
            result[k] = convert(vv);
        }
        return result;
    } else if (v['type'] === 'string') {
        return v['value'];
    } else if (v['type'] === 'integer') {
        return parseInt(v['value']);
    } else if (v['type'] === 'float') {
        return parseFloat(v['value']);
    } else if (v['type'] === 'bool') {
        return v['value'] === 'true';
    } else if (['datetime', 'datetime-local', 'date-local', 'time-local'].includes(v['type'])) {
        return new Date(v['value']);
    } else {
        throw new Error(`unknown type: ${v['type']}`);
    }
}
function tag(value) {
    if (value instanceof Object && !(value instanceof Array) && !(value instanceof Date) && !(value instanceof String) && !(value instanceof Boolean) && !(value instanceof Number)) {
        var _return_value = {};
        for (var k in value) {
            if (value.hasOwnProperty(k)) {
                _return_value[k] = tag(value[k]);
            }
        }
        return _return_value;
    } else if (value instanceof Array) {
        var _return_value = value.map(function(v) { return tag(v); });
        return _return_value;
    } else if (typeof value === 'string') {
        var _return_value = {'type': 'string', 'value': value};
        return _return_value;
    } else if (typeof value === 'boolean') {
        var _return_value = {'type': 'bool', 'value': value.toString().toLowerCase()};
        return _return_value;
    } else if (typeof value === 'number' && Number.isSafeInteger(value) && value !== 1000000) {
        var _return_value = {'type': 'integer', 'value': value.toString()};
        return _return_value;
    } else if (typeof value === 'number' && (!Number.isSafeInteger(value) || value === 1000000)) {
        if (value === Infinity) {
            var _return_value = {'type': 'float', 'value': "inf"};
        }
        else if (Number.isSafeInteger(value)) {
            var _return_value = {'type': 'float', 'value': value.toString() + '.0'};
        }
        else{
            var _return_value = {'type': 'float', 'value': value.toString()};
        }
        return _return_value;
    } else if (value instanceof Date) {
        
        if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0) {
            var _return_value = {'type': 'date-local', 'value': value.toISOString().substring(0, 10)};
        } 
        else if (value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0) {
            var _tzinfo = value.tz.utcoffset("0")[0];
            if (_tzinfo === 0){
                var _return_value = {'type': 'datetime', 'value': value.toISOString().substring(0, 19) + "Z"};
            }
            else{
                var offset = _tzinfo / 3600 / 1000;
                var _return_value = {'type': 'datetime', 'value': value.toISOString().substring(0, 19) + "-0" + (-offset).toString() +  ":00"};
            }
        }
        else{
            var _tzinfo = value.tz.utcoffset("0")[0];
            var offset = _tzinfo / 3600 / 1000;
            var _return_value = {'type': 'datetime', 'value': value.toISOString().substring(0, 19) + "-0" + (-offset).toString() +  ":00"};
        }
        return _return_value;
    } else {
        throw new Error('Unknown type: ' + (typeof value));
    }
}
function tester(name) {
    decode_input = tool_functions.get_input(name)
    decode_result = loads(decode_input, func_dict, null)
    decode_result = tag(decode_result)

    var encode_input = {};
    for (var k in decode_result) {
        if (decode_result.hasOwnProperty(k)) {
            var v = convert(decode_result[k]);
            encode_input[k] = v;
        }
    }

    encode_result = dumps(encode_input, null)
    console.log(encode_result);
}
function test_bug_148() {
    assert('a = "\\u0064"\n' === JSON.stringify({'a': '\\x64'}));
    assert('a = "\\\\x64"\n' === JSON.stringify({'a': '\\\\x64'}));
    assert('a = "\\\\\\u0064"\n' === JSON.stringify({'a': '\\\\\\x64'}));
}
function test__dict() {
    if (!(loads(TEST_STR, { _dict: func_dict }) instanceof Object)) {
        throw new Error("Assertion failed");
    }
}
function test_dict_decoder() {
    let _test_dict_decoder = new TomlDecoder(func_dict);
    if (!(JSON.parse(TEST_STR, _test_dict_decoder) instanceof Object)) {
        throw new Error("Assertion failed");
    }
}
function test_array_sep() {
    let encoder = new TomlArraySeparatorEncoder({separator: ",\t"});
    let d = {a: [1, 2, 3]};
    let tmp = dumps(d, {encoder: encoder});
    let o = loads(tmp);
    let tmp2 = dumps(o, {encoder: encoder});
    if (JSON.stringify(o) !== JSON.stringify(loads(tmp2))) {
        throw new Error("Assertion failed");
    }
}
function test_tuple() {
    let d = {"a": [3, 4]};
    let encoder = new TomlEncoder(func_dict);
    let tmp = encoder.dumps(d);
    let o = encoder.loads(tmp);
    let tmp2 = encoder.dumps(o);
    if (JSON.stringify(o) !== JSON.stringify(encoder.loads(tmp2))) {
        throw new Error("Assertion failed");
    }
}
function test_commutativity() {
    let encoder = new TomlEncoder(func_dict);
    let tmp = dumps(TEST_DICT, encoder);
    let o = loads(tmp);
    let tmp2 = dumps(o, encoder);
    console.assert(JSON.stringify(o) === JSON.stringify(loads(tmp2)));
}
function test_comment_preserve_decoder_encoder() {
    let tmp = loads(tool_functions.test_str, { decoder: TomlPreserveCommentDecoder() });
    let s = dumps(tmp, { encoder: TomlPreserveCommentEncoder() });
    if (s.length === tool_functions.test_str.length && sorted(tool_functions.test_str) === sorted(s)) {
        return true;
    } else {
        return false;
    }
}
function test() {
    tester("Comment");
    tester("Boolean");
    tester("Integer");
    tester("Float");
    tester("Table");
    tester("Inline Table");
    tester("String");
    tester("Array");
    tester("Array of Tables");
    test_bug_148();
    test__dict();
    test_dict_decoder();
    test_array_sep();
    test_tuple();
    test_commutativity();
    test_comment_preserve_decoder_encoder();
    additional_test();
    additional_test2();
    additional_test3();
    additional_test4();
    additional_test5();
}
function unichr(s) {
    return String.fromCharCode(s);
}
function additional_test() {
    let decoder = new TomlDecoder(func_dict);
    let cur = {};
    let multikey = false;
    let multibackslash = false;
    decoder.load_line("'a.x'=2=3", cur, multikey, multibackslash);
    console.assert(JSON.stringify(cur) === JSON.stringify({'a.x': {'=2': 3}}));
}
function additional_test2() {
    let decoder = new TomlDecoder(func_dict);
    let input_str = "[{'x' = 1}]";
    let res = decoder.load_array(input_str);
    console.assert(JSON.stringify(res) === JSON.stringify([{x: 1}]));
    input_str = "[{'x' = 1}, {'y' = 2}]";
    res = decoder.load_array(input_str);
    console.assert(JSON.stringify(res) === JSON.stringify([{x: 1}, {y: 2}]));
}
function additional_test3() {
    let v = "abc\\";
    let hexbytes = ['0064'];
    let prefix = 'u';
    let res = _load_unicode_escapes(v, hexbytes, prefix);
    console.assert(res === 'abc\\u0064');
}
function additional_test4() {
    let v = "\\\\";
    let res = _unescape(v);
    console.assert(res === '\\');
    v = "\\u";
    res = _unescape(v);
    console.assert(res === '\\u');
}
function additional_test5() {
    let s = `['"test"']`;
    let t = JSON.parse(s);
    console.assert(JSON.stringify(t) === JSON.stringify({'"test"': {}}));
    s = `["abc"]`;
    t = JSON.parse(s);
    console.assert(JSON.stringify(t) === JSON.stringify({'abc': {}}));
}

// Global Begin

var TIME_RE = new RegExp("^([0-9]{2}):([0-9]{2}):([0-9]{2})(\\.([0-9]{3,6}))?$");

var _number_with_underscores = new RegExp('([0-9])(_([0-9]))*');

var _groupname_re = new RegExp('^[A-Za-z0-9_-]+$');

var _escapes = [0, 'b', 'f', 'n', 'r', 't', '"'];
var _escapedchars = ['\0', '\b', '\f', '\n', '\r', '\t', '\"'];
var _escape_to_escapedchars = {};
for (var index = 0; index < _escapes.length; index++) {
    _escape_to_escapedchars[_escapes[index]] = _escapedchars[index];
}

TEST_STR = `
[a]\r
b = 1\r
c = 2
`

TEST_DICT = {"a": {"b": 1, "c": 2}}

test();
