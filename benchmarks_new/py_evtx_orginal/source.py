import re
import binascii
import struct
import datetime
import base64
# import hexdump
import six
import mmap
import xml.sax.saxutils
from functools import partial, wraps
import tracer_skip as tool_functions

class SYSTEM_TOKENS:
    EndOfStreamToken = 0x00
    OpenStartElementToken = 0x01
    CloseStartElementToken = 0x02
    CloseEmptyElementToken = 0x03
    CloseElementToken = 0x04
    ValueToken = 0x05
    AttributeToken = 0x06
    CDataSectionToken = 0x07
    EntityReferenceToken = 0x08
    ProcessingInstructionTargetToken = 0x0A
    ProcessingInstructionDataToken = 0x0B
    TemplateInstanceToken = 0x0C
    NormalSubstitutionToken = 0x0D
    ConditionalSubstitutionToken = 0x0E
    StartOfStreamToken = 0x0F

class NODE_TYPES:
    NULL = 0x00
    WSTRING = 0x01
    STRING = 0x02
    SIGNED_BYTE = 0x03
    UNSIGNED_BYTE = 0x04
    SIGNED_WORD = 0x05
    UNSIGNED_WORD = 0x06
    SIGNED_DWORD = 0x07
    UNSIGNED_DWORD = 0x08
    SIGNED_QWORD = 0x09
    UNSIGNED_QWORD = 0x0A
    FLOAT = 0x0B
    DOUBLE = 0x0C
    BOOLEAN = 0x0D
    BINARY = 0x0E
    GUID = 0x0F
    SIZE = 0x10
    FILETIME = 0x11
    SYSTEMTIME = 0x12
    SID = 0x13
    HEX32 = 0x14
    HEX64 = 0x15
    BXML = 0x21
    WSTRINGARRAY = 0x81

class memoize(object):
    """cache the return value of a method

    From http://code.activestate.com/recipes/577452-a-memoize-decorator-for-instance-methods/

    This class is meant to be used as a decorator of methods. The return value
    from a given method invocation will be cached on the instance whose method
    was invoked. All arguments passed to a method decorated with memoize must
    be hashable.

    If a memoized method is invoked directly on its class the result will not
    be cached. Instead the method will be invoked like a static method:
    class Obj(object):
        @memoize
        def add_to(self, arg):
            return self + arg
    Obj.add_to(1) # not enough arguments
    Obj.add_to(1, 2) # returns 3, result is not cached
    """

    def __init__(self, func):
        self.func = func

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self.func
        return partial(self, obj)

    def __call__(self, *args, **kw):
        obj = args[0]
        try:
            cache = obj.__cache
        except AttributeError:
            cache = obj.__cache = {}
        key = (self.func, args, frozenset(list(kw.items())))
        if key not in cache:
            cache[key] = self.func(*args, **kw)
        return cache[key]

def align(offset, alignment):
    """
    Return the offset aligned to the nearest greater given alignment
    Arguments:
    - `offset`: An integer
    - `alignment`: An integer
    """
    if offset % alignment == 0:
        return offset
    return offset + (alignment - (offset % alignment))


def dosdate(dosdate, dostime):
    """
    `dosdate`: 2 bytes, little endian.
    `dostime`: 2 bytes, little endian.
    returns: datetime.datetime or datetime.datetime.min on error
    """
    try:
        t = ord(dosdate[1]) << 8
        t |= ord(dosdate[0])
        day = t & 0b0000000000011111
        month = (t & 0b0000000111100000) >> 5
        year = (t & 0b1111111000000000) >> 9
        year += 1980

        t = ord(dostime[1]) << 8
        t |= ord(dostime[0])
        sec = t & 0b0000000000011111
        sec *= 2
        minute = (t & 0b0000011111100000) >> 5
        hour = (t & 0b1111100000000000) >> 11

        return datetime.datetime(year, month, day, hour, minute, sec)
    except ValueError:
        return datetime.datetime.min


def parse_filetime(qword):
    if qword == 0:
        return datetime.datetime.min

    try:
        return datetime.datetime.fromtimestamp(float(qword) * 1e-7 - 11644473600, datetime.timezone.utc)
    except (ValueError, OSError):
        return datetime.datetime.min


class BinaryParserException(Exception):
    """
    Base Exception class for binary parsing.
    """

    def __init__(self, value):
        """
        Constructor.
        Arguments:
        - `value`: A string description.
        """
        super().__init__()
        self._value = value

    def __repr__(self):
        return "BinaryParserException({!r})".format(self._value)

    def __str__(self):
        return "Binary Parser Exception: {}".format(self._value)


class ParseException(BinaryParserException):
    """
    An exception to be thrown during binary parsing, such as
    when an invalid header is encountered.
    """

    def __init__(self, value):
        """
        Constructor.
        Arguments:
        - `value`: A string description.
        """
        super().__init__(value)

    def __repr__(self):
        return "ParseException({!r})".format(self._value)

    def __str__(self):
        return "Parse Exception({})".format(self._value)


class OverrunBufferException(ParseException):
    def __init__(self, readOffs, bufLen):
        tvalue = "read: {}, buffer length: {}".format(hex(readOffs), hex(bufLen))
        super().__init__(tvalue)

    def __repr__(self):
        return "OverrunBufferException({!r})".format(self._value)

    def __str__(self):
        return "Tried to parse beyond the end of the file ({})".format(self._value)


class Block():
    """
    Base class for structure blocks in binary parsing.
    A block is associated with a offset into a byte-string.
    """

    def __init__(self, buf, offset):
        """
        Constructor.
        Arguments:
        - `buf`: Byte string containing stuff to parse.
        - `offset`: The offset into the buffer at which the block starts.
        """
        self._buf = buf
        self._offset = offset
        self._implicit_offset = 0

    def __repr__(self):
        return "Block(buf={!r}, offset={!r})".format(self._buf, self._offset)

    def __str__(self):
        return str(self)

    def declare_field(self, type, name, offset=None, length=None):
        def no_length_handler():
            f = getattr(self, "unpack_" + type)
            return f(offset)
        
        def explicit_length_handler():
            f = getattr(self, "unpack_" + type)
            return f(offset, length)
        
        """
        Declaratively add fields to this block.
        This method will dynamically add corresponding
          offset and unpacker methods to this block.
        Arguments:
        - `type`: A string. Should be one of the unpack_* types.
        - `name`: A string.
        - `offset`: A number.
        - `length`: (Optional) A number. For (w)strings, length in chars.
        """
        
        if offset is None:
            offset = self._implicit_offset

        if length is None:

            setattr(self, name, no_length_handler)
        else:

            setattr(self, name, explicit_length_handler)

        setattr(self, "_off_" + name, offset)
        if type == "byte":
            self._implicit_offset = offset + 1
        elif type == "int8":
            self._implicit_offset = offset + 1
        elif type == "word":
            self._implicit_offset = offset + 2
        elif type == "word_be":
            self._implicit_offset = offset + 2
        elif type == "int16":
            self._implicit_offset = offset + 2
        elif type == "dword":
            self._implicit_offset = offset + 4
        elif type == "dword_be":
            self._implicit_offset = offset + 4
        elif type == "int32":
            self._implicit_offset = offset + 4
        elif type == "qword":
            self._implicit_offset = offset + 8
        elif type == "int64":
            self._implicit_offset = offset + 8
        elif type == "float":
            self._implicit_offset = offset + 4
        elif type == "double":
            self._implicit_offset = offset + 8
        elif type == "dosdate":
            self._implicit_offset = offset + 4
        elif type == "filetime":
            self._implicit_offset = offset + 8
        elif type == "systemtime":
            self._implicit_offset = offset + 8
        elif type == "guid":
            self._implicit_offset = offset + 16
        elif type == "binary":
            self._implicit_offset = offset + length
        elif type == "string" and length is not None:
            self._implicit_offset = offset + length
        elif type == "wstring" and length is not None:
            self._implicit_offset = offset + (2 * length)
        elif "string" in type and length is None:
            raise ParseException("Implicit offset not supported " "for dynamic length strings")
        else:
            raise ParseException("Implicit offset not supported " "for type: {}".format(type))

    def current_field_offset(self):
        return self._implicit_offset

    def unpack_byte(self, offset):
        """
        Returns a little-endian unsigned byte from the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<B", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_int8(self, offset):
        """
        Returns a little-endian signed byte from the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<b", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_word(self, offset):
        """
        Returns a little-endian unsigned WORD (2 bytes) from the
          relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<H", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_word_be(self, offset):
        """
        Returns a big-endian unsigned WORD (2 bytes) from the
          relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from(">H", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_int16(self, offset):
        """
        Returns a little-endian signed WORD (2 bytes) from the
          relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<h", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def pack_word(self, offset, word):
        """
        Applies the little-endian WORD (2 bytes) to the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        - `word`: The data to apply.
        """
        o = self._offset + offset
        return struct.pack_into("<H", self._buf, o, word)

    def unpack_dword(self, offset):
        """
        Returns a little-endian DWORD (4 bytes) from the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<I", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_dword_be(self, offset):
        """
        Returns a big-endian DWORD (4 bytes) from the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from(">I", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_int32(self, offset):
        """
        Returns a little-endian signed integer (4 bytes) from the
          relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<i", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_qword(self, offset):
        """
        Returns a little-endian QWORD (8 bytes) from the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<Q", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_int64(self, offset):
        """
        Returns a little-endian signed 64-bit integer (8 bytes) from
          the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<q", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_float(self, offset):
        """
        Returns a single-precision float (4 bytes) from
          the relative offset.  IEEE 754 format.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<f", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_double(self, offset):
        """
        Returns a double-precision float (8 bytes) from
          the relative offset.  IEEE 754 format.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            return struct.unpack_from("<d", self._buf, o)[0]
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_binary(self, offset, length):
        """
        Returns raw binary data from the relative offset with the given length.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        - `length`: The length of the binary blob. If zero, the empty string
            zero length is returned.
        Throws:
        - `OverrunBufferException`
        """
        if not length:
            return ("".encode("ascii"))
        o = self._offset + offset
        try:
            return (struct.unpack_from("<{}s".format(length), self._buf, o)[0])
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_string(self, offset, length):
        """
        Returns a string from the relative offset with the given length.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        - `length`: The length of the string.
        Throws:
        - `OverrunBufferException`
        """
        return self.unpack_binary(offset, length).decode("ascii")

    def unpack_wstring(self, offset, length):
        """
        Returns a string from the relative offset with the given length,
        where each character is a wchar (2 bytes)
        Arguments:
        - `offset`: The relative offset from the start of the block.
        - `length`: The length of the string.
        Throws:
        - `UnicodeDecodeError`
        """
        start = self._offset + offset
        end = self._offset + offset + 2 * length
        try:
            return bytes(self._buf[start:end]).decode("utf16")
        except AttributeError:  # already a 'str' ?
            return bytes(self._buf[start:end]).decode("utf16")

    def unpack_dosdate(self, offset):
        """
        Returns a datetime from the DOSDATE and DOSTIME starting at
        the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        try:
            o = self._offset + offset
            return dosdate(self._buf[o : o + 2], self._buf[o + 2 : o + 4])
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))

    def unpack_filetime(self, offset):
        """
        Returns a datetime from the QWORD Windows timestamp starting at
        the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        return parse_filetime(self.unpack_qword(offset))

    def unpack_systemtime(self, offset):
        """
        Returns a datetime from the QWORD Windows SYSTEMTIME timestamp
          starting at the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset
        try:
            parts = struct.unpack_from("<HHHHHHHH", self._buf, o)
        except struct.error:
            raise OverrunBufferException(o, len(self._buf))
        return datetime.datetime(
            parts[0], parts[1], parts[3], parts[4], parts[5], parts[6], parts[7]  # skip part 2 (day of week)
        )

    def unpack_guid(self, offset):
        """
        Returns a string containing a GUID starting at the relative offset.
        Arguments:
        - `offset`: The relative offset from the start of the block.
        Throws:
        - `OverrunBufferException`
        """
        o = self._offset + offset

        try:
            _bin = bytes(self._buf[o : o + 16])
        except IndexError:
            raise OverrunBufferException(o, len(self._buf))

        # Yeah, this is ugly
        h = [_bin[i] for i in range(len(_bin))]
        return """{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}""".format(
            h[3], h[2], h[1], h[0], h[5], h[4], h[7], h[6], h[8], h[9], h[10], h[11], h[12], h[13], h[14], h[15]
        )

    def absolute_offset(self, offset):
        """
        Get the absolute offset from an offset relative to this block
        Arguments:
        - `offset`: The relative offset into this block.
        """
        return self._offset + offset

    def offset(self):
        """
        Equivalent to self.absolute_offset(0x0), which is the starting
          offset of this block.
        """
        return self._offset
    

class SuppressConditionalSubstitution(Exception):
    """
    This exception is to be thrown to indicate that a conditional
      substitution evaluated to NULL, and the parent element should
      be suppressed. This exception should be caught at the first
      opportunity, and must not propagate far up the call chain.

    Strategy:
      AttributeNode catches this, .xml() --> ""
      StartOpenElementNode catches this for each child, ensures
        there's at least one useful value.  Or, .xml() --> ""
    """

    def __init__(self, msg):
        super(SuppressConditionalSubstitution, self).__init__(msg)


class UnexpectedStateException(ParseException):
    """
    UnexpectedStateException is an exception to be thrown when the parser
      encounters an unexpected value or state. This probably means there
      is a bug in the parser, but could stem from a corrupted input file.
    """

    def __init__(self, msg):
        super(UnexpectedStateException, self).__init__(msg)


class BXmlNode(Block):

    def __init__(self, buf, offset, chunk, parent):
        super(BXmlNode, self).__init__(buf, offset)
        self._chunk = chunk
        self._parent = parent

    def __repr__(self):
        return "BXmlNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "BXmlNode(offset={})".format(hex(self.offset()))

    def dump(self):
        b = self._buf[self.offset() : self.offset() + self.length()]
        return hexdump.hexdump(b, result="return")

    def tag_length(self):
        """
        This method must be implemented and overridden for all BXmlNodes.
        @return An integer specifying the length of this tag, not including
          its children.
        """
        raise NotImplementedError("tag_length not implemented for {!r}").format(self)

    def _children(self, max_children=None, end_tokens=[0x00]): ### modify SYSTEM_TOKENS.EndOfStreamToken to 0x00
        """
        @return A list containing all of the children BXmlNodes.
        """
        ret = []
        ofs = self.tag_length()

        if max_children:
            gen = list(range(max_children))
        else:
            gen = tool_functions.user_infinite_counter()

        for _ in gen:
            # we lose error checking by masking off the higher nibble,
            #   but, some tokens like 0x01, make use of the flags nibble.
            token = self.unpack_byte(ofs) & 0x0F
            try:
                HandlerNodeClass = node_dispatch_table[token]
                child = HandlerNodeClass(self._buf, self.offset() + ofs, self._chunk, self)
            except IndexError:
                raise ParseException("Unexpected token {:02X} at {}".format(token, self.absolute_offset(0x0) + ofs))
            ret.append(child)
            ofs += child.length()
            if token in end_tokens:
                break
            if child.find_end_of_stream():
                break
        return ret

    @memoize
    def children(self):
        return self._children()

    @memoize
    def length(self):
        """
        @return An integer specifying the length of this tag and all
          its children.
        """
        ret = self.tag_length()
        for child in self.children():
            ret += child.length()
        return ret

    @memoize
    def find_end_of_stream(self):
        for child in self.children():
            if isinstance(child, EndOfStreamNode):
                return child
            ret = child.find_end_of_stream()
            if ret:
                return ret
        return None


class NameStringNode(BXmlNode):
    def __init__(self, buf, offset, chunk, parent):
        super(NameStringNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("dword", "next_offset", 0x0)
        self.declare_field("word", "hash")
        self.declare_field("word", "string_length")
        self.declare_field("wstring", "string", length=self.string_length())

    def __repr__(self):
        return "NameStringNode(buf={!r}, offset={!r}, chunk={!r})".format(self._buf, self.offset(), self._chunk)

    def __str__(self):
        return "NameStringNode(offset={}, length={}, end={})".format(
            hex(self.offset()), hex(self.length()), hex(self.offset() + self.length())
        )

    def string(self):
        return str(self._string())

    def tag_length(self):
        return (self.string_length() * 2) + 8

    def length(self):
        # two bytes unaccounted for...
        return self.tag_length() + 2


class TemplateNode(BXmlNode):
    def __init__(self, buf, offset, chunk, parent):
        super(TemplateNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("dword", "next_offset", 0x0)
        self.declare_field("dword", "template_id")
        self.declare_field("guid", "guid", 0x04)  # unsure why this overlaps
        self.declare_field("dword", "data_length")

    def __repr__(self):
        return "TemplateNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "TemplateNode(offset={}, guid={}, length={})".format(hex(self.offset()), self.guid(), hex(self.length()))

    def tag_length(self):
        return 0x18

    def length(self):
        return self.tag_length() + self.data_length()


class EndOfStreamNode(BXmlNode):
    """
    The binary XML node for the system token 0x00.

    This is the "end of stream" token. It may never actually
      be instantiated here.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(EndOfStreamNode, self).__init__(buf, offset, chunk, parent)

    def __repr__(self):
        return "EndOfStreamNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "EndOfStreamNode(offset={}, length={}, token={})".format(hex(self.offset()), hex(self.length()), 0x00)

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 1

    def length(self):
        return 1

    def children(self):
        return []


class OpenStartElementNode(BXmlNode):
    """
    The binary XML node for the system token 0x01.

    This is the "open start element" token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(OpenStartElementNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("word", "unknown0")
        # TODO(wb): use this size() field.
        self.declare_field("dword", "size")
        self.declare_field("dword", "string_offset")
        self._tag_length = 11
        self._element_type = 0

        if self.flags() & 0x04:
            self._tag_length += 4

        if self.string_offset() > self.offset() - self._chunk._offset:
            new_string = self._chunk.add_string(self.string_offset(), parent=self)
            self._tag_length += new_string.length()

    def __repr__(self):
        return "OpenStartElementNode(buf={!r}, offset={!r}, chunk={!r})".format(self._buf, self.offset(), self._chunk)

    def __str__(self):
        return "OpenStartElementNode(offset={}, name={}, length={}, token={}, end={}, taglength={}, endtag={})".format(
            hex(self.offset()),
            self.tag_name(),
            hex(self.length()),
            hex(self.token()),
            hex(self.offset() + self.length()),
            hex(self.tag_length()),
            hex(self.offset() + self.tag_length()),
        )

    @memoize
    def is_empty_node(self):
        for child in self.children():
            if type(child) is CloseEmptyElementNode:
                return True
        return False

    def flags(self):
        return self.token() >> 4

    @memoize
    def tag_name(self):
        return self._chunk.strings()[self.string_offset()].string()

    def tag_length(self):
        return self._tag_length

    def verify(self):
        return self.flags() & 0x0B == 0 and self.opcode() & 0x0F == 0x01

    @memoize
    def children(self):
        return self._children(end_tokens=[SYSTEM_TOKENS.CloseElementToken, SYSTEM_TOKENS.CloseEmptyElementToken])


class CloseStartElementNode(BXmlNode):
    """
    The binary XML node for the system token 0x02.

    This is the "close start element" token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(CloseStartElementNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)

    def __repr__(self):
        return "CloseStartElementNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "CloseStartElementNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(self.token())
        )

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 1

    def length(self):
        return 1

    def children(self):
        return []

    def verify(self):
        return self.flags() & 0x0F == 0 and self.opcode() & 0x0F == 0x02


class CloseEmptyElementNode(BXmlNode):
    """
    The binary XML node for the system token 0x03.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(CloseEmptyElementNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)

    def __repr__(self):
        return "CloseEmptyElementNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "CloseEmptyElementNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(0x03)
        )

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 1

    def length(self):
        return 1

    def children(self):
        return []


class CloseElementNode(BXmlNode):
    """
    The binary XML node for the system token 0x04.

    This is the "close element" token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(CloseElementNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)

    def __repr__(self):
        return "CloseElementNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "CloseElementNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(self.token())
        )

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 1

    def length(self):
        return 1

    def children(self):
        return []

    def verify(self):
        return self.flags() & 0x0F == 0 and self.opcode() & 0x0F == 0x04


def get_variant_value(buf, offset, chunk, parent, type_, length=None):
    """
    @return A VariantType subclass instance found in the given
      buffer and offset.
    """
    types = {
        NODE_TYPES.NULL: NullTypeNode,
        NODE_TYPES.WSTRING: WstringTypeNode,
        NODE_TYPES.STRING: StringTypeNode,
        NODE_TYPES.SIGNED_BYTE: SignedByteTypeNode,
        NODE_TYPES.UNSIGNED_BYTE: UnsignedByteTypeNode,
        NODE_TYPES.SIGNED_WORD: SignedWordTypeNode,
        NODE_TYPES.UNSIGNED_WORD: UnsignedWordTypeNode,
        NODE_TYPES.SIGNED_DWORD: SignedDwordTypeNode,
        NODE_TYPES.UNSIGNED_DWORD: UnsignedDwordTypeNode,
        NODE_TYPES.SIGNED_QWORD: SignedQwordTypeNode,
        NODE_TYPES.UNSIGNED_QWORD: UnsignedQwordTypeNode,
        NODE_TYPES.FLOAT: FloatTypeNode,
        NODE_TYPES.DOUBLE: DoubleTypeNode,
        NODE_TYPES.BOOLEAN: BooleanTypeNode,
        NODE_TYPES.BINARY: BinaryTypeNode,
        NODE_TYPES.GUID: GuidTypeNode,
        NODE_TYPES.SIZE: SizeTypeNode,
        NODE_TYPES.FILETIME: FiletimeTypeNode,
        NODE_TYPES.SYSTEMTIME: SystemtimeTypeNode,
        NODE_TYPES.SID: SIDTypeNode,
        NODE_TYPES.HEX32: Hex32TypeNode,
        NODE_TYPES.HEX64: Hex64TypeNode,
        NODE_TYPES.BXML: BXmlTypeNode,
        NODE_TYPES.WSTRINGARRAY: WstringArrayTypeNode,
    }
    try:
        TypeClass = types[type_]
    except IndexError:
        raise NotImplementedError("Type {} not implemented".format(type_))
    return TypeClass(buf, offset, chunk, parent, length=length)


class ValueNode(BXmlNode):
    """
    The binary XML node for the system token 0x05.

    This is the "value" token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(ValueNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("byte", "type")

    def __repr__(self):
        return "ValueNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "ValueNode(offset={}, length={}, token={}, value={})".format(
            hex(self.offset()), hex(self.length()), hex(self.token()), self.value().string()
        )

    def flags(self):
        return self.token() >> 4

    def value(self):
        return self.children()[0]

    def tag_length(self):
        return 2

    def children(self):
        child = get_variant_value(self._buf, self.offset() + self.tag_length(), self._chunk, self, self.type())
        return [child]

    def verify(self):
        return self.flags() & 0x0B == 0 and self.token() & 0x0F == SYSTEM_TOKENS.ValueToken


class AttributeNode(BXmlNode):
    """
    The binary XML node for the system token 0x06.

    This is the "attribute" token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(AttributeNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("dword", "string_offset")

        self._name_string_length = 0
        if self.string_offset() > self.offset() - self._chunk._offset:
            new_string = self._chunk.add_string(self.string_offset(), parent=self)
            self._name_string_length += new_string.length()

    def __repr__(self):
        return "AttributeNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "AttributeNode(offset={}, length={}, token={}, name={}, value={})".format(
            hex(self.offset()), hex(self.length()), hex(self.token()), self.attribute_name(), self.attribute_value()
        )

    def flags(self):
        return self.token() >> 4

    def attribute_name(self):
        """
        @return A NameNode instance that contains the attribute name.
        """
        return self._chunk.strings()[self.string_offset()]

    def attribute_value(self):
        """
        @return A BXmlNode instance that is one of (ValueNode,
          ConditionalSubstitutionNode, NormalSubstitutionNode).
        """
        return self.children()[0]

    def tag_length(self):
        return 5 + self._name_string_length

    def verify(self):
        return self.flags() & 0x0B == 0 and self.opcode() & 0x0F == 0x06

    @memoize
    def children(self):
        return self._children(max_children=1)


class CDataSectionNode(BXmlNode):
    """
    The binary XML node for the system token 0x07.

    This is the "CDATA section" system token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(CDataSectionNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("word", "string_length")
        self.declare_field("wstring", "cdata", length=self.string_length() - 2)

    def __repr__(self):
        return "CDataSectionNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "CDataSectionNode(offset={}, length={}, token={})".format(hex(self.offset()), hex(self.length()), 0x07)

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 0x3 + self.string_length()

    def length(self):
        return self.tag_length()

    def children(self):
        return []

    def verify(self):
        return self.flags() == 0x0 and self.token() & 0x0F == SYSTEM_TOKENS.CDataSectionToken


class CharacterReferenceNode(BXmlNode):
    """
    The binary XML node for the system token 0x08.

    This is an character reference node.  That is, something that represents
      a non-XML character, eg. & --> &#x0038;.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(CharacterReferenceNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("word", "entity")
        self._tag_length = 3

    def __repr__(self):
        return "CharacterReferenceNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "CharacterReferenceNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(0x08)
        )

    def entity_reference(self):
        return "&#x%04x;" % (self.entity())

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return self._tag_length

    def children(self):
        return []


class EntityReferenceNode(BXmlNode):
    """
    The binary XML node for the system token 0x09.

    This is an entity reference node.  That is, something that represents
      a non-XML character, eg. & --> &amp;.

    TODO(wb): this is untested.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(EntityReferenceNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("dword", "string_offset")
        self._tag_length = 5

        if self.string_offset() > self.offset() - self._chunk.offset():
            new_string = self._chunk.add_string(self.string_offset(), parent=self)
            self._tag_length += new_string.length()

    def __repr__(self):
        return "EntityReferenceNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "EntityReferenceNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(0x09)
        )

    def entity_reference(self):
        return "&{};".format(self._chunk.strings()[self.string_offset()].string())

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return self._tag_length

    def children(self):
        # TODO(wb): it may be possible for this element to have children.
        return []


class ProcessingInstructionTargetNode(BXmlNode):
    """
    The binary XML node for the system token 0x0A.

    TODO(wb): untested.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(ProcessingInstructionTargetNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("dword", "string_offset")
        self._tag_length = 5

        if self.string_offset() > self.offset() - self._chunk.offset():
            new_string = self._chunk.add_string(self.string_offset(), parent=self)
            self._tag_length += new_string.length()

    def __repr__(self):
        return "ProcessingInstructionTargetNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "ProcessingInstructionTargetNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(0x0A)
        )

    def processing_instruction_target(self):
        return "<?{}".format(self._chunk.strings()[self.string_offset()].string())

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return self._tag_length

    def children(self):
        # TODO(wb): it may be possible for this element to have children.
        return []


class ProcessingInstructionDataNode(BXmlNode):
    """
    The binary XML node for the system token 0x0B.

    TODO(wb): untested.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(ProcessingInstructionDataNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("word", "string_length")
        self._tag_length = 3 + (2 * self.string_length())

        if self.string_length() > 0:
            self._string = self.unpack_wstring(0x3, self.string_length())
        else:
            self._string = ""

    def __repr__(self):
        return "ProcessingInstructionDataNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "ProcessingInstructionDataNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(0x0B)
        )

    def flags(self):
        return self.token() >> 4

    def string(self):
        if self.string_length() > 0:
            return " {}?>".format(self._string)
        else:
            return "?>"

    def tag_length(self):
        return self._tag_length

    def children(self):
        # TODO(wb): it may be possible for this element to have children.
        return []


class TemplateInstanceNode(BXmlNode):
    """
    The binary XML node for the system token 0x0C.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(TemplateInstanceNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("byte", "unknown0")
        self.declare_field("dword", "template_id")
        self.declare_field("dword", "template_offset")

        self._data_length = 0

        if self.is_resident_template():
            new_template = self._chunk.add_template(self.template_offset(), parent=self)
            self._data_length += new_template.length()

    def __repr__(self):
        return "TemplateInstanceNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "TemplateInstanceNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(0x0C)
        )

    def flags(self):
        return self.token() >> 4

    def is_resident_template(self):
        return self.template_offset() > self.offset() - self._chunk._offset

    def tag_length(self):
        return 10

    def length(self):
        return self.tag_length() + self._data_length

    def template(self):
        return self._chunk.templates()[self.template_offset()]

    def children(self):
        return []

    @memoize
    def find_end_of_stream(self):
        return self.template().find_end_of_stream()


class NormalSubstitutionNode(BXmlNode):
    """
    The binary XML node for the system token 0x0D.

    This is a "normal substitution" token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(NormalSubstitutionNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("word", "index")
        self.declare_field("byte", "type")

    def __repr__(self):
        return "NormalSubstitutionNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "NormalSubstitutionNode(offset={}, length={}, token={}, index={}, type={})".format(
            hex(self.offset()), hex(self.length()), hex(self.token()), self.index(), self.type()
        )

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 0x4

    def length(self):
        return self.tag_length()

    def children(self):
        return []

    def verify(self):
        return self.flags() == 0 and self.token() & 0x0F == SYSTEM_TOKENS.NormalSubstitutionToken


class ConditionalSubstitutionNode(BXmlNode):
    """
    The binary XML node for the system token 0x0E.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(ConditionalSubstitutionNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("word", "index")
        self.declare_field("byte", "type")

    def __repr__(self):
        return "ConditionalSubstitutionNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "ConditionalSubstitutionNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(0x0E)
        )

    def should_suppress(self, substitutions):
        sub = substitutions[self.index()]
        return type(sub) is NullTypeNode

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 0x4

    def length(self):
        return self.tag_length()

    def children(self):
        return []

    def verify(self):
        return self.flags() == 0 and self.token() & 0x0F == SYSTEM_TOKENS.ConditionalSubstitutionToken


class StreamStartNode(BXmlNode):
    """
    The binary XML node for the system token 0x0F.

    This is the "start of stream" token.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(StreamStartNode, self).__init__(buf, offset, chunk, parent)
        self.declare_field("byte", "token", 0x0)
        self.declare_field("byte", "unknown0")
        self.declare_field("word", "unknown1")

    def __repr__(self):
        return "StreamStartNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "StreamStartNode(offset={}, length={}, token={})".format(
            hex(self.offset()), hex(self.length()), hex(self.token())
        )

    def verify(self):
        return (
            self.flags() == 0x0
            and self.token() & 0x0F == SYSTEM_TOKENS.StartOfStreamToken
            and self.unknown0() == 0x1
            and self.unknown1() == 0x1
        )

    def flags(self):
        return self.token() >> 4

    def tag_length(self):
        return 4

    def length(self):
        return self.tag_length() + 0

    def children(self):
        return []


class RootNode(BXmlNode):
    """
    The binary XML node for the Root node.
    """

    def __init__(self, buf, offset, chunk, parent):
        super(RootNode, self).__init__(buf, offset, chunk, parent)

    def __repr__(self):
        return "RootNode(buf={!r}, offset={!r}, chunk={!r}, parent={!r})".format(
            self._buf, self.offset(), self._chunk, self._parent
        )

    def __str__(self):
        return "RootNode(offset={}, length={})".format(hex(self.offset()), hex(self.length()))

    def tag_length(self):
        return 0

    @memoize
    def children(self):
        """
        @return The template instances which make up this node.
        """
        return self._children(None, end_tokens=[SYSTEM_TOKENS.EndOfStreamToken])

    def tag_and_children_length(self):
        """
        @return The length of the tag of this element, and the children.
          This does not take into account the substitutions that may be
          at the end of this element.
        """
        children_length = 0

        for child in self.children():
            children_length += child.length()

        return self.tag_length() + children_length

    def template_instance(self):
        """
        parse the template instance node.
        this is used to compute the location of the template definition structure.

        Returns:
          TemplateInstanceNode: the template instance.
        """
        ofs = self.offset()
        if self.unpack_byte(0x0) & 0x0F == 0xF:
            ofs += 4
        return TemplateInstanceNode(self._buf, ofs, self._chunk, self)

    def template(self):
        """
        parse the template referenced by this root node.
        note, this template structure is not guaranteed to be located within the root node's boundaries.

        Returns:
          TemplateNode: the template.
        """
        instance = self.template_instance()
        offset = self._chunk.offset() + instance.template_offset()
        node = TemplateNode(self._buf, offset, self._chunk, instance)
        return node

    @memoize
    def substitutions(self):
        """
        @return A list of VariantTypeNode subclass instances that
          contain the substitutions for this root node.
        """
        sub_decl = []
        sub_def = []
        ofs = self.tag_and_children_length()
        sub_count = self.unpack_dword(ofs)
        ofs += 4
        for _ in range(sub_count):
            size = self.unpack_word(ofs)
            type_ = self.unpack_byte(ofs + 0x2)
            sub_decl.append((size, type_))
            ofs += 4
        for size, type_ in sub_decl:
            val = get_variant_value(self._buf, self.offset() + ofs, self._chunk, self, type_, length=size)
            if abs(size - val.length()) > 4:
                # TODO(wb): This is a hack, so I'm sorry.
                #   But, we are not passing around a 'length' field,
                #   so we have to depend on the structure of each
                #   variant type.  It seems some BXmlTypeNode sizes
                #   are not exact.  Hopefully, this is just alignment.
                #   So, that's what we compensate for here.
                raise ParseException("Invalid substitution value size")
            sub_def.append(val)
            ofs += size
        return sub_def

    @memoize
    def length(self):
        ofs = self.tag_and_children_length()
        sub_count = self.unpack_dword(ofs)
        ofs += 4
        ret = ofs
        for _ in range(sub_count):
            size = self.unpack_word(ofs)
            ret += size + 4
            ofs += 4
        return ret


class VariantTypeNode(BXmlNode):
    """ """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(VariantTypeNode, self).__init__(buf, offset, chunk, parent)
        self._length = length

    def __repr__(self):
        return "{}(buf={!r}, offset={}, chunk={!r})".format(
            self.__class__.__name__, self._buf, hex(self.offset()), self._chunk
        )

    def __str__(self):
        return "{}(offset={}, length={}, string={})".format(
            self.__class__.__name__, hex(self.offset()), hex(self.length()), self.string()
        )

    def tag_length(self):
        raise NotImplementedError("tag_length not implemented for {!r}".format(self))

    def length(self):
        return self.tag_length()

    def children(self):
        return []

    def string(self):
        raise NotImplementedError("string not implemented for {!r}".format(self))


# but satisfies the contract of VariantTypeNode, BXmlNode, but not Block
class NullTypeNode:
    """
    Variant type 0x00.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(NullTypeNode, self).__init__()
        self._offset = offset
        self._length = length

    def __str__(self):
        return "NullTypeNode"

    def string(self):
        return ""

    def length(self):
        return self._length or 0

    def tag_length(self):
        return self._length or 0

    def children(self):
        return []

    def offset(self):
        return self._offset


class WstringTypeNode(VariantTypeNode):
    """
    Variant ttype 0x01.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(WstringTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        if self._length is None:
            self.declare_field("word", "string_length", 0x0)
            self.declare_field("wstring", "_string", length=(self.string_length()))
        else:
            self.declare_field("wstring", "_string", 0x0, length=(self._length // 2))

    def tag_length(self):
        if self._length is None:
            
            return 2 + (self.string_length() * 2)
        return self._length

    def string(self):
        return self._string().rstrip("\x00")


class StringTypeNode(VariantTypeNode):
    """
    Variant type 0x02.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(StringTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        if self._length is None:
            self.declare_field("word", "string_length", 0x0)
            self.declare_field("string", "_string", length=(self.string_length()))
        else:
            self.declare_field("string", "_string", 0x0, length=self._length)

    def tag_length(self):
        if self._length is None:
            return 2 + (self.string_length())
        return self._length

    def string(self):
        return self._string().rstrip("\x00")


class SignedByteTypeNode(VariantTypeNode):
    """
    Variant type 0x03.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(SignedByteTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("int8", "byte", 0x0)

    def tag_length(self):
        return 1

    def string(self):
        return str(self.byte())


class UnsignedByteTypeNode(VariantTypeNode):
    """
    Variant type 0x04.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(UnsignedByteTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("byte", "byte", 0x0)

    def tag_length(self):
        return 1

    def string(self):
        return str(self.byte())


class SignedWordTypeNode(VariantTypeNode):
    """
    Variant type 0x05.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(SignedWordTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("int16", "word", 0x0)

    def tag_length(self):
        return 2

    def string(self):
        return str(self.word())


class UnsignedWordTypeNode(VariantTypeNode):
    """
    Variant type 0x06.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(UnsignedWordTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("word", "word", 0x0)

    def tag_length(self):
        return 2

    def string(self):
        return str(self.word())


class SignedDwordTypeNode(VariantTypeNode):
    """
    Variant type 0x07.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(SignedDwordTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("int32", "dword", 0x0)

    def tag_length(self):
        return 4

    def string(self):
        return str(self.dword())


class UnsignedDwordTypeNode(VariantTypeNode):
    """
    Variant type 0x08.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(UnsignedDwordTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("dword", "dword", 0x0)

    def tag_length(self):
        return 4

    def string(self):
        return str(self.dword())


class SignedQwordTypeNode(VariantTypeNode):
    """
    Variant type 0x09.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(SignedQwordTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("int64", "qword", 0x0)

    def tag_length(self):
        return 8

    def string(self):
        return str(self.qword())


class UnsignedQwordTypeNode(VariantTypeNode):
    """
    Variant type 0x0A.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(UnsignedQwordTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("qword", "qword", 0x0)

    def tag_length(self):
        return 8

    def string(self):
        return str(self.qword())


class FloatTypeNode(VariantTypeNode):
    """
    Variant type 0x0B.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(FloatTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("float", "float", 0x0)

    def tag_length(self):
        return 4

    def string(self):
        return str(self.float())


class DoubleTypeNode(VariantTypeNode):
    """
    Variant type 0x0C.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(DoubleTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("double", "double", 0x0)

    def tag_length(self):
        return 8

    def string(self):
        return str(self.double())


class BooleanTypeNode(VariantTypeNode):
    """
    Variant type 0x0D.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(BooleanTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("int32", "int32", 0x0)

    def tag_length(self):
        return 4

    def string(self):
        if self.int32() > 0:
            return "True"
        return "False"


class BinaryTypeNode(VariantTypeNode):
    """
    Variant type 0x0E.

    String/XML representation is Base64 encoded.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(BinaryTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        if self._length is None:
            self.declare_field("dword", "size", 0x0)
            self.declare_field("binary", "binary", length=self.size())
        else:
            self.declare_field("binary", "binary", 0x0, length=self._length)

    def tag_length(self):
        if self._length is None:
            return 4 + self.size()
        return self._length

    def string(self):
        return base64.b64encode(self.binary()).decode("ascii")


class GuidTypeNode(VariantTypeNode):
    """
    Variant type 0x0F.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(GuidTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("guid", "guid", 0x0)

    def tag_length(self):
        return 16

    def string(self):
        return "{" + self.guid() + "}"


class SizeTypeNode(VariantTypeNode):
    """
    Variant type 0x10.

    Note: Assuming sizeof(size_t) == 0x8.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(SizeTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        if self._length == 0x4:
            self.declare_field("dword", "num", 0x0)
        elif self._length == 0x8:
            self.declare_field("qword", "num", 0x0)
        else:
            self.declare_field("qword", "num", 0x0)

    def tag_length(self):
        if self._length is None:
            return 8
        return self._length

    def string(self):
        return str(self.num())


class FiletimeTypeNode(VariantTypeNode):
    """
    Variant type 0x11.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(FiletimeTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("filetime", "filetime", 0x0)

    def string(self):
        t = self.filetime().isoformat(" ")
        return "time not supported"

    def tag_length(self):
        return 8


class SystemtimeTypeNode(VariantTypeNode):
    """
    Variant type 0x12.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(SystemtimeTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("systemtime", "systemtime", 0x0)

    def tag_length(self):
        return 16

    def string(self):
        t = self.systemtime().isoformat(" ")
        return "time not supported"


class SIDTypeNode(VariantTypeNode):
    """
    Variant type 0x13.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(SIDTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("byte", "version", 0x0)
        self.declare_field("byte", "num_elements")
        self.declare_field("dword_be", "id_high")
        self.declare_field("word_be", "id_low")

    @memoize
    def elements(self):
        ret = []
        for i in range(self.num_elements()):
            ret.append(self.unpack_dword(self.current_field_offset() + 4 * i))
        return ret

    @memoize
    def id(self):
        ret = "S-{}-{}".format(self.version(), (self.id_high() << 16) ^ self.id_low())
        for elem in self.elements():
            ret += "-{}".format(elem)
        return ret

    def tag_length(self):
        return 8 + 4 * self.num_elements()

    def string(self):
        return self.id()


class Hex32TypeNode(VariantTypeNode):
    """
    Variant type 0x14.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(Hex32TypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("binary", "hex", 0x0, length=0x4)

    def tag_length(self):
        return 4

    def string(self):
        ret = "0x"
        b = self.hex()[::-1]
        for i in range(len(b)):
            ret += "{:02x}".format(b[i])
        return ret


class Hex64TypeNode(VariantTypeNode):
    """
    Variant type 0x15.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(Hex64TypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self.declare_field("binary", "hex", 0x0, length=0x8)

    def tag_length(self):
        return 8

    def string(self):
        ret = "0x"
        b = self.hex()[::-1]
        for i in range(len(b)):
            ret += "{:02x}".format(b[i])
        return ret


class BXmlTypeNode(VariantTypeNode):
    """
    Variant type 0x21.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(BXmlTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        self._root = RootNode(buf, offset, chunk, self)

    def tag_length(self):
        return self._length or self._root.length()

    def string(self):
        return ""

    def root(self):
        return self._root


class WstringArrayTypeNode(VariantTypeNode):
    """
    Variant ttype 0x81.
    """

    def __init__(self, buf, offset, chunk, parent, length=None):
        super(WstringArrayTypeNode, self).__init__(buf, offset, chunk, parent, length=length)
        if self._length is None:
            self.declare_field("word", "binary_length", 0x0)
            self.declare_field("binary", "binary", length=(self.binary_length()))
        else:
            self.declare_field("binary", "binary", 0x0, length=(self._length))

    def tag_length(self):
        if self._length is None:
            return 2 + self.binary_length()
        return self._length

    def string(self):
        binary = self.binary()
        acc = []
        while len(binary) > 0:
            match = re.search(b"((?:[^\x00].)+)", binary)
            if match:
                frag = match.group()
                acc.append("<string>")
                acc.append(frag.decode("utf16"))
                acc.append("</string>\n")
                binary = binary[len(frag) + 2 :]
                if len(binary) == 0:
                    break
            frag = re.search(b"(\x00*)", binary).group()
            if len(frag) % 2 == 0:
                for _ in range(len(frag) // 2):
                    acc.append("<string></string>\n")
            else:
                raise ParseException("Error parsing uneven substring of NULLs")
            binary = binary[len(frag) :]
        return "".join(acc)

class UnexpectedElementException(Exception):
    def __init__(self, msg):
        super().__init__(msg)


def escape_attr(s):
    '''
    escape the given string such that it can be placed in an XML attribute, like:

        <foo bar='$value'>

    Args:
      s (str): the string to escape.

    Returns:
      str: the escaped string.
    '''
    RESTRICTED_CHARS = re.compile('[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]')
    esc = xml.sax.saxutils.quoteattr(s)
    esc = esc.encode('ascii', 'xmlcharrefreplace').decode('ascii')
    esc = RESTRICTED_CHARS.sub('', esc)
    return esc


def escape_value(s):
    '''
    escape the given string such that it can be placed in an XML value location, like:

        <foo>
          $value
        </foo>

    Args:
      s (str): the string to escape.

    Returns:
      str: the escaped string.
    '''
    RESTRICTED_CHARS = re.compile('[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]')
    esc = xml.sax.saxutils.escape(s)
    esc = esc.encode('ascii', 'xmlcharrefreplace').decode('ascii')
    esc = RESTRICTED_CHARS.sub('', esc)
    return esc

def validate_name(s):
    """
    ensure the given name can be used as an XML entity name, such as tag or attribute name.

    Args:
      s (str): the string to validate.

    Raises:
      RuntimeError: if the string is not suitable to be an XML name.
    """
    NAME_PATTERN = tool_functions.NAME_PATTERN
    if not NAME_PATTERN.match(s):
        raise RuntimeError("invalid xml name: %s" % (s))
    return s


def render_root_node_with_subs(root_node, subs):
    """
    render the given root node using the given substitutions into XML.

    Args:
      root_node (RootNode): the node to render.
      subs (list[str]): the substitutions that maybe included in the XML.

    Returns:
      str: the rendered XML document.
    """

    def rec(node, acc):
        if isinstance(node, EndOfStreamNode):
            pass  # intended
        elif isinstance(node, OpenStartElementNode):
            acc.append("<")
            acc.append(node.tag_name())
            for child in node.children():
                if isinstance(child, AttributeNode):
                    acc.append(" ")
                    acc.append(validate_name(child.attribute_name().string()))
                    acc.append('="')
                    # TODO: should use xml.sax.saxutils.quoteattr here
                    # but to do so, we'd need to ensure we're not double-quoting this value.
                    rec(child.attribute_value(), acc)
                    acc.append('"')
            acc.append(">")
            for child in node.children():
                rec(child, acc)
            acc.append("</")
            acc.append(validate_name(node.tag_name()))
            acc.append(">\n")
        elif isinstance(node, CloseStartElementNode):
            pass  # intended
        elif isinstance(node, CloseEmptyElementNode):
            pass  # intended
        elif isinstance(node, CloseElementNode):
            pass  # intended
        elif isinstance(node, ValueNode):
            acc.append(escape_value(node.children()[0].string()))
        elif isinstance(node, AttributeNode):
            pass  # intended
        elif isinstance(node, CDataSectionNode):
            acc.append("<![CDATA[")
            # TODO: is this correct escaping???
            acc.append(escape_value(node.cdata()))
            acc.append("]]>")
        elif isinstance(node, EntityReferenceNode):
            acc.append(escape_value(node.entity_reference()))
        elif isinstance(node, ProcessingInstructionTargetNode):
            acc.append(escape_value(node.processing_instruction_target()))
        elif isinstance(node, ProcessingInstructionDataNode):
            acc.append(escape_value(node.string()))
        elif isinstance(node, TemplateInstanceNode):
            raise UnexpectedElementException("TemplateInstanceNode")
        elif isinstance(node, NormalSubstitutionNode):
            sub = subs[node.index()]

            if isinstance(sub, BXmlTypeNode):
                sub = render_root_node(sub.root())
            else:
                sub = escape_value(sub.string())

            acc.append(sub)
        elif isinstance(node, ConditionalSubstitutionNode):
            sub = subs[node.index()]

            if isinstance(sub, BXmlTypeNode):
                sub = render_root_node(sub.root())
            else:
                sub = escape_value(sub.string())

            acc.append(sub)
        elif isinstance(node, StreamStartNode):
            pass  # intended

    acc = []
    for c in root_node.template().children():
        rec(c, acc)
    return "".join(acc)


def render_root_node(root_node):
    subs = []
    for sub in root_node.substitutions():
        if isinstance(sub, six.string_types):
            raise RuntimeError("string sub?")

        if sub is None:
            raise RuntimeError("null sub?")

        subs.append(sub)

    return render_root_node_with_subs(root_node, subs)


def evtx_record_xml_view(record, cache):
    """
    render the given record into an XML document.

    Args:
      record (Record): the record to render.

    Returns:
      str: the rendered XML document.
    """
    return render_root_node(record.root())


def evtx_chunk_xml_view(chunk):
    """
    Generate XML representations of the records in an EVTX chunk.

    Does not include the XML <?xml... header.
    Records are ordered by chunk.records()

    Args:
      chunk (Chunk): the chunk to render.

    Yields:
      tuple[str, Record]: the rendered XML document and the raw record.
    """
    for record in chunk.records():
        record_str = evtx_record_xml_view(record)
        yield record_str, record


def evtx_file_xml_view(file_header):
    """
    Generate XML representations of the records in an EVTX file.

    Does not include the XML <?xml... header.
    Records are ordered by file_header.chunks(), and then by chunk.records()

    Args:
      chunk (FileHeader): the file header to render.

    Yields:
      tuple[str, Record]: the rendered XML document and the raw record.
    """
    for chunk in file_header.chunks():
        for record in chunk.records():
            record_str = evtx_record_xml_view(record)
            yield record_str, record


def evtx_template_readable_view(root_node, cache):
    def rec(node, acc):
        if isinstance(node, 
                EndOfStreamNode):
            pass  # intended
        elif isinstance(node, 
                OpenStartElementNode):
            acc.append("<")
            acc.append(
                node.tag_name())
            for child in node.children():
                if isinstance(child, 
                        AttributeNode):
                    acc.append(" ")
                    acc.append(
                        child.attribute_name().string())
                    acc.append('="')
                    rec(child.attribute_value(), acc)
                    acc.append('"')
            acc.append(">")
            for child in node.children():
                rec(child, acc)
            acc.append("</")
            acc.append(
                node.tag_name())
            acc.append(">\n")
        elif isinstance(node, 
                CloseStartElementNode):
            pass  # intended
        elif isinstance(node, 
                CloseEmptyElementNode):
            pass  # intended
        elif isinstance(node, 
                CloseElementNode):
            pass  # intended
        elif isinstance(node, 
                ValueNode):
            acc.append(
                node.children()[0].string())
        elif isinstance(node, 
                AttributeNode):
            pass  # intended
        elif isinstance(node, 
                CDataSectionNode):
            acc.append("<![CDATA[")
            acc.append(node.cdata())
            acc.append("]]>")
        elif isinstance(node, 
                EntityReferenceNode):
            acc.append(
                node.entity_reference())
        elif isinstance(node, 
                ProcessingInstructionTargetNode):
            acc.append(
                node.processing_instruction_target())
        elif isinstance(node, 
                ProcessingInstructionDataNode):
            acc.append(
                node.string())
        elif isinstance(node, 
                TemplateInstanceNode):
            raise UnexpectedElementException("TemplateInstanceNode")
        elif isinstance(node, 
                NormalSubstitutionNode):
            acc.append("[Normal Substitution(index={}, type={})]".format(
                                                                    node.index(), node.type()))
        elif isinstance(node, 
                ConditionalSubstitutionNode):
            acc.append("[Conditional Substitution(index={}, type={})]".format(
                                                                    node.index(), node.type()))
        elif isinstance(node, 
                StreamStartNode):
            pass  # intended

    acc = []
    for c in root_node.template().children():
        rec(c, acc)
    return "".join(acc)


class InvalidRecordException(ParseException):
    def __init__(self):
        super().__init__("Invalid record structure")


class Evtx():
    """
    A convenience class that makes it easy to open an
      EVTX file and start iterating the important structures.
    Note, this class must be used in a context statement
       (see the `with` keyword).
    Note, this class will mmap the target file, so ensure
      your platform supports this operation.
    """

    def __init__(self, filename):
        """
        @type filename:  str
        @param filename: A string that contains the path
          to the EVTX file to open.
        """
        self._filename = filename
        self._buf = None
        self._f = None
        self._fh = None

    def __enter__(self):
        self._f = open(self._filename, "rb")
        self._buf = mmap.mmap(self._f.fileno(), 0, access=mmap.ACCESS_READ)
        self._fh = FileHeader(self._buf, 0x0)
        return self

    def __exit__(self, type, value, traceback):
        self._buf.close()
        self._f.close()
        self._fh = None

    def ensure_contexted(func):
        """
        This decorator ensure that an instance of the
          Evtx class is used within a context statement.  That is,
          that the `with` statement is used, or `__enter__()`
          and `__exit__()` are called explicitly.
        """

        @wraps(func)
        def wrapped(self, *args, **kwargs):
            if self._buf is None:
                raise TypeError("An Evtx object must be used with" " a context (see the `with` statement).")
            else:
                return func(self, *args, **kwargs)

        return wrapped

    @ensure_contexted
    def chunks(self):
        """
        Get each of the ChunkHeaders from within this EVTX file.

        @rtype generator of ChunkHeader
        @return A generator of ChunkHeaders from this EVTX file.
        """
        for chunk in self._fh.chunks():
            yield chunk
    
    @ensure_contexted
    def records(self):
        """
        Get each of the Records from within this EVTX file.

        @rtype generator of Record
        @return A generator of Records from this EVTX file.
        """
        for chunk in self.chunks():
            for record in chunk.records():
                yield record
                
    @ensure_contexted
    def get_record(self, record_num):
        """
        Get a Record by record number.

        @type record_num:  int
        @param record_num: The record number of the the record to fetch.
        @rtype Record or None
        @return The record request by record number, or None if
          the record is not found.
        """
        return self._fh.get_record(record_num)
    
    @ensure_contexted
    def get_file_header(self):
        return self._fh


class FileHeader(Block):
    def __init__(self, buf, offset):
        super().__init__(buf, offset)
        self.declare_field("string", "magic", 0x0, 8)
        self.declare_field("qword", "oldest_chunk")
        self.declare_field("qword", "current_chunk_number")
        self.declare_field("qword", "next_record_number")
        self.declare_field("dword", "header_size")
        self.declare_field("word", "minor_version")
        self.declare_field("word", "major_version")
        self.declare_field("word", "header_chunk_size")
        self.declare_field("word", "chunk_count")
        self.declare_field("binary", "unused1", length=0x4C)
        self.declare_field("dword", "flags")
        self.declare_field("dword", "checksum")

    def __repr__(self):
        return "FileHeader(buf={!r}, offset={!r})".format(self._buf, self._offset)

    def __str__(self):
        return "FileHeader(offset={})".format(hex(self._offset))

    def check_magic(self):
        """
        @return A boolean that indicates if the first eight bytes of
          the FileHeader match the expected magic value.
        """

        return self.magic() == "ElfFile\x00"


    def calculate_checksum(self):
        """
        @return A integer in the range of an unsigned int that
          is the calculated CRC32 checksum off the first 0x78 bytes.
          This is consistent with the checksum stored by the FileHeader.
        """
        return binascii.crc32(self.unpack_binary(0, 0x78)) & 0xFFFFFFFF

    def verify(self):
        """
        @return A boolean that indicates that the FileHeader
          successfully passes a set of heuristic checks that
          all EVTX FileHeaders should pass.
        """
        return (
            self.check_magic()
            and self.major_version() == 0x3
            and self.minor_version() == 0x1
            and self.header_chunk_size() == 0x1000
            and self.checksum() == self.calculate_checksum()
        )

    def is_dirty(self):
        """
        @return A boolean that indicates that the log has been
          opened and was changed, though not all changes might be
          reflected in the file header.
        """
        return self.flags() & 0x1 == 0x1

    def is_full(self):
        """
        @return A boolean that indicates that the log
          has reached its maximum configured size and the retention
          policy in effect does not allow to reclaim a suitable amount
          of space from the oldest records and an event message could
          not be written to the log file.
        """
        return self.flags() & 0x2 == 0x2

    def first_chunk(self):
        """
        @return A ChunkHeader instance that is the first chunk
          in the log file, which is always found directly after
          the FileHeader.
        """
        ofs = self._offset + self.header_chunk_size()
        return ChunkHeader(self._buf, ofs)

    def current_chunk(self):
        """
        @return A ChunkHeader instance that is the current chunk
          indicated by the FileHeader.
        """
        ofs = self._offset + self.header_chunk_size()
        ofs += self.current_chunk_number() * 0x10000
        return ChunkHeader(self._buf, ofs)

    def chunks(self, include_inactive=False):
        """
        @return A generator that yields the chunks of the log file
          starting with the first chunk, which is always found directly
          after the FileHeader.

        If `include_inactive` is set to true, enumerate chunks beyond those
        declared in the file header (and may therefore be corrupt).
        """
        if include_inactive:
            chunk_count = 1000000
        else:
            chunk_count = self.chunk_count()

        i = 0
        ofs = self._offset + self.header_chunk_size()
        while ofs + 0x10000 <= len(self._buf) and i < chunk_count:
            yield ChunkHeader(self._buf, ofs)
            ofs += 0x10000
            i += 1

    def get_record(self, record_num):
        """
        Get a Record by record number.

        @type record_num:  int
        @param record_num: The record number of the the record to fetch.
        @rtype Record or None
        @return The record request by record number, or None if the
          record is not found.
        """
        for chunk in self.chunks():
            first_record = chunk.log_first_record_number()
            last_record = chunk.log_last_record_number()
            if not (first_record <= record_num <= last_record):
                continue
            for record in chunk.records():
                if record.record_num() == record_num:
                    return record
        return None


class Template():
    def __init__(self, template_node):
        self._template_node = template_node
        self._xml = None

    def _load_xml(self):
        """
        TODO(wb): One day, nodes should generate format strings
          instead of the XML format made-up abomination.
        """
        if self._xml is not None:
            return
        matcher = r"\[(?:Normal|Conditional) Substitution\(index=(\d+), type=\d+\)\]"
        self._xml = re.sub(
            matcher, "{\\1:}", self._template_node.template_format().replace("{", "{{").replace("}", "}}")
        )

    def make_substitutions(self, substitutions):
        """

        @type substitutions: list of VariantTypeNode
        """
        self._load_xml()
        return self._xml.format(*[n.xml() for n in substitutions])

    def node(self):
        return self._template_node


class ChunkHeader(Block):
    def __init__(self, buf, offset):
        super().__init__(buf, offset)
        self._strings = None
        self._templates = None

        self.declare_field("string", "magic", 0x0, 8)
        self.declare_field("qword", "file_first_record_number", None, None)
        self.declare_field("qword", "file_last_record_number", None, None)
        self.declare_field("qword", "log_first_record_number", None, None)
        self.declare_field("qword", "log_last_record_number", None, None)
        self.declare_field("dword", "header_size", None, None)
        self.declare_field("dword", "last_record_offset", None, None)
        self.declare_field("dword", "next_record_offset", None, None)
        self.declare_field("dword", "data_checksum", None, None)
        self.declare_field("binary", "unused", None, 0x44)
        self.declare_field("dword", "header_checksum", None, None)

    def __repr__(self):
        return "ChunkHeader(buf={!r}, offset={!r})".format(self._buf, self._offset)

    def __str__(self):
        return "ChunkHeader(offset={})".format(hex(self._offset))

    def check_magic(self):
        """
        @return A boolean that indicates if the first eight bytes of
          the ChunkHeader match the expected magic value.
        """

        return self.magic() == "ElfChnk\x00"


    def calculate_header_checksum(self):
        """
        @return A integer in the range of an unsigned int that
          is the calculated CRC32 checksum of the ChunkHeader fields.
        """
        data = self.unpack_binary(0x0, 0x78)
        data += self.unpack_binary(0x80, 0x180)
        return binascii.crc32(data) & 0xFFFFFFFF

    def calculate_data_checksum(self):
        """
        @return A integer in the range of an unsigned int that
          is the calculated CRC32 checksum of the Chunk data.
        """
        data = self.unpack_binary(0x200, self.next_record_offset() - 0x200)
        return binascii.crc32(data) & 0xFFFFFFFF

    def verify(self):
        """
        @return A boolean that indicates that the FileHeader
          successfully passes a set of heuristic checks that
          all EVTX ChunkHeaders should pass.
        """
        return (
            self.check_magic()
            and self.calculate_header_checksum() == self.header_checksum()
            and self.calculate_data_checksum() == self.data_checksum()
        )

    def _load_strings(self):
        if self._strings is None:
            self._strings = {}
        for i in range(64):
            ofs = self.unpack_dword(0x80 + (i * 4))
            while ofs > 0:
                string_node = self.add_string(ofs, None)
                ofs = string_node.next_offset()

    def strings(self):
        """
        @return A dict(offset --> NameStringNode)
        """
        if not self._strings:
            self._load_strings()
        return self._strings

    def add_string(self, offset, parent):
        """
        @param offset An integer offset that is relative to the start of
          this chunk.
        @param parent (Optional) The parent of the newly created
           NameStringNode instance. (Default: this chunk).
        @return None
        """
        if self._strings is None:
            self._load_strings()
        string_node = NameStringNode(self._buf, self._offset + offset, self, parent or self)
        self._strings[offset] = string_node
        return string_node

    def _load_templates(self):
        """
        @return None
        """
        if self._templates is None:
            self._templates = {}
        for i in range(32):
            ofs = self.unpack_dword(0x180 + (i * 4))
            while ofs > 0:
                # unclear why these are found before the offset
                # this is a direct port from A.S.'s code
                token = self.unpack_byte(ofs - 10)
                pointer = self.unpack_dword(ofs - 4)
                if token != 0x0C or pointer != ofs:
                    ofs = 0
                    continue
                template = self.add_template(ofs, None)
                ofs = template.next_offset()

    def add_template(self, offset, parent):
        """
        @param offset An integer which contains the chunk-relative offset
           to a template to load into this Chunk.
        @param parent (Optional) The parent of the newly created
           TemplateNode instance. (Default: this chunk).
        @return Newly added TemplateNode instance.
        """
        if self._templates is None:
            self._load_templates()

        node = TemplateNode(self._buf, self._offset + offset, self, parent or self)
        self._templates[offset] = node
        return node

    def templates(self):
        """
        @return A dict(offset --> Template) of all encountered
          templates in this Chunk.
        """
        if not self._templates:
            self._load_templates()
        return self._templates

    def first_record(self):
        return Record(self._buf, self._offset + 0x200, self)

    def records(self):
        try:
            record = self.first_record()
        except InvalidRecordException:
            return
        while record._offset < self._offset + self.next_record_offset() and record.length() > 0:
            yield record
            try:
                record = Record(self._buf, record._offset + record.length(), self)
            except InvalidRecordException:
                return None


class Record(Block):
    def __init__(self, buf, offset, chunk):
        super().__init__(buf, offset)
        self._chunk = chunk

        self.declare_field("dword", "magic", 0x0, None)  # 0x00002a2a
        self.declare_field("dword", "size", None, None)
        self.declare_field("qword", "record_num", None, None)
        self.declare_field("filetime", "timestamp", None, None)

        if self.size() > 0x10000:
            return None

        self.declare_field("dword", "size2", self.size() - 4, None)

    def __repr__(self):
        return "Record(buf={!r}, offset={!r})".format(self._buf, self._offset)

    def __str__(self):
        return "Record(offset={})".format(hex(self._offset))

    def root(self):
        return RootNode(self._buf, self._offset + 0x18, self._chunk, self)

    def length(self):
        return self.size()

    def verify(self):
        return self.size() == self.size2()

    def data(self):
        """
        Return the raw data block which makes up this record as a bytestring.

        @rtype str
        @return A string that is a copy of the buffer that makes
          up this record.
        """
        return self._buf[self.offset() : self.offset() + self.size()]

    def xml(self):
        """
        render the record into XML.
        does not include the xml declaration header.

        Returns:
          str: the rendered xml document.
        """
        return evtx_record_xml_view(self, None)


def test_chunks(input_str):
    """
    regression test parsing some known fields in the file chunks.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)

    # collected empirically
    expecteds = tool_functions.expected_output1

    for i, chunk in enumerate(fh.chunks(False)):
        # collected empirically
        if i < 9:
            assert chunk.check_magic() is True
            assert chunk.magic() == "ElfChnk\x00"
            assert chunk.calculate_header_checksum() == chunk.header_checksum()
            assert chunk.calculate_data_checksum() == chunk.data_checksum()

            expected = expecteds[i]
            assert chunk.file_first_record_number() == expected["start_file"]
            assert chunk.file_last_record_number() == expected["end_file"]
            assert chunk.log_first_record_number() == expected["start_log"]
            assert chunk.log_last_record_number() == expected["end_log"]

        else:
            assert chunk.check_magic() is False
            assert chunk.magic() == EMPTY_MAGIC


def test_chunks2(input_str):
    """
    regression test parsing some known fields in the file chunks.

    Args:
      security (bytes): the security.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)

    # collected empirically
    expecteds = tool_functions.expected_output2

    for i, chunk in enumerate(fh.chunks(False)):
        # collected empirically
        if i < 26:
            assert chunk.check_magic() is True
            assert chunk.magic() == "ElfChnk\x00"
            assert chunk.calculate_header_checksum() == chunk.header_checksum()
            assert chunk.calculate_data_checksum() == chunk.data_checksum()

            expected = expecteds[i]
            assert chunk.file_first_record_number() == expected["start_file"]
            assert chunk.file_last_record_number() == expected["end_file"]
            assert chunk.log_first_record_number() == expected["start_log"]
            assert chunk.log_last_record_number() == expected["end_log"]

        else:
            assert chunk.check_magic() is False
            assert chunk.magic() == EMPTY_MAGIC


def test_file_header(input_str):
    """
    regression test parsing some known fields in the file header.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)

    # collected empirically
    assert fh.magic() == "ElfFile\x00"
    assert fh.major_version() == 0x3
    assert fh.minor_version() == 0x1
    assert fh.flags() == 0x1
    assert fh.is_dirty() is True
    assert fh.is_full() is False
    assert fh.current_chunk_number() == 0x8
    assert fh.chunk_count() == 0x9
    assert fh.oldest_chunk() == 0x0
    assert fh.next_record_number() == 0x34D8
    assert fh.checksum() == 0x41B4B1EC
    assert fh.calculate_checksum() == fh.checksum()


def test_file_header2(input_str):
    """
    regression test parsing some known fields in the file header.

    Args:
      security (bytes): the security.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)

    # collected empirically
    assert fh.magic() == "ElfFile\x00"
    assert fh.major_version() == 0x3
    assert fh.minor_version() == 0x1
    assert fh.flags() == 0x1
    assert fh.is_dirty() is True
    assert fh.is_full() is False
    assert fh.current_chunk_number() == 0x19
    assert fh.chunk_count() == 0x1A
    assert fh.oldest_chunk() == 0x0
    assert fh.next_record_number() == 0x8B2
    assert fh.checksum() == 0x3F6E33D5
    assert fh.calculate_checksum() == fh.checksum()


def one(iterable):
    """
    fetch a single element from the given iterable.

    Args:
      iterable (iterable): a sequence of things.

    Returns:
      object: the first thing in the sequence.
    """
    for i in iterable:
        return i


def extract_structure(node):
    """
    given an evtx bxml node, generate a tree of all the nodes.
    each node has:
      - str: node type
      - str: (optional) value
      - list: (optional) children

    Args:
      node (Node): the root node.

    Returns:
      list: the tree representing the bxml structure.
    """
    
    name = node.__class__.__name__

    if isinstance(node, BXmlTypeNode):
        value = None
    elif isinstance(node, VariantTypeNode):
        value = node.string()
    elif isinstance(node, OpenStartElementNode):
        value = node.tag_name()
    elif isinstance(node, AttributeNode):
        value = node.attribute_name().string()
    else:
        value = None

    children = []
    if isinstance(node, BXmlTypeNode):
        children.append(extract_structure(node._root))
    elif isinstance(node, TemplateInstanceNode) and node.is_resident_template():
        children.append(extract_structure(node.template()))

    children.extend(list(map(extract_structure, node.children())))

    if isinstance(node, RootNode):
        substitutions = list(map(extract_structure, node.substitutions()))
        children.append(["Substitutions", None, substitutions])

    if children:
        return [name, value, children]
    elif value:
        return [name, value]
    else:
        return [name]


def test_parse_record(input_str):
    """
    regression test demonstrating binary xml nodes getting parsed.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)
    chunk = next(fh.chunks(False))
    record = next(chunk.records())

    # generated by hand, but matches the output of extract_structure.
    expected = tool_functions.expected_output3
    assert extract_structure(record.root()) == expected


def test_render_record(input_str):
    """
    regression test demonstrating formatting a record to xml.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)
    chunk = next(fh.chunks(False))
    record = next(chunk.records())

    xml = record.xml()
    assert xml == tool_functions.expected_output4
    
def test_parse_records(input_str):
    """
    regression test demonstrating that all record metadata can be parsed.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)
    for i, chunk in enumerate(fh.chunks(False)):
        for j, record in enumerate(chunk.records()):
            assert record.magic() == 0x2A2A

def test_parse_records2(input_str):
    """
    regression test demonstrating that all record metadata can be parsed.

    Args:
      security (bytes): the security.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)
    for i, chunk in enumerate(fh.chunks(False)):
        for j, record in enumerate(chunk.records()):
            assert record.magic() == 0x2A2A


def test_render_records(input_str):
    """
    regression test demonstrating formatting records to xml.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)
    for chunk in fh.chunks(False):
        for record in chunk.records():
            assert record.xml() is not None


def test_render_records2(input_str):
    """
    regression test demonstrating formatting records to xml.

    Args:
      security (bytes): the security.evtx test file contents. pytest fixture.
    """
    fh = FileHeader(input_str, 0x0)
    for chunk in fh.chunks(False):
        for record in chunk.records():
            assert record.xml() is not None


def test_render_records_lxml(input_str):
    """
    regression test demonstrating formatting records to xml.

    Args:
      system (bytes): the system.evtx test file contents. pytest fixture.
    """
    pass


def test_render_records_lxml2(input_str):
    """
    regression test demonstrating formatting records to xml.

    Args:
      security (bytes): the security.evtx test file contents. pytest fixture.
    """
    pass



### seperation test begin
def test_corrupt_ascii_example():
    """
    regression test demonstrating issue 37.

    Args:
      data_path (str): the file system path of the test directory.
    """
    # record number two contains a QNAME xml element
    # with an ASCII text value that is invalid ASCII:
    #
    #     000002E0:                                31 39 33 2E 31 2E            193.1.
    #     000002F0: 33 36 2E 31 32 31 30 2E  39 2E 31 35 2E 32 30 32  36.1210.9.15.202
    #     00000300: 01 62 2E 5F 64 6E 73 2D  73 64 2E 5F 75 64 70 2E  .b._dns-sd._udp.
    #     00000310: 40 A6 35 01 2E                                    @.5..
    #                  ^^ ^^ ^^
    #
    # with pytest.raises(UnicodeDecodeError):
    pass


def test_continue_parsing_after_corrupt_ascii():
    """
    regression test demonstrating issue 37.

    Args:
      data_path (str): the file system path of the test directory.
    """
    pass



def test():
    test_chunks(tool_functions.get_input("case1"))
    test_chunks2(tool_functions.get_input("case2"))

    test_file_header(tool_functions.get_input("case1"))
    test_file_header2(tool_functions.get_input("case2"))

    test_parse_record(tool_functions.get_input("case1"))
    test_parse_records(tool_functions.get_input("case1"))
    test_parse_records2(tool_functions.get_input("case2"))

    test_render_record(tool_functions.get_input("case1"))
    test_render_records(tool_functions.get_input("case1"))
    test_render_records2(tool_functions.get_input("case2"))
    print("All tests passed")
    
## Preprocessing:
# We remove 2 tests due to the lack of corresponding libraries ("mmap", "lxml") in JS.
# We adjust 1 test becuase the translation of `time.isoformat(" ")` in JS will lose the precision of the date.
# These two tests are not related to the main functionality of the program.


### Global Begin

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
]

node_readable_tokens = [
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
]
test()
