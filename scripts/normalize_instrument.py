import tree_sitter_python as tspython
from tree_sitter import Language, Parser
import sys

PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

python_built_in_types = [
    "str",
    "int",
    "float",
    "complex",
    "list",
    "tuple",
    "range",
    "dict",
    "set",
    "frozenset",
    "bool",
    "bytes",
    "bytearray"
    "memoryview",
    "enumerate",
    "zip",
]
python_built_in_funcs = [
    "abs",
    "all",
    "any",
    "ascii",
    "bin",
    "bool",
    "bytearray",
    "bytes",
    "callable",
    "chr",
    "classmethod",
    "compile",
    "complex",
    "delattr",
    "dict",
    "dir",
    "divmod",
    "enumerate",
    "eval",
    "exec",
    "filter",
    "float",
    "format",
    "frozenset",
    "getattr",
    "globals",
    "hasattr",
    "hash",
    "help",
    "hex",
    "id",
    "input",
    "int",
    "isinstance",
    "issubclass",
    "iter",
    "len",
    "list",
    "locals",
    "map",
    "max",
    "memoryview",
    "min",
    "next",
    "object",
    "oct",
    "open",
    "ord",
    "pow",
    "print",
    "property",
    "range",
    "repr",
    "reversed",
    "round",
    "set",
    "setattr",
    "slice",
    "sorted",
    "staticmethod",
    "str",
    "sum",
    "super",
    "tuple",
    "type",
    "vars",
    "zip",
]
python_built_in_exceptions = [
    "ArithmeticError",
    "AssertionError",
    "AttributeError",
    "Exception",
    "EOFError",
    "FloatingPointError",
    "GeneratorExit",
    "ImportError",
    "IndentationError",
    "IndexError",
    "KeyError",
    "KeyboardInterrupt",
    "LookupError",
    "MemoryError",
    "NameError",
    "NotImplementedError",
    "OSError",
    "OverflowError",
    "ReferenceError",
    "RuntimeError",
    "StopIteration",
    "SyntaxError",
    "TabError",
    "SystemError",
    "SystemExit",
    "TypeError",
    "UnboundLocalError",
    "UnicodeError",
    "UnicodeEncodeError",
    "UnicodeDecodeError",
    "UnicodeTranslateError",
    "ValueError",
    "ZeroDivisionError",
]
python_potential_imported_classes = [
    "partial",
] 

inst_head = """

import os
_file_path = os.path.abspath(__file__)
_directory = os.path.dirname(_file_path)
_filename = os.path.basename(_file_path)
_cur_file = os.path.join(_directory, _filename)
_call_match = {}
_properties = set()
_call_stack = []

def _instrument_begin(idx):
    if len(_call_stack) == 0:
        return
    last = _call_stack.pop()
    if last in _call_match:
        _call_match[last].add(idx)
    else:
        _call_match[last] = set([idx])
    return

def _instrument_property(f_name, idx):
    _properties.add(f_name)

def _instrument_call(f, idx):
    if f.__class__.__name__ == 'builtin_function_or_method':
        return f
    
    if f.__class__.__name__ == 'function' and f.__code__.co_filename != _cur_file:
        return f
    
    _call_stack.append(idx)
    return f

op_record = {"eq": {}, "contain": {}}
def _instrument_eq(op, a, b, idx):
    if idx not in op_record["eq"]:
        op_record["eq"][idx] = {"overload": False, "normal": False}
        
    if hasattr(a, '__eq__'):
        if "method-wrapper" in str(a.__eq__):
            op_record["eq"][idx]["normal"] = True
        else:
            op_record["eq"][idx]["overload"] = True
    op_record["eq"][idx]["normal"] = True
    
    if op == '==':
        return a == b
    else:
        return a != b

def _instrument_contain(a, b, idx):
    if idx not in op_record["contain"]:
        op_record["contain"][idx] = {"overload": False, "normal": False}
        
    if hasattr(b, '__contains__'):
        if "method-wrapper" in str(b.__contains__):
            op_record["contain"][idx]["normal"] = True
        else:
            op_record["contain"][idx]["overload"] = True
    op_record["contain"][idx]["normal"] = True
    return a in b
"""

inst_end = lambda folder: f"""
import json

_call_match = {{k: list(v) for k, v in _call_match.items()}}
_properties = list(_properties)
dynamic_analysis_result = {{'call_match': _call_match, 'op_record': op_record, 'properties': _properties}}
json.dump(dynamic_analysis_result, open('{folder}/dynamic_analysis_result.json', 'w'))

"""

skip_inst_funtion_names = [
    "__get__", ### for attribute access
    "__eq__", ### for '==' operator
    "__contains__", ### for 'in' operator
    "__bool__", ### for 'conditional' statement
]

def read_file(file):
    with open(file, 'r') as f:
        return f.read()

def write_file(file, content):
    with open(file, 'w') as f:
        f.write(content)

def add_indent (indent, code):
    return "\n".join([indent * " " + line for line in code.split("\n")])

def instrument_code(source_code, root_node):
    assert root_node.type == 'module'
    inst_code = ""
    idx = ""
    future_import = ""
    for child in root_node.children:
        if child.type == "future_import_statement":
            future_import = future_import + child.text.decode("utf-8") + "\n"
            continue
        inst_code += rewrite_node(source_code, child, idx + '|' + str(root_node.children.index(child))) + "\n"
        
    inst_code = inst_head + inst_code
    inst_code += inst_end(folder)
    
    inst_code = future_import + inst_code
    
    return inst_code

def instrument_func(source_code, target_func_node, idx):

    inst_func = rewrite_node(source_code, target_func_node.children[0], idx + "|0")
    
    for child in target_func_node.children[1:-1]:
        # if child.start_point[0] > target_func_node.children[target_func_node.children.index(child) - 1].end_point[0]:
        #     con = "\n"
        # else:
        dis = child.start_point[1] - target_func_node.children[target_func_node.children.index(child) - 1].end_point[1]
        con = dis * " "
        inst_func += con +  rewrite_node(source_code, child, idx + '|' + str(target_func_node.children.index(child)))
    
    assert target_func_node.children[-1].type == 'block'
    body_node = target_func_node.children[-1]
    body_node_idx = idx + '|' + str(len(target_func_node.children) - 1)
    
    inst_func += "\n"

    if target_func_node.parent.type == 'decorated_definition' and target_func_node.parent.children[0].text.decode("utf-8") == '@property':
        f_name = target_func_node.children[1].text.decode("utf-8")
        inst_func += add_indent(4, f"_instrument_property('{f_name}', '{idx}')") + "\n"
    elif target_func_node.children[1].text.decode("utf-8") not in skip_inst_funtion_names:
        inst_func += add_indent(4, f"_instrument_begin('{idx}')") + "\n"

    for child in body_node.children:
        inst_func += add_indent(4, rewrite_node(source_code, child, body_node_idx + '|' + str(body_node.children.index(child)))) + "\n"
    return inst_func

def rewrite_node(code, node, idx):
    # Reconstruct code for other node types
    if len(node.children) == 0:
        return code[node.start_byte:node.end_byte]
    else:
        if node.type == 'block':
            return '\n'.join([add_indent(4, rewrite_node(code, child, idx + '|' + str(i))) for i, child in enumerate(node.children)])
        elif node.type == 'function_definition':
            return instrument_func(code, node, idx)
        elif node.type == 'string_content':
            return code[node.start_byte:node.end_byte]
        elif node.type == 'comparison_operator': ### Instrument for operator overloading. Only support '==' and 'in' now
            if node.children[1].text.decode("utf-8") in ['==', '!=']:
                op = node.children[1].text.decode("utf-8")
                return f"_instrument_eq('{op}', {rewrite_node(code, node.children[0], idx + '|0')}, {rewrite_node(code, node.children[2], idx + '|2')}, '{idx}')"
            elif node.children[1].text.decode("utf-8") == 'in':
                return f"_instrument_contain({rewrite_node(code, node.children[0], idx + '|0')}, {rewrite_node(code, node.children[2], idx + '|2')}, '{idx}')"
            else:
                pass
        elif (node.type == 'call' and
              node.children[0].text.decode("utf-8") not in python_built_in_funcs and
              node.children[0].text.decode("utf-8") not in python_built_in_types and
              node.children[0].text.decode("utf-8") not in python_built_in_exceptions and
              node.children[0].text.decode("utf-8") not in python_potential_imported_classes and
              node.children[0].text.decode("utf-8")[-6:] not in ['.match']):
            funcname = rewrite_node(code, node.children[0], idx + "|0")
            func = f"_instrument_call({funcname}, '{idx}')"
            return func + rewrite_node(code, node.children[1], idx + "|1")
        
        tar = rewrite_node(code, node.children[0], idx + "|0")
        for child in node.children[1:]:
            if child.start_point[0] > node.children[node.children.index(child) - 1].end_point[0]:
                con = "\n"
            else:
                dis = child.start_point[1] - node.children[node.children.index(child) - 1].end_point[1]
                con = dis * " "
            tar += con + rewrite_node(code, child, idx + '|' + str(node.children.index(child)))
        return tar


if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    folder = sys.argv[1]
    code = read_file(folder + '/source.py')
    tree = parser.parse(bytes(code, "utf8"))
    root_node = tree.root_node
    inst_code = instrument_code(code, root_node)
    write_file(folder + '/source_inst.py', inst_code)
