var {get_input, user_infinite_counter, expected_output1, expected_output2, expected_output3, expected_output4} = require('./tracer_skip.js');
var tool_functions = {"get_input": get_input, "user_infinite_counter": user_infinite_counter, "expected_output1": expected_output1, "expected_output2": expected_output2, "expected_output3": expected_output3, "expected_output4": expected_output4};

class SYSTEM_TOKENS {
    static EndOfStreamToken = 0x00;
    static OpenStartElementToken = 0x01;
    static CloseStartElementToken = 0x02;
    static CloseEmptyElementToken = 0x03;
    static CloseElementToken = 0x04;
    static ValueToken = 0x05;
    static AttributeToken = 0x06;
    static CDataSectionToken = 0x07;
    static EntityReferenceToken = 0x08;
    static ProcessingInstructionTargetToken = 0x0A;
    static ProcessingInstructionDataToken = 0x0B;
    static TemplateInstanceToken = 0x0C;
    static NormalSubstitutionToken = 0x0D;
    static ConditionalSubstitutionToken = 0x0E;
    static StartOfStreamToken = 0x0F;
}
const NODE_TYPES = {
    NULL: 0x00,
    WSTRING: 0x01,
    STRING: 0x02,
    SIGNED_BYTE: 0x03,
    UNSIGNED_BYTE: 0x04,
    SIGNED_WORD: 0x05,
    UNSIGNED_WORD: 0x06,
    SIGNED_DWORD: 0x07,
    UNSIGNED_DWORD: 0x08,
    SIGNED_QWORD: 0x09,
    UNSIGNED_QWORD: 0x0A,
    FLOAT: 0x0B,
    DOUBLE: 0x0C,
    BOOLEAN: 0x0D,
    BINARY: 0x0E,
    GUID: 0x0F,
    SIZE: 0x10,
    FILETIME: 0x11,
    SYSTEMTIME: 0x12,
    SID: 0x13,
    HEX32: 0x14,
    HEX64: 0x15,
    BXML: 0x21,
    WSTRINGARRAY: 0x81
};
class memoize {
    /** cache the return value of a method

    This class is meant to be used as a decorator of methods. The return value
    from a given method invocation will be cached on the instance whose method
    was invoked. All arguments passed to a method decorated with memoize must
    be hashable.

    If a memoized method is invoked directly on its class the result will not
    be cached. Instead the method will be invoked like a static method:
    class Obj {
        add_to(arg) {
            return this + arg;
        }
    }
    Obj.add_to(1); // not enough arguments
    Obj.add_to(1, 2); // returns 3, result is not cached
    */

    constructor(func) {
        this.func = func;
    }

    get(target, thisArg, argArray) {
        if (thisArg === undefined) {
            return this.func;
        }
        return this.func.bind(thisArg);
    }

    apply(target, thisArg, argArray) {
        if (!thisArg.__cache) {
            thisArg.__cache = new Map();
        }
        let key = [this.func, ...argArray, Object.entries(arguments[2] || {})].toString();
        if (!thisArg.__cache.has(key)) {
            thisArg.__cache.set(key, this.func.apply(thisArg, argArray));
        }
        return thisArg.__cache.get(key);
    }
}

function align(offset, alignment) {
    if (offset % alignment === 0) {
        return offset;
    }
    return offset + (alignment - (offset % alignment));
}
function dosdate(dosdate, dostime) {
    try {
        let t = dosdate.charCodeAt(1) << 8;
        t |= dosdate.charCodeAt(0);
        let day = t & 0b0000000000011111;
        let month = (t & 0b0000000111100000) >> 5;
        let year = (t & 0b1111111000000000) >> 9;
        year += 1980;

        t = dostime.charCodeAt(1) << 8;
        t |= dostime.charCodeAt(0);
        let sec = t & 0b0000000000011111;
        sec *= 2;
        let minute = (t & 0b0000011111100000) >> 5;
        let hour = (t & 0b1111100000000000) >> 11;

        return new Date(year, month - 1, day, hour, minute, sec);
    } catch (e) {
        return new Date(-8640000000000000); // JavaScript's Date equivalent to datetime.datetime.min
    }
}
function parse_filetime(qword) {
    if (qword === 0) {
        return new Date(-8640000000000000); // JavaScript's earliest date
    }

    try {
        return new Date((qword * 1e-7 - 11644473600) * 1000);
    } catch (e) {
        if (e instanceof RangeError) {
            return new Date(-8640000000000000); // JavaScript's earliest date
        }
        throw e; // Re-throw the error if it's not a RangeError
    }
}
class BinaryParserException extends Error {
    /**
     * Constructor.
     * @param {string} value - A string description.
     */
    constructor(value) {
        super();
        this._value = value;
        this.name = "BinaryParserException";
    }

    /**
     * Returns a string representation of the error.
     */
    toString() {
        return `Binary Parser Exception: ${this._value}`;
    }
}
class ParseException extends BinaryParserException {
    /**
     * An exception to be thrown during binary parsing, such as
     * when an invalid header is encountered.
     * 
     * @param {string} value - A string description.
     */
    constructor(value) {
        super(value);
    }

    /**
     * Returns a string representation of the exception.
     * 
     * @returns {string}
     */
    toString() {
        return `Parse Exception(${this._value})`;
    }
}
class OverrunBufferException extends Error {
    constructor(readOffs, bufLen) {
        let tvalue = `read: ${readOffs.toString(16)}, buffer length: ${bufLen.toString(16)}`;
        super(tvalue);
        this._value = tvalue;
    }

    toString() {
        return `Tried to parse beyond the end of the file (${this._value})`;
    }

    [Symbol.toPrimitive]() {
        return `OverrunBufferException(${this._value})`;
    }
}
class Block {
    /**
     * Base class for structure blocks in binary parsing.
     * A block is associated with an offset into a byte-string.
     */
    constructor(buf, offset) {
        /**
         * Constructor.
         * Arguments:
         * - `buf`: Byte string containing stuff to parse.
         * - `offset`: The offset into the buffer at which the block starts.
         */
        this._buf = buf;
        this._offset = offset;
        this._implicit_offset = 0;
    }

    toString() {
        return `Block(buf=${this._buf}, offset=${this._offset})`;
    }

    declare_field(type, name, offset = null, length = null) {
        function no_length_handler(){
            var f = this["unpack_" + type].bind(this);
            return f(offset);
        }
        
        function explicit_length_handler(){
            var f = this["unpack_" + type].bind(this);
            return f(offset, length);
        }
        
        if (offset === null) {
            offset = this._implicit_offset;
        }
        if (length === null) {
            this[name] = no_length_handler.bind(this);
        } else {
            this[name] = explicit_length_handler.bind(this);
        }
        this["_off_" + name] = offset;
        if (type === "byte" || type === "int8") {
            this._implicit_offset = offset + 1;
        } else if (type === "word" || type === "word_be" || type === "int16") {
            this._implicit_offset = offset + 2;
        } else if (type === "dword" || type === "dword_be" || type === "int32" || type === "float" || type === "dosdate") {
            this._implicit_offset = offset + 4;
        } else if (type === "qword" || type === "int64" || type === "double" || type === "filetime" || type === "systemtime") {
            this._implicit_offset = offset + 8;
        } else if (type === "guid") {
            this._implicit_offset = offset + 16;
        } else if (type === "binary") {
            this._implicit_offset = offset + length;
        } else if (type === "string" && length !== null) {
            this._implicit_offset = offset + length;
        } else if (type === "wstring" && length !== null) {
            this._implicit_offset = offset + (2 * length);
        } else if (type.includes("string") && length === null) {
            throw new ParseException("Implicit offset not supported for dynamic length strings");
        } else {
            throw new ParseException("Implicit offset not supported for type: " + type);
        }    
    }

    current_field_offset() {
        return this._implicit_offset;
    }

    unpack_byte(offset){
var o = this._offset + offset;
try {
    var dataView = new DataView(this._buf.buffer);
    return dataView.getUint8(o);
} catch (error) {
    throw new OverrunBufferException(o, this._buf.length);
}    
    
    }
    
    unpack_word(offset){
var o = this._offset + offset;
try {
    var dataView = new DataView(this._buf.buffer);
    return dataView.getUint16(o, true); // true for little-endian
} catch (error) {
    throw new OverrunBufferException(o, this._buf.length);
}    
    
    }
    
    unpack_word_be(offset){
var o = this._offset + offset;
try {
    var dataView = new DataView(this._buf.buffer);
    return dataView.getUint16(o, false); // false for big-endian
} catch (error) {
    throw new OverrunBufferException(o, this._buf.length);
}    
    
    }
    
    
    unpack_dword(offset){
var o = this._offset + offset;
try {
    var dataView = new DataView(this._buf.buffer);
    return dataView.getUint32(o, true); // true for little-endian
} catch (error) {
    throw new OverrunBufferException(o, this._buf.length);
}    
    
    }
    
    unpack_dword_be(offset){
var o = this._offset + offset;
try {
    var dataView = new DataView(this._buf.buffer);
    return dataView.getUint32(o, false); // false for big-endian
} catch (error) {
    throw new OverrunBufferException(o, this._buf.length);
}    
    
    }
    
    unpack_int32(offset){
var o = this._offset + offset;
try {
    var dataView = new DataView(this._buf.buffer);
    return dataView.getInt32(o, true); // true for little-endian
} catch (error) {
    throw new OverrunBufferException(o, this._buf.length);
}    
    
    }
    
    unpack_qword(offset){
var o = this._offset + offset;
try {
    var dataView = new DataView(this._buf.buffer, o, 8); // Specify the offset and length directly in DataView
    return dataView.getUint32(0, true) + dataView.getUint32(4, true) * 0x100000000; // true for little-endian
} catch (error) {
    throw new Error(`OverrunBufferException at offset ${o} with buffer length ${this._buf.byteLength}`);
}
    }
    
    
    unpack_binary(offset, length){
if (!length) {
    return new Uint8Array().buffer;
}
var o = this._offset + offset;
try {
    var result = new Uint8Array(this._buf.slice(o, o + length));
    return Buffer.from(result);
} catch (error) {
    throw new OverrunBufferException(o, this._buf.byteLength);
}
    
    
    }
    
    unpack_string(offset, length){
return this.unpack_binary(offset, length).toString('ascii');    
    
    }
    
    unpack_wstring(offset, length){
var start = this._offset + offset;
var end = this._offset + offset + 2 * length;
try {
    return new TextDecoder("utf-16").decode(this._buf.slice(start, end));
} catch (e) {
    if (e instanceof TypeError) {
        return new TextDecoder("utf-16").decode(this._buf.slice(start, end));
    }
}    
    
    }
    
    
    unpack_filetime(offset){
        return parse_filetime(this.unpack_qword(offset));    
    }
    
    
    unpack_guid(offset){
        var o = this._offset + offset;
        var _bin;
        try {
            _bin = this._buf.slice(o, o + 16);
        } catch (e) {
            if (e instanceof RangeError) {
                throw new OverrunBufferException(o, this._buf.length);
            }
        }
        var h = [];
        for (var i = 0; i < _bin.length; i++) {
            h.push(_bin[i]);
        }
        return `${h[3].toString(16).padStart(2, '0')}${h[2].toString(16).padStart(2, '0')}${h[1].toString(16).padStart(2, '0')}${h[0].toString(16).padStart(2, '0')}-${h[5].toString(16).padStart(2, '0')}${h[4].toString(16).padStart(2, '0')}-${h[7].toString(16).padStart(2, '0')}${h[6].toString(16).padStart(2, '0')}-${h[8].toString(16).padStart(2, '0')}${h[9].toString(16).padStart(2, '0')}-${h[10].toString(16).padStart(2, '0')}${h[11].toString(16).padStart(2, '0')}${h[12].toString(16).padStart(2, '0')}${h[13].toString(16).padStart(2, '0')}${h[14].toString(16).padStart(2, '0')}${h[15].toString(16).padStart(2, '0')}`;    
    
    }

    // Additional unpack and pack methods would be similarly translated,
    // following the pattern established above, using DataView for binary data manipulation.

    absolute_offset(offset) {
        /**
         * Get the absolute offset from an offset relative to this block
         * Arguments:
         * - `offset`: The relative offset into this block.
         */
        return this._offset + offset;
    }

    offset() {
        /**
         * Equivalent to this.absolute_offset(0x0), which is the starting
         * offset of this block.
         */
        return this._offset;
    }
}

class SuppressConditionalSubstitution extends Error {
    /**
     * This exception is to be thrown to indicate that a conditional
     * substitution evaluated to NULL, and the parent element should
     * be suppressed. This exception should be caught at the first
     * opportunity, and must not propagate far up the call chain.
     *
     * Strategy:
     *   AttributeNode catches this, .xml() --> ""
     *   StartOpenElementNode catches this for each child, ensures
     *     there's at least one useful value. Or, .xml() --> ""
     */

    constructor(msg) {
        super(msg);
        this.name = 'SuppressConditionalSubstitution';
    }
}
class UnexpectedStateException extends ParseException {
    /**
     * UnexpectedStateException is an exception to be thrown when the parser
     * encounters an unexpected value or state. This probably means there
     * is a bug in the parser, but could stem from a corrupted input file.
     */
    constructor(msg) {
        super(msg);
    }
}
class BXmlNode extends Block {

    constructor(buf, offset, chunk, parent) {
        super(buf, offset);
        this._chunk = chunk;
        this._parent = parent;
    }

    toString() {
        return `BXmlNode(offset=${this.offset().toString(16)})`;
    }

    dump() {
        let b = this._buf.slice(this.offset(), this.offset() + this.length());
        return hexdump(b, { format: 'return' });
    }

    tag_length() {
        throw new Error(`tag_length not implemented for ${this}`);
    }

    _children(max_children = null, end_tokens = [0x00]) {
        let ret = [];
        let ofs = this.tag_length();

        let gen;
        if (max_children !== null) {
            gen = Array.from({length: max_children}, (_, i) => i);
        } else {
            gen = tool_functions.user_infinite_counter();
        }

        for (let _ of gen) {
            let token = this.unpack_byte(ofs) & 0x0F;
            try {
                let HandlerNodeClass = node_dispatch_table[token];
                let child = new HandlerNodeClass(this._buf, this.offset() + ofs, this._chunk, this);
                ret.push(child);
                ofs += child.length();
                if (end_tokens.includes(token)) {
                    break;
                }
                if (child.find_end_of_stream()) {
                    break;
                }
            } catch (error) {
                throw new Error(`Unexpected token ${token.toString(16).toUpperCase()} at ${this.absolute_offset(0x0) + ofs}`);
            }
        }
        return ret;
    }

    children() {
        return this._children();
    }

    length() {
        let ret = this.tag_length();
        for (let child of this.children()) {
            ret += child.length();
        }
        return ret;
    }

    find_end_of_stream() {
        for (let child of this.children()) {
            if (child instanceof EndOfStreamNode) {
                return child;
            }
            let ret = child.find_end_of_stream();
            if (ret) {
                return ret;
            }
        }
        return null;
    }
}

class NameStringNode extends BXmlNode {
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("dword", "next_offset", 0x0);
        this.declare_field("word", "hash");
        this.declare_field("word", "string_length");
        this.declare_field("wstring", "string", this.string_length());
    }

    toString() {
        return `NameStringNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, end=${(this.offset() + this.length()).toString(16)})`;
    }

    string() {
        return this._string.toString();
    }

    tag_length() {
        return (this.string_length() * 2) + 8;
    }

    length() {
        // two bytes unaccounted for...
        return this.tag_length() + 2;
    }
}
class TemplateNode extends BXmlNode {
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("dword", "next_offset", 0x0);
        this.declare_field("dword", "template_id");
        this.declare_field("guid", "guid", 0x04); // unsure why this overlaps
        this.declare_field("dword", "data_length");
    }

    toString() {
        return `TemplateNode(offset=${this.offset().toString(16)}, guid=${this.guid()}, length=${this.length().toString(16)})`;
    }

    tagLength() {
        return 0x18;
    }

    length() {
        return this.tagLength() + this.data_length;
    }
}
class EndOfStreamNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x00.
     *
     * This is the "end of stream" token. It may never actually
     * be instantiated here.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
    }

    toString() {
        return `EndOfStreamNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${0x00})`;
    }

    repr() {
        return `EndOfStreamNode(buf=${this._buf}, offset=${this.offset()}, chunk=${this._chunk}, parent=${this._parent})`;
    }

    flags() {
        return this.token() >> 4;
    }

    tag_length() {
        return 1;
    }

    length() {
        return 1;
    }

    children() {
        return [];
    }
}
class OpenStartElementNode extends BXmlNode {
    /**
    * The binary XML node for the system token 0x01.
    *
    * This is the "open start element" token.
    */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("word", "unknown0");
        // TODO(wb): use this size() field.
        this.declare_field("dword", "size");
        this.declare_field("dword", "string_offset");
        this._tag_length = 11;
        this._element_type = 0;

        if (this.flags() & 0x04) {
            this._tag_length += 4;
        }

        if (this.string_offset() > this.offset() - this._chunk._offset) {
            let new_string = this._chunk.add_string(this.string_offset(), parent=this);
            this._tag_length += new_string.length;
        }
    }

    toString() {
        return `OpenStartElementNode(offset=${this.offset().toString(16)}, name=${this.tag_name()}, length=${this.length().toString(16)}, token=${this.token().toString(16)}, end=${(this.offset() + this.length()).toString(16)}, taglength=${this.tag_length().toString(16)}, endtag=${(this.offset() + this.tag_length()).toString(16)})`;
    }

    is_empty_node() {
        for (let child of this.children()) {
            if (child instanceof CloseEmptyElementNode) {
                return true;
            }
        }
        return false;
    }

    flags() {
        return this.token() >> 4;
    }

    tag_name() {
        return this._chunk.strings()[this.string_offset()].string();
    }

    tag_length() {
        return this._tag_length;
    }

    verify() {
        return (this.flags() & 0x0B === 0) && (this.opcode() & 0x0F === 0x01);
    }

    children() {
        return this._children({end_tokens: [SYSTEM_TOKENS.CloseElementToken, SYSTEM_TOKENS.CloseEmptyElementToken]});
    }
}

class CloseStartElementNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x02.
     * 
     * This is the "close start element" token.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
    }

    toString() {
        return `CloseStartElementNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${this.token().toString(16)})`;
    }

    flags() {
        return this.token() >> 4;
    }

    tagLength() {
        return 1;
    }

    length() {
        return 1;
    }

    children() {
        return [];
    }

    verify() {
        return (this.flags() & 0x0F) === 0 && (this.opcode() & 0x0F) === 0x02;
    }
}
class CloseEmptyElementNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x03.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
    }

    toString() {
        return `CloseEmptyElementNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${(0x03).toString(16)})`;
    }

    repr() {
        return `CloseEmptyElementNode(buf=${this._buf}, offset=${this.offset()}, chunk=${this._chunk}, parent=${this._parent})`;
    }

    flags() {
        return this.token() >> 4;
    }

    tagLength() {
        return 1;
    }

    length() {
        return 1;
    }

    children() {
        return [];
    }
}
class CloseElementNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x04.
     *
     * This is the "close element" token.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
    }

    toString() {
        return `CloseElementNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${this.token().toString(16)})`;
    }

    repr() {
        return `CloseElementNode(buf=${this._buf}, offset=${this.offset()}, chunk=${this._chunk}, parent=${this._parent})`;
    }

    flags() {
        return this.token() >> 4;
    }

    tag_length() {
        return 1;
    }

    length() {
        return 1;
    }

    children() {
        return [];
    }

    verify() {
        return (this.flags() & 0x0F) === 0 && (this.opcode() & 0x0F) === 0x04;
    }
}

function get_variant_value(buf, offset, chunk, parent, type_, length = null) {
    /**
    * @return A VariantType subclass instance found in the given
    *   buffer and offset.
    */
    const types = {
        [NODE_TYPES.NULL]: NullTypeNode,
        [NODE_TYPES.WSTRING]: WstringTypeNode,
        [NODE_TYPES.STRING]: StringTypeNode,
        [NODE_TYPES.SIGNED_BYTE]: SignedByteTypeNode,
        [NODE_TYPES.UNSIGNED_BYTE]: UnsignedByteTypeNode,
        [NODE_TYPES.SIGNED_WORD]: SignedWordTypeNode,
        [NODE_TYPES.UNSIGNED_WORD]: UnsignedWordTypeNode,
        [NODE_TYPES.SIGNED_DWORD]: SignedDwordTypeNode,
        [NODE_TYPES.UNSIGNED_DWORD]: UnsignedDwordTypeNode,
        [NODE_TYPES.SIGNED_QWORD]: SignedQwordTypeNode,
        [NODE_TYPES.UNSIGNED_QWORD]: UnsignedQwordTypeNode,
        [NODE_TYPES.FLOAT]: FloatTypeNode,
        [NODE_TYPES.DOUBLE]: DoubleTypeNode,
        [NODE_TYPES.BOOLEAN]: BooleanTypeNode,
        [NODE_TYPES.BINARY]: BinaryTypeNode,
        [NODE_TYPES.GUID]: GuidTypeNode,
        [NODE_TYPES.SIZE]: SizeTypeNode,
        [NODE_TYPES.FILETIME]: FiletimeTypeNode,
        [NODE_TYPES.SYSTEMTIME]: SystemtimeTypeNode,
        [NODE_TYPES.SID]: SIDTypeNode,
        [NODE_TYPES.HEX32]: Hex32TypeNode,
        [NODE_TYPES.HEX64]: Hex64TypeNode,
        [NODE_TYPES.BXML]: BXmlTypeNode,
        [NODE_TYPES.WSTRINGARRAY]: WstringArrayTypeNode,
    };
    let TypeClass;
    try {
        TypeClass = types[type_];
    } catch (error) {
        throw new Error(`Type ${type_} not implemented`);
    }
    return new TypeClass(buf, offset, chunk, parent, { length });
}
class ValueNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x05.
     * 
     * This is the "value" token.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("byte", "type");
    }

    toString() {
        return `ValueNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${this.token().toString(16)}, value=${this.value().string()})`;
    }

    repr() {
        return `ValueNode(buf=${this._buf}, offset=${this.offset()}, chunk=${this._chunk}, parent=${this._parent})`;
    }

    flags() {
        return this.token() >> 4;
    }

    value() {
        return this.children()[0];
    }

    tagLength() {
        return 2;
    }

    children() {
        let child = getVariantValue(this._buf, this.offset() + this.tagLength(), this._chunk, this, this.type());
        return [child];
    }

    verify() {
        return (this.flags() & 0x0B === 0) && (this.token() & 0x0F === SYSTEM_TOKENS.ValueToken);
    }
}

class AttributeNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x06.
     * This is the "attribute" token.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("dword", "string_offset");

        this._name_string_length = 0;
        if (this.string_offset() > this.offset() - this._chunk._offset) {
            let new_string = this._chunk.add_string(this.string_offset(), parent);
            this._name_string_length += new_string.length;
        }
    }

    toString() {
        return `AttributeNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${this.token().toString(16)}, name=${this.attribute_name()}, value=${this.attribute_value()})`;
    }

    flags() {
        return this.token() >> 4;
    }

    attribute_name() {
        /**
         * @return A NameNode instance that contains the attribute name.
         */
        return this._chunk.strings()[this.string_offset()];
    }

    attribute_value() {
        /**
         * @return A BXmlNode instance that is one of (ValueNode,
           ConditionalSubstitutionNode, NormalSubstitutionNode).
         */
        return this.children()[0];
    }

    tag_length() {
        return 5 + this._name_string_length;
    }

    verify() {
        return (this.flags() & 0x0B) === 0 && (this.opcode() & 0x0F) === 0x06;
    }

    children() {
        return this._children({max_children: 1});
    }
}

class CDataSectionNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x07.
     * 
     * This is the "CDATA section" system token.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("word", "string_length");
        this.declare_field("wstring", "cdata", {length: this.string_length() - 2});
    }

    toString() {
        return `CDataSectionNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=0x07)`;
    }

    flags() {
        return this.token() >> 4;
    }

    tag_length() {
        return 0x3 + this.string_length();
    }

    length() {
        return this.tag_length();
    }

    children() {
        return [];
    }

    verify() {
        return this.flags() === 0x0 && (this.token() & 0x0F) === SYSTEM_TOKENS.CDataSectionToken;
    }
}
class CharacterReferenceNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x08.
     *
     * This is a character reference node. That is, something that represents
     * a non-XML character, e.g., & --> &#x0038;.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("word", "entity");
        this._tag_length = 3;
    }

    toString() {
        return `CharacterReferenceNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${(0x08).toString(16)})`;
    }

    repr() {
        return `CharacterReferenceNode(buf=${this._buf}, offset=${this.offset()}, chunk=${this._chunk}, parent=${this._parent})`;
    }

    entityReference() {
        return `&#x${this.entity().toString(16).padStart(4, '0')};`;
    }

    flags() {
        return this.token() >> 4;
    }

    tagLength() {
        return this._tag_length;
    }

    children() {
        return [];
    }
}
class EntityReferenceNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x09.
     *
     * This is an entity reference node. That is, something that represents
     * a non-XML character, eg. & --> &amp;.
     *
     * TODO(wb): this is untested.
     */

    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("dword", "string_offset");
        this._tag_length = 5;

        if (this.string_offset() > this.offset() - this._chunk.offset()) {
            let new_string = this._chunk.add_string(this.string_offset(), this);
            this._tag_length += new_string.length;
        }
    }

    toString() {
        return `EntityReferenceNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${0x09.toString(16)})`;
    }

    entity_reference() {
        return `&${this._chunk.strings()[this.string_offset()].string()};`;
    }

    flags() {
        return this.token() >> 4;
    }

    tag_length() {
        return this._tag_length;
    }

    children() {
        // TODO(wb): it may be possible for this element to have children.
        return [];
    }
}
class ProcessingInstructionTargetNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x0A.
     *
     * TODO(wb): untested.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("dword", "string_offset");
        this._tag_length = 5;

        if (this.string_offset() > this.offset() - this._chunk.offset()) {
            let new_string = this._chunk.add_string(this.string_offset(), this);
            this._tag_length += new_string.length;
        }
    }

    toString() {
        return `ProcessingInstructionTargetNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${0x0A.toString(16)})`;
    }

    processing_instruction_target() {
        return `<?${this._chunk.strings()[this.string_offset()].string()}`;
    }

    flags() {
        return this.token() >> 4;
    }

    tag_length() {
        return this._tag_length;
    }

    children() {
        // TODO(wb): it may be possible for this element to have children.
        return [];
    }
}

class ProcessingInstructionDataNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x0B.
     *
     * TODO(wb): untested.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("word", "string_length");
        this._tag_length = 3 + (2 * this.string_length());

        if (this.string_length() > 0) {
            this._string = this.unpackWstring(0x3, this.string_length());
        } else {
            this._string = "";
        }
    }

    toString() {
        return `ProcessingInstructionDataNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${0x0B.toString(16)})`;
    }

    flags() {
        return this.token() >> 4;
    }

    string() {
        if (this.string_length() > 0) {
            return ` ${this._string}?>`;
        } else {
            return "?>";
        }
    }

    tag_length() {
        return this._tag_length;
    }

    children() {
        // TODO(wb): it may be possible for this element to have children.
        return [];
    }
}

class TemplateInstanceNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x0C.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("byte", "unknown0");
        this.declare_field("dword", "template_id");
        this.declare_field("dword", "template_offset");

        this._data_length = 0;

        if (this.is_resident_template()) {
            let new_template = this._chunk.add_template(this.template_offset(), this);
            this._data_length += new_template.length();
        }
    }

    toString() {
        return `TemplateInstanceNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${0x0C.toString(16)})`;
    }

    flags() {
        return this.token() >> 4;
    }

    is_resident_template() {
        return this.template_offset() > this.offset() - this._chunk._offset;
    }

    tag_length() {
        return 10;
    }

    length() {
        return this.tag_length() + this._data_length;
    }

    template() {
        return this._chunk.templates()[this.template_offset()];
    }

    children() {
        return [];
    }

    find_end_of_stream() {
        return this.template().find_end_of_stream();
    }
}

class NormalSubstitutionNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x0D.
     *
     * This is a "normal substitution" token.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("word", "index");
        this.declare_field("byte", "type");
    }

    toString() {
        return `NormalSubstitutionNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${this.token().toString(16)}, index=${this.index()}, type=${this.type()})`;
    }

    flags() {
        return this.token() >> 4;
    }

    tagLength() {
        return 0x4;
    }

    length() {
        return this.tagLength();
    }

    children() {
        return [];
    }

    verify() {
        return this.flags() === 0 && (this.token() & 0x0F) === SYSTEM_TOKENS.NormalSubstitutionToken;
    }
}
class ConditionalSubstitutionNode extends BXmlNode {
    /**
     * The binary XML node for the system token 0x0E.
     */
    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("word", "index");
        this.declare_field("byte", "type");
    }

    toString() {
        return `ConditionalSubstitutionNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${(0x0E).toString(16)})`;
    }

    shouldSuppress(substitutions) {
        let sub = substitutions[this.index()];
        return sub instanceof NullTypeNode;
    }

    flags() {
        return this.token() >> 4;
    }

    tagLength() {
        return 0x4;
    }

    length() {
        return this.tagLength();
    }

    children() {
        return [];
    }

    verify() {
        return this.flags() === 0 && (this.token() & 0x0F) === SYSTEM_TOKENS.ConditionalSubstitutionToken;
    }
}

class StreamStartNode extends BXmlNode {
    /**
    The binary XML node for the system token 0x0F.

    This is the "start of stream" token.
    */

    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
        this.declare_field("byte", "token", 0x0);
        this.declare_field("byte", "unknown0");
        this.declare_field("word", "unknown1");
    }

    toString() {
        return `StreamStartNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, token=${this.token().toString(16)})`;
    }

    verify() {
        return (
            this.flags() === 0x0 &&
            (this.token() & 0x0F) === SYSTEM_TOKENS.StartOfStreamToken &&
            this.unknown0() === 0x1 &&
            this.unknown1() === 0x1
        );
    }

    flags() {
        return this.token() >> 4;
    }

    tag_length() {
        return 4;
    }

    length() {
        return this.tag_length() + 0;
    }

    children() {
        return [];
    }
}
class RootNode extends BXmlNode {
    /**
    The binary XML node for the Root node.
    */

    constructor(buf, offset, chunk, parent) {
        super(buf, offset, chunk, parent);
    }

    toString() {
        return `RootNode(offset=${this.offset().toString(16)}, length=${this.length().toString(16)})`;
    }

    tag_length() {
        return 0;
    }

    children() {
        /**
        @return The template instances which make up this node.
        */
        return this._children(null, {end_tokens: [SYSTEM_TOKENS.EndOfStreamToken]});
    }

    tag_and_children_length() {
        /**
        @return The length of the tag of this element, and the children.
          This does not take into account the substitutions that may be
          at the end of this element.
        */
        let children_length = 0;

        for (let child of this.children()) {
            children_length += child.length();
        }

        return this.tag_length() + children_length;
    }

    template_instance() {
        /**
        parse the template instance node.
        this is used to compute the location of the template definition structure.

        Returns:
          TemplateInstanceNode: the template instance.
        */
        let ofs = this.offset();
        if (this.unpack_byte(0x0) & 0x0F === 0xF) {
            ofs += 4;
        }
        return new TemplateInstanceNode(this._buf, ofs, this._chunk, this);
    }

    template() {
        /**
        parse the template referenced by this root node.
        note, this template structure is not guaranteed to be located within the root node's boundaries.

        Returns:
          TemplateNode: the template.
        */
        let instance = this.template_instance();
        let offset = this._chunk.offset() + instance.template_offset();
        let node = new TemplateNode(this._buf, offset, this._chunk, instance);
        return node;
    }

    substitutions() {
        /**
        @return A list of VariantTypeNode subclass instances that
          contain the substitutions for this root node.
        */
        let sub_decl = [];
        let sub_def = [];
        let ofs = this.tag_and_children_length();
        let sub_count = this.unpack_dword(ofs);
        ofs += 4;
        for (let i = 0; i < sub_count; i++) {
            let size = this.unpack_word(ofs);
            let type_ = this.unpack_byte(ofs + 0x2);
            sub_decl.push([size, type_]);
            ofs += 4;
        }
        for (let [size, type_] of sub_decl) {
            let val = get_variant_value(this._buf, this.offset() + ofs, this._chunk, this, type_, {length: size});
            if (Math.abs(size - val.length()) > 4) {
                // TODO(wb): This is a hack, so I'm sorry.
                //   But, we are not passing around a 'length' field,
                //   so we have to depend on the structure of each
                //   variant type.  It seems some BXmlTypeNode sizes
                //   are not exact.  Hopefully, this is just alignment.
                //   So, that's what we compensate for here.
                throw new ParseException("Invalid substitution value size");
            }
            sub_def.push(val);
            ofs += size;
        }
        return sub_def;
    }

    length() {
        let ofs = this.tag_and_children_length();
        let sub_count = this.unpack_dword(ofs);
        ofs += 4;
        let ret = ofs;
        for (let i = 0; i < sub_count; i++) {
            let size = this.unpack_word(ofs);
            ret += size + 4;
            ofs += 4;
        }
        return ret;
    }
}
class VariantTypeNode extends BXmlNode {
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent);
        this._length = length;
    }

    toString() {
        return `${this.constructor.name}(offset=${this.offset().toString(16)}, length=${this.length().toString(16)}, string=${this.string()})`;
    }

    repr() {
        return `${this.constructor.name}(buf=${this._buf}, offset=${this.offset().toString(16)}, chunk=${this._chunk})`;
    }

    tag_length() {
        throw new Error(`tag_length not implemented for ${this}`);
    }

    length() {
        return this.tag_length();
    }

    children() {
        return [];
    }

    string() {
        throw new Error(`string not implemented for ${this}`);
    }
}

class NullTypeNode {
    /**
     * Variant type 0x00.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        this._offset = offset;
        this._length = length;
    }

    toString() {
        return "NullTypeNode";
    }

    string() {
        return "";
    }

    length() {
        return this._length || 0;
    }

    tag_length() {
        return this._length || 0;
    }

    children() {
        return [];
    }

    offset() {
        return this._offset;
    }
}
class WstringTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x01.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        if (this._length === null) {
            this.declare_field("word", "string_length", 0x0);
            this.declare_field("wstring", "_string", {length: this.string_length()});
        } else {
            this.declare_field("wstring", "_string", 0x0, {length: this._length / 2});
        }
    }

    tag_length() {
        if (this._length === null) {
            return 2 + (this.string_length() * 2);
        }
        return this._length;
    }

    string() {
        return this._string().replace(/\x00+$/, "");
    }
}
class StringTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x02.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        if (this._length === null) {
            this.declare_field("word", "string_length", 0x0);
            this.declare_field("string", "_string", {length: this.string_length()});
        } else {
            this.declare_field("string", "_string", 0x0, {length: this._length});
        }
    }

    tag_length() {
        if (this._length === null) {
            return 2 + this.string_length();
        }
        return this._length;
    }

    string() {
        return this._string().replace(/\x00+$/, "");
    }
}
class SignedByteTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x03.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("int8", "byte", 0x0);
    }

    tag_length() {
        return 1;
    }

    string() {
        return String(this.byte());
    }
}
class UnsignedByteTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x04.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("byte", "byte", 0x0);
    }

    tag_length() {
        return 1;
    }

    string() {
        return String(this.byte());
    }
}
class SignedWordTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x05.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("int16", "word", 0x0);
    }

    tag_length() {
        return 2;
    }

    string() {
        return String(this.word());
    }
}
class UnsignedWordTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x06.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("word", "word", 0x0);
    }

    tagLength() {
        return 2;
    }

    string() {
        return String(this.word());
    }
}
class SignedDwordTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x07.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("int32", "dword", 0x0);
    }

    tag_length() {
        return 4;
    }

    string() {
        return String(this.dword());
    }
}
class UnsignedDwordTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x08.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("dword", "dword", 0x0);
    }

    tag_length() {
        return 4;
    }

    string() {
        return String(this.dword());
    }
}
class SignedQwordTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x09.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("int64", "qword", 0x0);
    }

    tag_length() {
        return 8;
    }

    string() {
        return String(this.qword());
    }
}
class UnsignedQwordTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x0A.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("qword", "qword", 0x0);
    }

    tag_length() {
        return 8;
    }

    string() {
        return String(this.qword());
    }
}
class FloatTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x0B.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("float", "float", 0x0);
    }

    tag_length() {
        return 4;
    }

    string() {
        return String(this.float());
    }
}
class DoubleTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x0C.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("double", "double", 0x0);
    }

    tag_length() {
        return 8;
    }

    string() {
        return String(this.double());
    }
}
class BooleanTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x0D.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("int32", "int32", 0x0);
    }

    tag_length() {
        return 4;
    }

    string() {
        if (this.int32() > 0) {
            return "True";
        }
        return "False";
    }
}
class BinaryTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x0E.
     * 
     * String/XML representation is Base64 encoded.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        if (this._length === null) {
            this.declare_field("dword", "size", 0x0);
            this.declare_field("binary", "binary", {length: this.size()});
        } else {
            this.declare_field("binary", "binary", 0x0, {length: this._length});
        }
    }

    tagLength() {
        if (this._length === null) {
            return 4 + this.size();
        }
        return this._length;
    }

    string() {
        return Buffer.from(this.binary()).toString('base64');
    }
}
class GuidTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x0F.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("guid", "guid", 0x0);
    }

    tag_length() {
        return 16;
    }

    string() {
        return "{" + this.guid() + "}";
    }
}
class SizeTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x10.
     *
     * Note: Assuming sizeof(size_t) == 0x8.
     */

    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        if (this._length === 0x4) {
            this.declare_field("dword", "num", 0x0);
        } else if (this._length === 0x8) {
            this.declare_field("qword", "num", 0x0);
        } else {
            this.declare_field("qword", "num", 0x0);
        }
    }

    tag_length() {
        if (this._length === null) {
            return 8;
        }
        return this._length;
    }

    string() {
        return String(this.num());
    }
}
class FiletimeTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x11.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("filetime", "filetime", 0x0);
    }

    string() {
        let t = this.filetime().toISOString().replace('T', ' ');
        return "time not supported";
    }

    tag_length() {
        return 8;
    }
}
class SystemtimeTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x12.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("systemtime", "systemtime", 0x0);
    }

    tag_length() {
        return 16;
    }

    string() {
        let t = this.systemtime().toISOString().replace('T', ' ');
        return "time not supported";
    }
}
class SIDTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x13.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("byte", "version", 0x0);
        this.declare_field("byte", "num_elements");
        this.declare_field("dword_be", "id_high");
        this.declare_field("word_be", "id_low");
    }

    elements = memoize(() => {
        let ret = [];
        for (let i = 0; i < this.num_elements(); i++) {
            ret.push(this.unpackDword(this.currentFieldOffset() + 4 * i));
        }
        return ret;
    });

    id = memoize(() => {
        let ret = `S-${this.version()}-${(this.id_high() << 16) ^ this.id_low()}`;
        for (let elem of this.elements()) {
            ret += `-${elem}`;
        }
        return ret;
    });

    tagLength() {
        return 8 + 4 * this.num_elements();
    }

    string() {
        return this.id();
    }
}

class Hex32TypeNode extends VariantTypeNode {
    /**
     * Variant type 0x14.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("binary", "hex", 0x0, 0x4);
    }

    tag_length() {
        return 4;
    }

    string() {
        let ret = "0x";
        let b = this.hex().slice().reverse();
        for (let i = 0; i < b.length; i++) {
            ret += b[i].toString(16).padStart(2, '0');
        }
        return ret;
    }
}
class Hex64TypeNode extends VariantTypeNode {
    /**
    * Variant type 0x15.
    */

    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this.declare_field("binary", "hex", 0x0, 0x8);
    }

    tag_length() {
        return 8;
    }

    string() {
        let ret = "0x";
        let b = this.hex().slice().reverse();
        for (let i = 0; i < b.length; i++) {
            ret += b[i].toString(16).padStart(2, '0');
        }
        return ret;
    }
}
class BXmlTypeNode extends VariantTypeNode {
    /**
     * Variant type 0x21.
     */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        this._root = new RootNode(buf, offset, chunk, this);
    }

    tag_length() {
        return this._length || this._root.length();
    }

    string() {
        return "";
    }

    root() {
        return this._root;
    }
}
class WstringArrayTypeNode extends VariantTypeNode {
    /**
    * Variant type 0x81.
    */
    constructor(buf, offset, chunk, parent, length = null) {
        super(buf, offset, chunk, parent, length);
        if (this._length === null) {
            this.declare_field("word", "binary_length", 0x0);
            this.declare_field("binary", "binary", {length: this.binary_length()});
        } else {
            this.declare_field("binary", "binary", 0x0, {length: this._length});
        }
    }

    tag_length() {
        if (this._length === null) {
            return 2 + this.binary_length();
        }
        return this._length;
    }

    string() {
        let binary = this.binary();
        let acc = [];
        while (binary.length > 0) {
            let match = binary.match(/((?:[^\x00].)+)/);
            if (match) {
                let frag = match[0];
                acc.push("<string>");
                acc.push(Buffer.from(frag, 'binary').toString('utf16le'));
                acc.push("</string>\n");
                binary = binary.slice(frag.length + 2);
                if (binary.length === 0) {
                    break;
                }
            }
            frag = binary.match(/(\x00*)/)[0];
            if (frag.length % 2 === 0) {
                for (let i = 0; i < frag.length / 2; i++) {
                    acc.push("<string></string>\n");
                }
            } else {
                throw new Error("Error parsing uneven substring of NULLs");
            }
            binary = binary.slice(frag.length);
        }
        return acc.join('');
    }
}

class UnexpectedElementException extends Error {
    constructor(msg) {
        super(msg);
    }
}
function escape_attr(s) {
    const RESTRICTED_CHARS = /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]/g;
    let esc = s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    esc = esc.replace(/[\u0080-\uFFFF]/g, function (m) {
        return '&#' + m.charCodeAt(0) + ';';
    });
    esc = esc.replace(RESTRICTED_CHARS, '');
    return esc;
}
function escape_value(s) {
    /*
    escape the given string such that it can be placed in an XML value location, like:

        <foo>
          $value
        </foo>

    Args:
      s (String): the string to escape.

    Returns:
      String: the escaped string.
    */
    const RESTRICTED_CHARS = /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]/g;
    let esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    esc = esc.replace(/[\u0080-\uFFFF]/g, function (m) {
        return '&#' + m.charCodeAt(0) + ';';
    });
    esc = esc.replace(RESTRICTED_CHARS, '');
    return esc;
}
function validate_name(s) {
    /**
    * ensure the given name can be used as an XML entity name, such as tag or attribute name.
    *
    * @param {string} s - the string to validate.
    * @throws {Error} if the string is not suitable to be an XML name.
    */
    const NAME_PATTERN = tool_functions.NAME_PATTERN;
    if (!NAME_PATTERN.test(s)) {
        throw new Error("invalid xml name: " + s);
    }
    return s;
}
function render_root_node_with_subs(root_node, subs) {
    /**
    * render the given root node using the given substitutions into XML.
    *
    * @param {RootNode} root_node - the node to render.
    * @param {Array<string>} subs - the substitutions that maybe included in the XML.
    *
    * @returns {string} - the rendered XML document.
    */

    function rec(node, acc) {
        if (node instanceof EndOfStreamNode) {
            // intended
        } else if (node instanceof OpenStartElementNode) {
            acc.push("<");
            acc.push(node.tag_name());
            node.children().forEach(child => {
                if (child instanceof AttributeNode) {
                    acc.push(" ");
                    acc.push(validate_name(child.attribute_name().string()));
                    acc.push('="');
                    // TODO: should use xml.sax.saxutils.quoteattr here
                    // but to do so, we'd need to ensure we're not double-quoting this value.
                    rec(child.attribute_value(), acc);
                    acc.push('"');
                }
            });
            acc.push(">");
            node.children().forEach(child => {
                rec(child, acc);
            });
            acc.push("</");
            acc.push(validate_name(node.tag_name()));
            acc.push(">\n");
        } else if (node instanceof CloseStartElementNode) {
            // intended
        } else if (node instanceof CloseEmptyElementNode) {
            // intended
        } else if (node instanceof CloseElementNode) {
            // intended
        } else if (node instanceof ValueNode) {
            acc.push(escape_value(node.children()[0].string()));
        } else if (node instanceof AttributeNode) {
            // intended
        } else if (node instanceof CDataSectionNode) {
            acc.push("<![CDATA[");
            // TODO: is this correct escaping???
            acc.push(escape_value(node.cdata()));
            acc.push("]]>");
        } else if (node instanceof EntityReferenceNode) {
            acc.push(escape_value(node.entity_reference()));
        } else if (node instanceof ProcessingInstructionTargetNode) {
            acc.push(escape_value(node.processing_instruction_target()));
        } else if (node instanceof ProcessingInstructionDataNode) {
            acc.push(escape_value(node.string()));
        } else if (node instanceof TemplateInstanceNode) {
            throw new Error("UnexpectedElementException: TemplateInstanceNode");
        } else if (node instanceof NormalSubstitutionNode) {
            let sub = subs[node.index()];

            if (sub instanceof BXmlTypeNode) {
                sub = render_root_node(sub.root());
            } else {
                sub = escape_value(sub.string());
            }

            acc.push(sub);
        } else if (node instanceof ConditionalSubstitutionNode) {
            let sub = subs[node.index()];

            if (sub instanceof BXmlTypeNode) {
                sub = render_root_node(sub.root());
            } else {
                sub = escape_value(sub.string());
            }

            acc.push(sub);
        } else if (node instanceof StreamStartNode) {
            // intended
        }
    }

    let acc = [];
    root_node.template().children().forEach(c => {
        rec(c, acc);
    });
    return acc.join("");
}
function render_root_node(root_node) {
    let subs = [];
    for (let sub of root_node.substitutions()) {
        if (typeof sub === 'string') {
            throw new Error("string sub?");
        }

        if (sub === null) {
            throw new Error("null sub?");
        }

        subs.push(sub);
    }

    return render_root_node_with_subs(root_node, subs);
}
function evtx_record_xml_view(record, cache) {
    /**
    * render the given record into an XML document.
    *
    * @param {Record} record - the record to render.
    * @returns {string} - the rendered XML document.
    */
    return render_root_node(record.root());
}
function* evtx_chunk_xml_view(chunk) {
    /**
     * Generate XML representations of the records in an EVTX chunk.
     *
     * Does not include the XML <?xml... header.
     * Records are ordered by chunk.records()
     *
     * Args:
     *   chunk (Chunk): the chunk to render.
     *
     * Yields:
     *   tuple[str, Record]: the rendered XML document and the raw record.
     */
    for (const record of chunk.records()) {
        const record_str = evtx_record_xml_view(record);
        yield [record_str, record];
    }
}

function* evtx_file_xml_view(file_header) {
    /**
     * Generate XML representations of the records in an EVTX file.
     *
     * Does not include the XML <?xml... header.
     * Records are ordered by file_header.chunks(), and then by chunk.records()
     *
     * Args:
     *   chunk (FileHeader): the file header to render.
     *
     * Yields:
     *   tuple[str, Record]: the rendered XML document and the raw record.
     */
    for (const chunk of file_header.chunks()) {
        for (const record of chunk.records()) {
            const record_str = evtx_record_xml_view(record);
            yield [record_str, record];
        }
    }
}
function evtx_template_readable_view(root_node, cache) {
    function rec(node, acc) {
        if (node instanceof EndOfStreamNode) {
            // intended
        } else if (node instanceof OpenStartElementNode) {
            acc.push("<");
            acc.push(node.tag_name());
            node.children().forEach(child => {
                if (child instanceof AttributeNode) {
                    acc.push(" ");
                    acc.push(child.attribute_name().string());
                    acc.push('="');
                    rec(child.attribute_value(), acc);
                    acc.push('"');
                }
            });
            acc.push(">");
            node.children().forEach(child => {
                rec(child, acc);
            });
            acc.push("</");
            acc.push(node.tag_name());
            acc.push(">\n");
        } else if (node instanceof CloseStartElementNode) {
            // intended
        } else if (node instanceof CloseEmptyElementNode) {
            // intended
        } else if (node instanceof CloseElementNode) {
            // intended
        } else if (node instanceof ValueNode) {
            acc.push(node.children()[0].string());
        } else if (node instanceof AttributeNode) {
            // intended
        } else if (node instanceof CDataSectionNode) {
            acc.push("<![CDATA[");
            acc.push(node.cdata());
            acc.push("]]>");
        } else if (node instanceof EntityReferenceNode) {
            acc.push(node.entity_reference());
        } else if (node instanceof ProcessingInstructionTargetNode) {
            acc.push(node.processing_instruction_target());
        } else if (node instanceof ProcessingInstructionDataNode) {
            acc.push(node.string());
        } else if (node instanceof TemplateInstanceNode) {
            throw new Error("UnexpectedElementException: TemplateInstanceNode");
        } else if (node instanceof NormalSubstitutionNode) {
            acc.push(`[Normal Substitution(index=${node.index()}, type=${node.type()})]`);
        } else if (node instanceof ConditionalSubstitutionNode) {
            acc.push(`[Conditional Substitution(index=${node.index()}, type=${node.type()})]`);
        } else if (node instanceof StreamStartNode) {
            // intended
        }
    }

    let acc = [];
    root_node.template().children().forEach(c => {
        rec(c, acc);
    });
    return acc.join("");
}
class InvalidRecordException extends Error {
    constructor() {
        super("Invalid record structure");
    }
}
class Evtx {
    /**
     * A convenience class that makes it easy to open an
     * EVTX file and start iterating the important structures.
     * Note, this class must be used in a context statement
     * (see the `with` keyword in Python, translated to try/finally in JavaScript).
     * Note, this class will mmap the target file, so ensure
     * your platform supports this operation.
     */

    constructor(filename) {
        /**
         * @param {string} filename - A string that contains the path
         * to the EVTX file to open.
         */
        this._filename = filename;
        this._buf = null;
        this._f = null;
        this._fh = null;
    }

    __enter__() {
        const fs = require('fs');
        const mmap = require('mmap-io');
        this._f = fs.openSync(this._filename, "r");
        this._buf = mmap.map(fs.fstatSync(this._f).size, mmap.PROT_READ, mmap.MAP_SHARED, this._f);
        this._fh = new FileHeader(this._buf, 0x0);
        return this;
    }

    __exit__() {
        this._buf.unmap();
        fs.closeSync(this._f);
        this._fh = null;
    }

    static ensure_contexted(func) {
        /**
         * This decorator ensures that an instance of the
         * Evtx class is used within a context statement. That is,
         * that the `with` statement is used, or `__enter__()` and `__exit__()` are called explicitly.
         */
        return function (...args) {
            if (this._buf === null) {
                throw new TypeError("An Evtx object must be used with a context (see the `with` statement in Python, or ensure `__enter__()` and `__exit__()` are called in JavaScript).");
            } else {
                return func.apply(this, args);
            }
        };
    }

    chunks() {
        /**
         * Get each of the ChunkHeaders from within this EVTX file.
         *
         * @returns {Generator} A generator of ChunkHeaders from this EVTX file.
         */
        function* generator() {
            for (let chunk of this._fh.chunks()) {
                yield chunk;
            }
        }
        return generator.call(this);
    }

    records() {
        /**
         * Get each of the Records from within this EVTX file.
         *
         * @returns {Generator} A generator of Records from this EVTX file.
         */
        function* generator() {
            for (let chunk of this.chunks()) {
                for (let record of chunk.records()) {
                    yield record;
                }
            }
        }
        return generator.call(this);
    }

    get_record(record_num) {
        /**
         * Get a Record by record number.
         *
         * @param {number} record_num - The record number of the record to fetch.
         * @returns {Record|null} The record requested by record number, or null if
         * the record is not found.
         */
        return this._fh.get_record(record_num);
    }

    get_file_header() {
        return this._fh;
    }
}

// Apply decorators
Evtx.prototype.chunks = Evtx.ensure_contexted(Evtx.prototype.chunks);
Evtx.prototype.records = Evtx.ensure_contexted(Evtx.prototype.records);
Evtx.prototype.get_record = Evtx.ensure_contexted(Evtx.prototype.get_record);
Evtx.prototype.get_file_header = Evtx.ensure_contexted(Evtx.prototype.get_file_header);

class FileHeader extends Block {
    constructor(buf, offset) {
        super(buf, offset);
        this.declare_field("string", "magic", 0x0, 8);
        this.declare_field("qword", "oldest_chunk");
        this.declare_field("qword", "current_chunk_number");
        this.declare_field("qword", "next_record_number");
        this.declare_field("dword", "header_size");
        this.declare_field("word", "minor_version");
        this.declare_field("word", "major_version");
        this.declare_field("word", "header_chunk_size");
        this.declare_field("word", "chunk_count");
        this.declare_field("binary", "unused1", 0x4C);
        this.declare_field("dword", "flags");
        this.declare_field("dword", "checksum");
    }

    toString() {
        return `FileHeader(offset=${this._offset.toString(16)})`;
    }

    check_magic() {
        return this.magic() === "ElfFile\x00";
    }

    calculate_checksum() {
        var buffer = this.unpack_binary(0, 0x78);
        var crc32 = require('crc-32');
        return crc32.buf(buffer) >>> 0;
    }

    verify() {
        return (
            this.checkMagic() &&
            this.major_version() === 0x3 &&
            this.minor_version() === 0x1 &&
            this.header_chunk_size() === 0x1000 &&
            this.checksum() === this.calculateChecksum()
        );
    }

    is_dirty() {
        return (this.flags() & 0x1) === 0x1;
    }

    is_full() {
        return (this.flags() & 0x2) === 0x2;
    }

    firstChunk() {
        let ofs = this._offset + this.header_chunk_size();
        return new ChunkHeader(this._buf, ofs);
    }

    currentChunk() {
        let ofs = this._offset + this.header_chunk_size();
        ofs += this.current_chunk_number() * 0x10000;
        return new ChunkHeader(this._buf, ofs);
    }

    *chunks(include_inactive = false) {
        let chunk_count = include_inactive ? 1000000 : this.chunk_count();
        let i = 0;
        let ofs = this._offset + this.header_chunk_size();
        while (ofs + 0x10000 <= this._buf.length && i < chunk_count) {
            yield new ChunkHeader(this._buf, ofs);
            ofs += 0x10000;
            i++;
        }
    }

    getRecord(record_num) {
        for (let chunk of this.chunks()) {
            let first_record = chunk.log_first_record_number();
            let last_record = chunk.log_last_record_number();
            if (!(first_record <= record_num && record_num <= last_record)) {
                continue;
            }
            for (let record of chunk.records()) {
                if (record.record_num() === record_num) {
                    return record;
                }
            }
        }
        return null;
    }
}
class Template {
    constructor(template_node) {
        this._template_node = template_node;
        this._xml = null;
    }

    _load_xml() {
        if (this._xml !== null) {
            return;
        }
        const matcher = /\[(?:Normal|Conditional) Substitution\(index=(\d+), type=\d+\)\]/;
        this._xml = this._template_node.template_format().replace("{", "{{").replace("}", "}}").replace(matcher, "{$1:}");
    }

    make_substitutions(substitutions) {
        this._load_xml();
        return this._xml.replace(/\{(\d+):\}/g, (_, index) => substitutions[index].xml());
    }

    node() {
        return this._template_node;
    }
}
class ChunkHeader extends Block {
    constructor(buf, offset) {
        super(buf, offset);
        this._strings = null;
        this._templates = null;

        this.declare_field("string", "magic", 0x0, 8);
        this.declare_field("qword", "file_first_record_number", null, null);
        this.declare_field("qword", "file_last_record_number", null, null);
        this.declare_field("qword", "log_first_record_number", null, null);
        this.declare_field("qword", "log_last_record_number", null, null);
        this.declare_field("dword", "header_size", null, null);
        this.declare_field("dword", "last_record_offset", null, null);
        this.declare_field("dword", "next_record_offset", null, null);
        this.declare_field("dword", "data_checksum", null, null);
        this.declare_field("binary", "unused", null, 0x44);
        this.declare_field("dword", "header_checksum", null, null);
    }

    toString() {
        return `ChunkHeader(offset=${this._offset.toString(16)})`;
    }

    check_magic() {
        return this.magic() === "ElfChnk\x00";
    }

    calculate_header_checksum() {
        var data = Buffer.concat([
            this.unpack_binary(0x0, 0x78),
            this.unpack_binary(0x80, 0x180)
        ]);
        var crc32 = require('crc-32');
        return crc32.buf(data) >>> 0;
    }

    calculate_data_checksum() {
        var data = this.unpack_binary(0x200, this.next_record_offset() - 0x200);
        var crc32 = require('crc-32');
        return crc32.buf(data) >>> 0;
    }

    verify() {
        return (
            this.checkMagic() &&
            this.calculateHeaderChecksum() === this.headerChecksum() &&
            this.calculateDataChecksum() === this.dataChecksum()
        );
    }

    _loadStrings() {
        if (this._strings === null) {
            this._strings = {};
        }
        for (let i = 0; i < 64; i++) {
            let ofs = this.unpackDword(0x80 + (i * 4));
            while (ofs > 0) {
                let stringNode = this.addString(ofs, null);
                ofs = stringNode.nextOffset();
            }
        }
    }

    strings() {
        if (!this._strings) {
            this._loadStrings();
        }
        return this._strings;
    }

    addString(offset, parent) {
        if (this._strings === null) {
            this._loadStrings();
        }
        let stringNode = new NameStringNode(this._buf, this._offset + offset, this, parent || this);
        this._strings[offset] = stringNode;
        return stringNode;
    }

    _loadTemplates() {
        if (this._templates === null) {
            this._templates = {};
        }
        for (let i = 0; i < 32; i++) {
            let ofs = this.unpackDword(0x180 + (i * 4));
            while (ofs > 0) {
                let token = this.unpackByte(ofs - 10);
                let pointer = this.unpackDword(ofs - 4);
                if (token !== 0x0C || pointer !== ofs) {
                    ofs = 0;
                    continue;
                }
                let template = this.addTemplate(ofs, null);
                ofs = template.nextOffset();
            }
        }
    }

    addTemplate(offset, parent) {
        if (this._templates === null) {
            this._loadTemplates();
        }
        let node = new TemplateNode(this._buf, this._offset + offset, this, parent || this);
        this._templates[offset] = node;
        return node;
    }

    templates() {
        if (!this._templates) {
            this._loadTemplates();
        }
        return this._templates;
    }

    firstRecord() {
        return new Record(this._buf, this._offset + 0x200, this);
    }

    *records() {
        try {
            let record = this.firstRecord();
            while (record._offset < this._offset + this.nextRecordOffset() && record.length() > 0) {
                yield record;
                record = new Record(this._buf, record._offset + record.length(), this);
            }
        } catch (e) {
            if (e instanceof InvalidRecordException) {
                return;
            }
        }
    }
}
class Record extends Block {
    constructor(buf, offset, chunk) {
        super(buf, offset);
        this._chunk = chunk;

        this.declare_field("dword", "magic", 0x0, null);  // 0x00002a2a
        this.declare_field("dword", "size", null, null);
        this.declare_field("qword", "record_num", null, null);
        this.declare_field("filetime", "timestamp", null, null);

        if (this.size() > 0x10000) {
            return null;
        }

        this.declare_field("dword", "size2", this.size() - 4, null);
    }

    toString() {
        return `Record(offset=${this._offset.toString(16)})`;
    }

    root() {
        return new RootNode(this._buf, this._offset + 0x18, this._chunk, this);
    }

    length() {
        return this.size();
    }

    verify() {
        return this.size() === this.size2();
    }

    data() {
        /**
         * Return the raw data block which makes up this record as a bytestring.
         *
         * @return {string} A string that is a copy of the buffer that makes up this record.
         */
        return this._buf.slice(this.offset(), this.offset() + this.size());
    }

    xml() {
        /**
         * Render the record into XML.
         * Does not include the xml declaration header.
         *
         * @return {string} The rendered xml document.
         */
        return evtx_record_xml_view(this, null);
    }
}
function test_chunks(input_str) {
    /**
    regression test parsing some known fields in the file chunks.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    */
      var fh = new FileHeader(input_str, 0x0);
      // collected empirically
      var expecteds = tool_functions.expected_output1;
      var tmp_gen = fh["chunks"](false);
  
      var i = 0;
  
      while(true){
          var x = (tmp_gen).next();
          if (x.done) break
          var chunk = x.value;
  
          if (i < 9) {
              console.assert(chunk["check_magic"]() === true);
              console.assert(chunk["magic"]() === "ElfChnk\x00");
              console.assert(chunk["calculate_header_checksum"]() === chunk["header_checksum"]());
              console.assert(chunk["calculate_data_checksum"]() === chunk["data_checksum"]());
              var expected = expecteds[i];
              console.assert(chunk["file_first_record_number"]() === expected["start_file"]);
              console.assert(chunk["file_last_record_number"]() === expected["end_file"]);
              console.assert(chunk["log_first_record_number"]() === expected["start_log"]);
              console.assert(chunk["log_last_record_number"]() === expected["end_log"]);
          } else {
              console.assert(chunk["check_magic"]() === false);
              console.assert(chunk["magic"]() === EMPTY_MAGIC);
          }
          i++;
      }
}
function test_chunks2(input_str) {
    /**
    regression test parsing some known fields in the file chunks.

    Args:
      security (bytes): the security.evtx test file contents. pytest fixture.
    */
    let fh = new FileHeader(input_str, 0x0);

    // collected empirically
    let expecteds = tool_functions.expected_output2;

    for (let i = 0; i < fh.chunks(false).length; i++) {
        let chunk = fh.chunks(false)[i];
        // collected empirically
        if (i < 26) {
            assert(chunk.check_magic() === true);
            assert(chunk.magic() === "ElfChnk\x00");
            assert(chunk.calculate_header_checksum() === chunk.header_checksum());
            assert(chunk.calculate_data_checksum() === chunk.data_checksum());

            let expected = expecteds[i];
            assert(chunk.file_first_record_number() === expected["start_file"]);
            assert(chunk.file_last_record_number() === expected["end_file"]);
            assert(chunk.log_first_record_number() === expected["start_log"]);
            assert(chunk.log_last_record_number() === expected["end_log"]);

        } else {
            assert(chunk.check_magic() === false);
            assert(chunk.magic() === EMPTY_MAGIC);
        }
    }
}
function test_file_header(input_str) {
    /**
    regression test parsing some known fields in the file header.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    */
    let fh = new FileHeader(input_str, 0x0);

    // collected empirically
    console.assert(fh.magic() === "ElfFile\x00");
    console.assert(fh.major_version() === 0x3);
    console.assert(fh.minor_version() === 0x1);
    console.assert(fh.flags() === 0x1);
    console.assert(fh.is_dirty() === true);
    console.assert(fh.is_full() === false);
    console.assert(fh.current_chunk_number() === 0x8);
    console.assert(fh.chunk_count() === 0x9);
    console.assert(fh.oldest_chunk() === 0x0);
    console.assert(fh.next_record_number() === 0x34D8);
    console.assert(fh.checksum() === 0x41B4B1EC);
    console.assert(fh.calculate_checksum() === fh.checksum());
}
function test_file_header2(input_str) {
    /**
    regression test parsing some known fields in the file header.

    Args:
      security (bytes): the security.evtx test file contents. pytest fixture.
    */
    let fh = new FileHeader(input_str, 0x0);

    // collected empirically
    console.assert(fh.magic() === "ElfFile\x00");
    console.assert(fh.major_version() === 0x3);
    console.assert(fh.minor_version() === 0x1);
    console.assert(fh.flags() === 0x1);
    console.assert(fh.is_dirty() === true);
    console.assert(fh.is_full() === false);
    console.assert(fh.current_chunk_number() === 0x19);
    console.assert(fh.chunk_count() === 0x1A);
    console.assert(fh.oldest_chunk() === 0x0);
    console.assert(fh.next_record_number() === 0x8B2);
    console.assert(fh.checksum() === 0x3F6E33D5);
    console.assert(fh.calculate_checksum() === fh.checksum());
}
function one(iterable) {
    /**
     * Fetch a single element from the given iterable.
     *
     * @param {Iterable} iterable - A sequence of things.
     * @returns {Object} The first thing in the sequence.
     */
    for (let i of iterable) {
        return i;
    }
}
function extract_structure(node) {
    let name = node.constructor.name;

    let value = null;
    if (node instanceof BXmlTypeNode) {
        value = null;
    } else if (node instanceof VariantTypeNode) {
        value = node.string();
    } else if (node instanceof OpenStartElementNode) {
        value = node.tag_name();
    } else if (node instanceof AttributeNode) {
        value = node.attribute_name().string();
    } else {
        value = null;
    }

    let children = [];
    if (node instanceof BXmlTypeNode) {
        children.push(extract_structure(node._root));
    } else if (node instanceof TemplateInstanceNode && node.is_resident_template()) {
        children.push(extract_structure(node.template()));
    }

    if (node.children) {
        children.push(...node.children().map(child => extract_structure(child)));
    }

    if (node instanceof RootNode) {
        let substitutions = node.substitutions().map(substitution => extract_structure(substitution));
        children.push(["Substitutions", null, substitutions]);
    }

    if (children.length > 0) {
        return [name, value, children];
    } else if (value !== null) {
        return [name, value];
    } else {
        return [name];
    }
}
function test_parse_record(input_str) {
    /**
    * regression test demonstrating binary xml nodes getting parsed.
    *
    * Args:
    *   system (bytes): the system.evtx test file contents. pytest fixture.
    */
    let fh = new FileHeader(input_str, 0x0);
    let chunk = fh.chunks(false).next().value;
    let record = chunk.records().next().value;

    // generated by hand, but matches the output of extract_structure.
    let expected = tool_functions.expected_output3;
    console.assert(extract_structure(record.root()) === expected);
}
function test_render_record(input_str) {
    // regression test demonstrating formatting a record to xml.
    // Args:
    //   system (bytes): the system.evtx test file contents. pytest fixture.

    let fh = new FileHeader(input_str, 0x0);
    let chunk = fh.chunks(false).next().value;
    let record = chunk.records().next().value;

    let xml = record.xml();
    if (xml !== tool_functions.expected_output4) {
        throw new Error("Assertion failed");
    }
}
function test_parse_records(input_str) {
    /**
    * regression test demonstrating that all record metadata can be parsed.
    *
    * Args:
    *   system (bytes): the system.evtx test file contents. pytest fixture.
    */
    let fh = new FileHeader(input_str, 0x0);
    let i = 0;
    for (let chunk of fh.chunks(false)) {
        let j = 0;
        for (let record of chunk.records()) {
            console.assert(record.magic() === 0x2A2A);
            j++;
        }
        i++;
    }
}
function test_parse_records2(input_str) {
    /**
    * regression test demonstrating that all record metadata can be parsed.
    *
    * Args:
    *   security (bytes): the security.evtx test file contents. pytest fixture.
    */
    let fh = new FileHeader(input_str, 0x0);
    let i = 0;
    for (let chunk of fh.chunks(false)) {
        let j = 0;
        for (let record of chunk.records()) {
            if (record.magic() !== 0x2A2A) {
                throw new Error("Assertion failed");
            }
            j++;
        }
        i++;
    }
}
function test_render_records(input_str) {
    // regression test demonstrating formatting records to xml.
    // Args:
    //   system (bytes): the system.evtx test file contents. pytest fixture.

    let fh = new FileHeader(input_str, 0x0);
    for (let chunk of fh.chunks(false)) {
        for (let record of chunk.records()) {
            if (record.xml() === null) {
                throw new Error("Assertion failed: record.xml() is not null");
            }
        }
    }
}
function test_render_records2(input_str) {
    /**
    * regression test demonstrating formatting records to xml.
    *
    * Args:
    *   security (bytes): the security.evtx test file contents. pytest fixture.
    */
    let fh = new FileHeader(input_str, 0x0);
    for (let chunk of fh.chunks(false)) {
        for (let record of chunk.records()) {
            if (record.xml() === null) {
                throw new Error("Assertion failed: record.xml() is not null");
            }
        }
    }
}
function test_render_records_lxml(input_str) {
    // regression test demonstrating formatting records to xml.
    // Args:
    //   system (bytes): the system.evtx test file contents. pytest fixture.

    let fh = new FileHeader(input_str, 0x0);
    let i = 0;
    for (let chunk of fh.chunks()) {
        let j = 0;
        for (let record of chunk.records()) {
            if (record.lxml() === null) {
                throw new Error("Assertion failed: record.lxml() is not null");
            }
            j++;
        }
        i++;
    }
}
function test_render_records_lxml2(input_str) {
    // regression test demonstrating formatting records to xml.
    //
    // Args:
    //   security (bytes): the security.evtx test file contents. pytest fixture.
    
    let fh = new FileHeader(input_str, 0x0);
    let i = 0;
    for (let chunk of fh.chunks()) {
        let j = 0;
        for (let record of chunk.records()) {
            if (record.lxml() === null) {
                throw new Error("Assertion failed: record.lxml() is not null");
            }
            j++;
        }
        i++;
    }
}

function test_corrupt_ascii_example() {
    /**
    * regression test demonstrating issue 37.
    *
    * Args:
    *   data_path (str): the file system path of the test directory.
    */
    // record number two contains a QNAME xml element
    // with an ASCII text value that is invalid ASCII:
    //
    //     000002E0:                                31 39 33 2E 31 2E            193.1.
    //     000002F0: 33 36 2E 31 32 31 30 2E  39 2E 31 35 2E 32 30 32  36.1210.9.15.202
    //     00000300: 01 62 2E 5F 64 6E 73 2D  73 73 2E 5F 75 64 70 2E  .b._dns-sd._udp.
    //     00000310: 40 A6 35 01 2E                                    @.5..
    //                  ^^ ^^ ^^
    //
    // with pytest.raises(UnicodeDecodeError):
    try {
        let log = new Evtx("./py_evtx/evtx_data/dns_log_malformed.evtx")["__enter__"]();
        for (let chunk of log["chunks"]()) {
            for (let record of chunk["records"]()) {
                if (record.xml() === null) {
                    throw new Error("Expected non-null XML");
                }
            }
        }
    } catch (error) {
        if (!(error instanceof UnicodeDecodeError)) {
            throw error; // Rethrow if it's not the expected error
        }
    }
}
function test_continue_parsing_after_corrupt_ascii() {
    /**
    * regression test demonstrating issue 37.
    *
    * Args:
    *   data_path (str): the file system path of the test directory.
    */
    let attempted = 0;
    let completed = 0;
    let failed = 0;
    let log = new Evtx("./benchmarks_new/py_evtx/evtx_data/dns_log_malformed.evtx").__enter__();
    for (let chunk of log.chunks()) {
        for (let record of chunk.records()) {
            try {
                attempted += 1;
                if (record.xml() !== null) {
                    completed += 1;
                }
            } catch (error) {
                if (error instanceof TextDecoderError) { // Assuming TextDecoderError as closest to UnicodeDecodeError
                    failed += 1;
                }
            }
        }
    }

    // this small log file has exactly five records.
    console.assert(attempted === 5, "Attempted should be 5");
    // the first record is valid.
    console.assert(completed === 1, "Completed should be 1");
    // however the remaining four have corrupted ASCII strings,
    // which we are unable to decode.
    console.assert(failed === 4, "Failed should be 4");
}
function test() {
    test_chunks(tool_functions.get_input("case1"));
    test_chunks2(tool_functions.get_input("case2"));

    test_file_header(tool_functions.get_input("case1"));
    test_file_header2(tool_functions.get_input("case2"));

    test_parse_record(tool_functions.get_input("case1"));
    test_parse_records(tool_functions.get_input("case1"));
    test_parse_records2(tool_functions.get_input("case2"));

    test_render_record(tool_functions.get_input("case1"));
    test_render_records(tool_functions.get_input("case1"));
    test_render_records2(tool_functions.get_input("case2"));
    console.log("All tests passed");
}

// Global Begin

EMPTY_MAGIC = "\x00" * 0x8

XML_HEADER = '<?xml version="1.1" encoding="utf-8" standalone="yes" ?>\n'

node_dispatch_table = [
    EndOfStreamNode,
    OpenStartElementNode,
    CloseStartElementNode,
    CloseEmptyElementNode,
    CloseElementNode,
    ValueNode,
    AttributeNode,
    CDataSectionNode,
    CharacterReferenceNode,
    EntityReferenceNode,
    ProcessingInstructionTargetNode,
    ProcessingInstructionDataNode,
    TemplateInstanceNode,
    NormalSubstitutionNode,
    ConditionalSubstitutionNode,
    StreamStartNode,
];

const node_readable_tokens = [
    "End of Stream",
    "Open Start Element",
    "Close Start Element",
    "Close Empty Element",
    "Close Element",
    "Value",
    "Attribute",
    "unknown",
    "unknown",
    "unknown",
    "unknown",
    "unknown",
    "TemplateInstanceNode",
    "Normal Substitution",
    "Conditional Substitution",
    "Start of Stream",
];

test();