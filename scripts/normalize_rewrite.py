import tree_sitter_python as tspython
from tree_sitter import Language, Parser
import json
import sys
PRINT_WARNING = False
folder = "./benchmarks_new/test"
skel_head_py = """
### SKEL HEAD BEGIN
def user_get_type(obj):
    if hasattr(obj, '_class_name'):
        return "<function " + obj._class_name.split(";")[0] + " >"
    else:
        return type(obj)

def user_check_type(obj, _type):
    if str(_type).startswith("<class") and str(_type).split("'")[1] in ["dict", "object"]:
        return isinstance(obj, _type)
    elif hasattr(obj, '_class_name'):
        if "function" in str(_type):
            for i in obj._class_name.split(";"):
                if i == str(_type).split(" ")[1]:
                    return True
            return False
    else:
        if str(_type).startswith("<function"):
            typename = str(_type).split(" ")[1]
            if typename == 'func_dict':
                return isinstance(obj, dict)
        return isinstance(obj, _type)


def SkelClass(class_name, super_class=None):
    if super_class is None:
        class myclass:
            _class_name = class_name
    else:
        class myclass(super_class):
            _class_name = class_name
    return myclass()

### SKEL HEAD END

"""

skel_head_js = """
/// SKEL HEAD BEGIN
function user_check_type(obj, _type) {
    if (typeof obj === 'object' && !Array.isArray(obj) && obj !== null && obj.hasOwnProperty("_class_name")) {
        if (String(_type).includes('function')) {
            for (let i of obj["_class_name"].split(";")) {
                if (i === String(_type).split(" ")[1].split("(")[0]) {
                    return true;
                }
            }
            return false;
        } else if (typeof _type === 'string') {
            for (let i of obj["_class_name"].split(";")) {
                if (i === _type) {
                    return true;
                }
            }
            return false;
        }
        else{
            return false;
        }
    } else {
        if (typeof _type === 'symbol') {
            if (_type.description === 'str' || _type.description === 'string') {
                return typeof obj === 'string';
            }
            if (_type.description === 'list' || _type.description === 'array') {
                return Array.isArray(obj);
            }
            if (_type.description === 'dict') {
                return obj.constructor === Object;
            }
            if (_type.description === 'int' || _type.description === 'number') {
                return Number.isSafeInteger(obj)  && obj !== 1e6;;
            }
            if (_type.description === 'float') {
                return typeof obj === 'number';
            }
            if (_type.description === 'bool' || _type.description === 'boolean') {
                return typeof obj === 'boolean';
            }
            if (_type.description === 'datetime') {
                return obj instanceof Date;
            }
            if (_type.description === 'time') {
                return obj instanceof Date && obj.getFullYear() === 1970 && obj.getMonth() === 0 && obj.getDate() === 1;
            }
            if (_type.description === 'date') {
                return obj instanceof Date && obj.getHours() === 0 && obj.getMinutes() === 0 && obj.getSeconds() === 0;
            }
            return false;
        }

        if (typeof _type === 'string') {
            if (_type === 'str' || _type === 'string') {
                return typeof obj === 'string';
            }
            if (_type === 'list' || _type === 'array') {
                return Array.isArray(obj);
            }
            if (_type === 'dict') {
                return obj.constructor === Object;
            }
            if (_type === 'int' || _type === 'number') {
                return Number.isSafeInteger(obj) && obj !== 1e6;
            }
            if (_type === 'float') {
                return typeof obj === 'number';
            }
            if (_type === 'bool' || _type === 'boolean') {
                return typeof obj === 'boolean';
            }
            if (_type === 'datetime') {
                return obj instanceof Date;
            }
            if (_type === 'time') {
                return obj instanceof Date && obj.getFullYear() === 1970 && obj.getMonth() === 0 && obj.getDate() === 1;
            }
            if (_type === 'date') {
                return obj instanceof Date && obj.getHours() === 0 && obj.getMinutes() === 0 && obj.getSeconds() === 0;
            }
            return false;
        }
        else return obj instanceof _type;
    }
}


function SkelClass(name) {
    let _class_var = {};
    _class_var._class_name = name;
    return _class_var;
}

/// SKEL HEAD END

"""

shim_for_callable_class_def_py = """
    tmp_f = param_0
    def self_func(*args):
        return tmp_f(*args[1:])
    param_0 = self_func

"""

shim_for_callable_class_def_js = """
    var tmp_f = param_0;
    function self_func(...arguments) {
        return tmp_f(...arguments.slice(1));
    }
    param_0 = self_func;

"""

shim_for_callable_class_call_py = """
    def self_call(*args):
        return __call__(decorated_object, *args)

"""

shim_for_callable_class_call_js = """
    function self_call(...arguments) {
        return __call__(decorated_object, ...arguments);
    }

"""

built_in_super_class = [
    "object",
    "dict",
]

built_in_types = [
    "int",
    "float",
    "str",
    "list",
    "tuple",
    "set",
    "dict",
    "bool",
]

PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

block_id2func_name = {}
class_name2block_id = {}
total_block_id = 1

def add_indent (indent, code):
    return "\n".join([indent * " " + line for line in code.split("\n")])

def read_file(file):
    with open(file, 'r') as f:
        return f.read()

def write_file(file, content):
    with open(file, 'w') as f:
        f.write(content)

def check_is_generator(node):
    for child in node.children:
        if child.type == "yield":
            return True
        elif child.type not in ["function_definition", "decorated_definition", "class_definition"] and check_is_generator(child):
            return True
        else:
            pass
    return False


def find_arg_index(params, arg):
    for i, param in enumerate(params[1:-1]):
        if param.type == "identifier" and param.text.decode("utf-8") == arg.text.decode("utf-8"):
            return i // 2
        elif param.type == "default_parameter" and param.children[0].text.decode("utf-8") == arg.text.decode("utf-8"):
            return i // 2
    return -1
    
    
def normalizeValue(params, node):
    
    if node.type == "identifier":
        arg_idx = find_arg_index(params, node)
        if arg_idx >= 0:
            return f"param_{arg_idx}", f"param_{arg_idx}"
        if PRINT_WARNING:
            print("Warning: Unsupported value type:", node.type, node.text.decode("utf-8"))
        return "'Error: Type not support'", "'Error: Type not support'"
    elif node.type in ["string", "integer", "float"]:
        return node.text.decode("utf-8"), node.text.decode("utf-8")
    elif node.type == "none":
        return "None", "null"
    elif node.type == "true":
        return "True", "true"
    elif node.type == "false":
        return "False", "false"
    elif node.type == "list":
        res_list = [normalizeValue(params, child) for child in node.children[1:-1] if child.text.decode("utf-8") != ',']
        py = "[" + ", ".join([res[0] for res in res_list]) + "]"
        js = "[" + ", ".join([res[1] for res in res_list]) + "]"
        return py, js
    else:
        if PRINT_WARNING:
            print("Warning: Unsupported value type:", node.type, node.text.decode("utf-8"))
        return "'Error: Type not support'", "'Error: Type not support'"

def normalizeParams(params):
    normalized_params_code = ""
    js_template_params_code = ""
    kws = []
    for param in params[1:-1]:
        if param.type == "identifier" and param.text.decode("utf-8") == "self":
            normalized_params_code += "class_var"
            js_template_params_code += "class_var"
        elif param.type == "list_splat_pattern":
            normalized_params_code += param.text.decode("utf-8")
            js_template_params_code += "..." + param.children[1].text.decode("utf-8")
        elif param.type == "dictionary_splat_pattern":
            kws.append(param.children[1].text.decode("utf-8"))
        elif param.type == "typed_parameter":
            normalized_params_code += param.children[0].text.decode("utf-8")
            js_template_params_code += param.children[0].text.decode("utf-8")
        elif param.type == "default_parameter":
            normalized_params_code += param.children[0].text.decode("utf-8")
            js_template_params_code += param.children[0].text.decode("utf-8")
        elif param.type == "typed_default_parameter":
            normalized_params_code += param.children[0].text.decode("utf-8")
            js_template_params_code += param.children[0].text.decode("utf-8")
        elif param.text.decode("utf-8") == ",":
            normalized_params_code += ", "
            js_template_params_code += ", "
        else:
            normalized_params_code += param.text.decode("utf-8")
            js_template_params_code += param.text.decode("utf-8")
            
    if normalized_params_code[-2:] == ", ":
        normalized_params_code = normalized_params_code[:-2]
    
    if js_template_params_code[-2:] == ", ":
        js_template_params_code = js_template_params_code[:-2]

    return normalized_params_code, js_template_params_code, kws


def getSuperArgs(init_function_node):
    init_body = init_function_node.child_by_field_name("body")
    for exp_node in init_body.children:
        if exp_node.type == "expression_statement" and exp_node.children[0].type == "call":
            stmt_node = exp_node.children[0]
            function_node = stmt_node.child_by_field_name("function")
            if (function_node.type == 'attribute' and 
                function_node.children[2].text.decode('utf-8') == '__init__' and
                function_node.children[0].type == 'call' and
                function_node.children[0].child_by_field_name('function').text.decode("utf-8") == 'super'):
                
                super_args = stmt_node.child_by_field_name('arguments').children
                return super_args
    return []

def normalizeSuperArgs(args, init_params):
    normalized_args_code = ""
    js_template_args_code = ""
    for arg in args[1:-1]:
        if arg.type == "identifier" and arg.text.decode("utf-8") == "self":
            # normalized_args_code += "class_var"
            # js_template_args_code += "class_var"
            pass
        elif arg.type == "keyword_argument":
            normalized_value_py, normalized_value_js = normalizeValue(init_params, arg.children[2])
            normalized_args_code += normalized_value_py
            js_template_args_code += normalized_value_js
        elif arg.text.decode("utf-8") == ",":
            normalized_args_code += ", "
            js_template_args_code += ", "
        else:
            normalized_value_py, normalized_value_js = normalizeValue(init_params, arg)
            normalized_args_code += normalized_value_py
            js_template_args_code += normalized_value_js

    if normalized_args_code[-2:] == ", ":
        normalized_args_code = normalized_args_code[:-2]
    
    if js_template_args_code[-2:] == ", ":
        js_template_args_code = js_template_args_code[:-2]

    return normalized_args_code, js_template_args_code


def normalizeClassParams(params):
    return normalizeInitArgs(params)

def normalizeInitArgs(args):
    normalized_args_code = ""
    js_template_args_code = ""
    
    for i, arg in enumerate(args[1:-1]):
        if arg.text.decode("utf-8") == ",":
            normalized_args_code += ", "
            js_template_args_code += ", "
        else:
            normalized_args_code += f"param_{i // 2}"
            js_template_args_code += f"param_{i // 2}"

    if normalized_args_code[-2:] == ", ":
        normalized_args_code = normalized_args_code[:-2]
    
    if js_template_args_code[-2:] == ", ":
        js_template_args_code = js_template_args_code[:-2]

    return normalized_args_code, js_template_args_code

def normalizeSimpleClass(class_node, node_idx):
    normalized_class_code = class_node.text.decode("utf-8") + "\n"
    js_template_class_code = class_node.child_by_field_name("name").text.decode("utf-8") + " = {\n"
    
    for stmt in class_node.child_by_field_name("body").children:
        var_name = stmt.children[0].child_by_field_name("left").text.decode("utf-8")
        value = stmt.children[0].child_by_field_name("right").text.decode("utf-8")
        js_template_class_code += f'"{var_name}": {value}' + ",\n"
    
    js_template_class_code += "}\n"
    return normalized_class_code, js_template_class_code

def normalizeClass(class_node, node_idx):
    
    normalized_class_code = ""
    js_template_class_code = ""
    has_init = False
    is_call = False
    init_params = None
    super_args = None
    member_function_names = []
    decorated_signs = []
    global total_block_id
    
    if all([(child.type == "expression_statement" 
            and child.children[0].type == "assignment")
            for child in class_node.child_by_field_name("body").children]):
        return normalizeSimpleClass(class_node, node_idx)

    class_member_functions = []
    class_name = class_node.child_by_field_name("name").text.decode("utf-8")
    body_node_idx = node_idx + '|' + str(class_node.children.index(class_node.child_by_field_name("body")))
    
    for child in class_node.child_by_field_name("body").children:
        child_node_idx = body_node_idx + '|' + str(class_node.child_by_field_name("body").children.index(child))
        if child.type == "function_definition":
            if child.child_by_field_name("name").text.decode("utf-8") == "__init__":
                init_params = child.child_by_field_name("parameters").children
                has_init = True
                super_args = getSuperArgs(child)
            if child.child_by_field_name("name").text.decode("utf-8") == "__call__":
                is_call = True
            
            py_function_code, js_function_code = normalizeFunction(child, child_node_idx)
            
            class_member_functions.append(total_block_id - 1)

            normalized_class_code += add_indent(4, py_function_code) + "\n"
            js_template_class_code += add_indent(4, js_function_code) + "\n"
            member_function_names.append(child.child_by_field_name("name").text.decode("utf-8"))
            
        elif child.type == "decorated_definition":
            py_decorated_code, js_decorated_code, decorated_sign_py, decorated_sign_js = normalizeDecoratedFunction(child, child_node_idx)

            class_member_functions.append(total_block_id - 1)

            if decorated_sign_py != None:
                decorated_signs.append((decorated_sign_py, decorated_sign_js))
            normalized_class_code += add_indent(4, py_decorated_code) + "\n"
            js_template_class_code += add_indent(4, js_decorated_code) + "\n"
            member_function_names.append(child.child_by_field_name("definition").child_by_field_name("name").text.decode("utf-8"))
            
        elif child.type == "comment" or child.type == "expression_statement" and child.children[0].type == "string":
            normalized_class_code += 4 * " " + source_code[child.start_byte:child.end_byte] + "\n"
        else:
            pass
    
    if has_init:
        py_params, js_params = normalizeClassParams(init_params[2:])
    
        if is_call:
            py_params = py_params + ", decorated_object = None"
            js_params = js_params + ", decorated_object = null"
    else:
        py_params, js_params = "*args", "...args"

    normalized_class_code = f"def {class_name}({py_params}):" + "\n" + normalized_class_code
    js_template_class_code = f"function {class_name}({js_params})" + "{\n" + js_template_class_code
    
    if (class_node.child_by_field_name("superclasses") and len(class_node.child_by_field_name("superclasses").children) > 2):

        first_inheritance = class_node.child_by_field_name("superclasses").children[1].text.decode("utf-8") ### Assume only single inheritance
        
        ### Built-in super class only includes object and dict
        if first_inheritance in ["dict", "tzinfo"]:
            normalized_class_code += add_indent(4, f"class_var = SkelClass(class_name='{first_inheritance}', super_class={first_inheritance})") + "\n"
            js_template_class_code += add_indent(4, f"var class_var = {{}};") + "\n"
            
        elif first_inheritance == "object": # Do nothing for 'object'
            
            normalized_class_code += add_indent(4, f"class_var = SkelClass('{class_name}')") + "\n"
            js_template_class_code += add_indent(4, f"var class_var = SkelClass('{class_name}');") + "\n"
        
        else:
            if has_init:
                py_super_args, js_super_args = normalizeSuperArgs(super_args, init_params[2:])
            else:
                py_super_args, js_super_args = "*args", "...args"
            
            normalized_class_code += add_indent(4, f"class_var = {first_inheritance}({py_super_args})") + "\n"
            js_template_class_code += add_indent(4, f"var class_var = {first_inheritance}({js_super_args});") + "\n"
            
            normalized_class_code += add_indent(4, f"class_var._class_name = '{class_name};' + class_var._class_name") + "\n"
            js_template_class_code += add_indent(4, f"class_var._class_name = '{class_name};' + class_var._class_name;") + "\n"
    else:
        normalized_class_code += add_indent(4, f"class_var = SkelClass('{class_name}')") + "\n"
        js_template_class_code += add_indent(4, f"var class_var = SkelClass('{class_name}');") + "\n"
    
    for decorated_sign in decorated_signs:
        normalized_class_code += add_indent(4, decorated_sign[0]) + "\n"
        js_template_class_code += add_indent(4, decorated_sign[1]) + "\n"
    
    
    if is_call: ### If is callable class
        normalized_class_code += shim_for_callable_class_def_py
        js_template_class_code += shim_for_callable_class_def_js
    
    
    for member_function_name in member_function_names:
        normalized_class_code += add_indent(4, f"class_var.{member_function_name} = {member_function_name}") + "\n"
        js_template_class_code += add_indent(4, f"class_var.{member_function_name} = {member_function_name};") + "\n"
    
    if has_init:
        py_args, js_args = normalizeInitArgs(init_params[2:])
        normalized_class_code += add_indent(4, f"__init__({py_args})") + "\n"
        js_template_class_code += add_indent(4, f"__init__({js_args});") + "\n"
    
    
    if is_call: ### If is callable class
        normalized_class_code += shim_for_callable_class_call_py
        js_template_class_code += shim_for_callable_class_call_js
        
        normalized_class_code += add_indent(4, "return self_call") + "\n"
        js_template_class_code += add_indent(4, "return self_call;") + "\n}\n"
    else:
        normalized_class_code += add_indent(4, "return class_var") + "\n"
        js_template_class_code += add_indent(4, "return class_var;") + "\n}\n"
    
    normalized_class_code += "\n"
    js_template_class_code += "\n"

    class_name2block_id[class_name] = class_member_functions
    
    return normalized_class_code, js_template_class_code


def normalizeDecoratedFunction(function_node, node_idx):
    normalized_function_code = ""
    js_template_function_code = ""
    
    function_name = function_node.child_by_field_name("definition").child_by_field_name("name").text.decode("utf-8")
    decorator_name = function_node.children[0].children[1].text.decode("utf-8")
    
    def_node = function_node.child_by_field_name("definition")
    def_node_idx = node_idx + '|' + str(function_node.children.index(def_node))
    py_tmp, js_tmp = normalizeFunction(def_node, def_node_idx)
    normalized_function_code += py_tmp
    js_template_function_code += js_tmp
    
    if  function_node.type == 'decorated_definition' and function_node.children[0].text.decode("utf-8") in ['@property', '@staticmethod']:
        return normalized_function_code, js_template_function_code, None, None
    
    if function_node.parent.type == "block" and function_node.parent.parent.type == "class_definition":
        decorated_sign_py = f"{function_name} = {decorator_name}({function_name}, class_var)" + "\n"
        decorated_sign_js = f"{function_name} = {decorator_name}({function_name}, class_var);" + "\n"
    else:
        decorated_sign_py = f"{function_name} = {decorator_name}({function_name})" + "\n"
        decorated_sign_js = f"{function_name} = {decorator_name}({function_name});" + "\n"
    
    return normalized_function_code, js_template_function_code, decorated_sign_py, decorated_sign_js


def normalizeFunction(function_node, node_idx):
    
    normalized_function_code = ""
    js_template_function_code = ""
    
    
    function_args = function_node.child_by_field_name('parameters').children
    if function_args[1].type == "identifier" and function_args[1].text.decode("utf-8") == "self":
        # if function_node.parent.type != "decorated_definition":
        py_params, js_params, kws = normalizeParams(function_args[2:])
    else:
        py_params, js_params, kws = normalizeParams(function_args)
    
    normalized_function_code += f"def {function_node.child_by_field_name('name').text.decode('utf-8')}({py_params}):" + "\n"
    if check_is_generator(function_node.child_by_field_name('body')):
        js_template_function_code += f"function* {function_node.child_by_field_name('name').text.decode('utf-8')}({js_params})" + "{\n"
    else:
        js_template_function_code += f"function {function_node.child_by_field_name('name').text.decode('utf-8')}({js_params})" + "{\n"
    
    if len(kws) > 0:
        normalized_function_code += add_indent(4, f"{kws[0]} = {{}}") + "\n"
        js_template_function_code += add_indent(4, f"var {kws[0]} = {{}};") + "\n"
        
    body_node = function_node.child_by_field_name('body')
    body_node_idx = node_idx + '|' + str(function_node.children.index(body_node))
    py_tmp, js_tmp = normalizeFunctionBody(body_node, body_node_idx)
    
    global total_block_id
    block_id2func_name[total_block_id - 1] = function_node.child_by_field_name('name').text.decode('utf-8')
    
    normalized_function_code += py_tmp + "\n"
    js_template_function_code += js_tmp + "\n"
    
    normalized_function_code += "\n"
    js_template_function_code += "}\n"
    
    return normalized_function_code, js_template_function_code


def normalizeFunctionBody(body_node, node_idx):
    normalized_function_code = ""
    js_template_function_code = ""
    is_function_body = False
    global total_block_id
    
    for child in body_node.children:
        child_node_idx = node_idx + '|' + str(body_node.children.index(child))
        if is_function_body:
            normalized_function_code += add_indent(4, normalizeStmt(child, child_node_idx)) + "\n"
        else:
            if child.type == "function_definition":
                py_function_code, js_function_code = normalizeFunction(child, child_node_idx)
                normalized_function_code += add_indent(4, py_function_code) + "\n"
                js_template_function_code += add_indent(4, js_function_code) + "\n"
            elif child.type == "decorated_definition":
                py_decorated_code, js_decorated_code, decorated_sign_py, decorated_sign_js = normalizeDecoratedFunction(child, child_node_idx)
                py_decorated_code += decorated_sign_py + "\n"
                js_decorated_code += decorated_sign_js + "\n"
                normalized_function_code += add_indent(4, py_decorated_code) + "\n"
                js_template_function_code += add_indent(4, js_decorated_code) + "\n"
            elif child.type == "comment" or child.type == "expression_statement" and child.children[0].type == "string":
                normalized_function_code += 4 * " " + source_code[child.start_byte:child.end_byte] + "\n"
            elif child.type in ["nonlocal_statement", "global_statement"]:
                normalized_function_code += 4 * " " + source_code[child.start_byte:child.end_byte] + "\n"
            else:
                is_function_body = True
                normalized_function_code += add_indent(4, f"### --- BLOCK BEGIN {total_block_id}") + "\n"
                js_template_function_code += add_indent(4, f"/// --- BLOCK BEGIN {total_block_id}") + "\n"
                
                normalized_function_code += add_indent(4, normalizeStmt(child, child_node_idx)) + "\n"
                
    if normalized_function_code.strip().find(f"### --- BLOCK BEGIN {total_block_id}") == len(normalized_function_code.strip()) - len(f"### --- BLOCK BEGIN {total_block_id}"):
        # print("Warning: Empty block detected")
        normalized_function_code += add_indent(4, "pass") + "\n"
    
    normalized_function_code += add_indent(4, f"### --- BLOCK END {total_block_id}") + "\n"
    js_template_function_code += "\n" + add_indent(4, f"/// --- BLOCK END {total_block_id}") + "\n"
    
    total_block_id += 1 
    return normalized_function_code, js_template_function_code


def get_node_from_idx_rec(node, node_idx):
    
    if node_idx == "":
        # print(node.text)
        return node
    
    child_idx = int(node_idx.split("|")[1])
    next_idx = node_idx[1:]
    if next_idx.find("|") >= 0:
        next_idx = next_idx[next_idx.find("|"):]
    else:
        next_idx = ""
    # print(node_idx, child_idx, node.type, len(node.children), next_idx)
    return get_node_from_idx_rec(node.children[child_idx], next_idx)


from collections import OrderedDict
def reconcile_args(call_node, call_node_idx, func_def_node, func_def_node_idx, args_node, params_node, args_node_idx, params_node_idx):
    
    args = args_node.children[1:-1]
    params = params_node.children[1:-1]
    arg_pos = 0
    params_pos = 0
    reconciled_args_str = ""
    positional_values = []
    keyword_values = OrderedDict()
    
    # print(call_node_idx)
    ### case 0 for empty
    if len(params) == 0:
        return normalizeStmt(args_node, args_node_idx)
    
    ### case 1 for *args and **kwargs removed
    # # case 1.1 for call
    # if params[0].type == "list_splat_pattern" or params[1].type == "dictionary_splat_pattern":
    #     return normalizeStmt(args_node, args_node_idx)
    # # case 1.2 for function def
    
    ### case 2 params start with self
    if params[0].type == "identifier" and params[0].text.decode("utf-8") == "self":
        positional_values.append("remove this")
        params_pos += 2
    
    while True:
        if arg_pos >= len(args):
            break
        if params_pos >= len(params):
            if PRINT_WARNING:
                print("Warning: args reconcile fail! not enough params!", call_node_idx, func_def_node_idx)
            return normalizeStmt(args_node, args_node_idx)
        
        if args[arg_pos].type == "keyword_argument": # case 3 for keyword args
            if params[params_pos].type == "identifier":
                if not args[arg_pos].children[0].text.decode("utf-8") == params[params_pos].text.decode("utf-8"):
                    if PRINT_WARNING:
                        print("Warning: args reconcile fail! keyword args not match with postion parameter!", call_node_idx, func_def_node_idx)
                    return normalizeStmt(args_node, args_node_idx)
                value_node = args[arg_pos].children[2]
                value_node_idx = args_node_idx + '|' + str(arg_pos + 1) + "|2"
                positional_values.append(normalizeStmt(value_node, value_node_idx))
                params_pos += 2
            elif params[params_pos].type == "typed_parameter":
                if not args[arg_pos].children[0].text.decode("utf-8") == params[params_pos].children[0].text.decode("utf-8"):
                    if PRINT_WARNING:
                        print("Warning: args reconcile fail! keyword args not match with postion parameter!", call_node_idx, func_def_node_idx)
                    return normalizeStmt(args_node, args_node_idx)
                value_node = args[arg_pos].children[2]
                value_node_idx = args_node_idx + '|' + str(arg_pos + 1) + "|2"
                positional_values.append(normalizeStmt(value_node, value_node_idx))
                params_pos += 2
            else:
                key = args[arg_pos].children[0].text.decode("utf-8")
                value_node = args[arg_pos].children[2]
                value_node_idx = args_node_idx + '|' + str(arg_pos + 1) + "|2"
                keyword_values[key] = normalizeStmt(value_node, value_node_idx)
        else: # case 4 for positional args
            value_node = args[arg_pos]
            value_node_idx = args_node_idx + '|' + str(arg_pos + 1)
            positional_values.append(normalizeStmt(value_node, value_node_idx))
            params_pos += 2
        arg_pos += 2
    
    while params_pos < len(params):
        # case 5 positional args with default value
        param_node = params[params_pos]
        if param_node.type == "default_parameter":
            if param_node.children[0].text.decode("utf-8") not in keyword_values:
                value_node = param_node.children[2]
                value_node_idx = params_node_idx + '|' + str(params_pos + 1) + "|2"
                positional_values.append(normalizeStmt(value_node, value_node_idx))
        elif param_node.type == "typed_default_parameter":
            if param_node.children[0].text.decode("utf-8") not in keyword_values:
                value_node = param_node.children[4]
                value_node_idx = params_node_idx + '|' + str(params_pos + 1) + "|4"
                positional_values.append(normalizeStmt(value_node, value_node_idx))
        elif param_node.type == "list_splat_pattern":
            pass
        elif param_node.type == "dictionary_splat_pattern":
            pass
        else:
            if PRINT_WARNING:
                print("Warning: args reconcile fail! not enough positional args!1", call_node_idx, func_def_node_idx)
            return normalizeStmt(args_node, args_node_idx)
        params_pos += 2
    
    reconciled_args = []
    params_pos = 0
    positional_values_pos = 0
    while params_pos < len(params):
        param = params[params_pos]
        if param.text.decode("utf-8") == ",":
            pass
        elif param.type == "identifier" and param.text.decode("utf-8") in keyword_values:
            reconciled_args.append(keyword_values[param.text.decode("utf-8")])
        elif param.type == "typed_parameter" and param.children[0].text.decode("utf-8") in keyword_values:
            reconciled_args.append(keyword_values[param.children[0].text.decode("utf-8")])
        elif (param.type == "default_parameter" or param.type == "typed_default_parameter") and param.child_by_field_name("name").text.decode("utf-8") in keyword_values:
            reconciled_args.append(keyword_values[param.child_by_field_name("name").text.decode("utf-8")])
        elif param.type == "list_splat_pattern":
            reconciled_args.extend(positional_values[positional_values_pos:])
        elif param.type == "dictionary_splat_pattern":
            reconciled_args.extend([v for k, v in keyword_values.items()])
        else:
            if positional_values_pos >= len(positional_values):
                if PRINT_WARNING:
                    print("Warning: args reconcile fail! not enough positional args!2", call_node_idx, func_def_node_idx)
                return normalizeStmt(args_node, args_node_idx)
            
            if positional_values[positional_values_pos] != "remove this": ### handle for case 2.1
                reconciled_args.append(positional_values[positional_values_pos])
            positional_values_pos += 1
        params_pos += 1
    
    reconciled_args_str = ", ".join(reconciled_args)
    reconciled_args_str = "(" + reconciled_args_str + ")"
    return reconciled_args_str


def reconcile_call_with_function_def(call_node_idx, function_node_idxs):
    
    call_node = get_node_from_idx_rec(root_node, call_node_idx)
    assert call_node.type == "call"
    
    args_node = call_node.child_by_field_name("arguments")
    args_node_idx = call_node_idx + '|' + str(call_node.children.index(call_node.child_by_field_name("arguments")))
    
    reconciled_args = ""
    
    for function_node_idx in function_node_idxs:
        function_node = get_node_from_idx_rec(root_node, function_node_idx)
        assert function_node.type == "function_definition"
        
        params_node = function_node.child_by_field_name("parameters")
        params_node_idx = function_node_idx + '|' + str(function_node.children.index(function_node.child_by_field_name("parameters")))
        
        tmp_args = reconcile_args(call_node, call_node_idx, function_node, function_node_idx, args_node, params_node, args_node_idx, params_node_idx)
        
        if reconciled_args == "":
            reconciled_args = tmp_args
        elif reconciled_args != tmp_args:
            if PRINT_WARNING:
                print("Warning: args reconcile fail! call to different funtion with different params!", call_node_idx, function_node_idx)
            return normalizeStmt(args_node, args_node_idx)

    
    return reconciled_args
    
  
def normalizeStmt(stmt_node, node_idx): ### This function can be extended to handle more stmt types
    if stmt_node.type == 'identifier' and stmt_node.text.decode('utf-8') == 'self':
        return "class_var"
    elif stmt_node.type == 'argument_list': ### Since all the keyword argument is removed, "func_call(**kw)" and "def func(**kw):..." is not supported.
        normalized_args = ""
        for arg in stmt_node.children[1:-1]:
            if arg.text.decode('utf-8') == ",":
                normalized_args += ", "
            elif arg.type == "dictionary_splat":
                if normalized_args[-2:] == ", ":
                    normalized_args = normalized_args[:-2]
                normalized_args = "(" + normalized_args + ")"
                return normalized_args
            else:
                normalized_args += normalizeStmt(arg, node_idx + '|' + str(stmt_node.children.index(arg)))
    elif stmt_node.type == 'for_statement':
        if stmt_node.children[1].type == 'identifier' and stmt_node.children[3].type == 'call':
            call_sub_node = stmt_node.children[3]
            if (call_sub_node.children[0].type == 'identifier'
                and call_sub_node.children[0].text.decode('utf-8') == 'range'
                and call_sub_node.children[1].children[1].type == 'call'
                and len(call_sub_node.children[1].children[1].children[1].children) == 2):

                tmp_stmt = "_tmp = " + normalizeStmt(call_sub_node.children[1].children[1], node_idx + '|3|1|1')
                for_stmt = f"for {stmt_node.children[1].text.decode('utf-8')} in range(_tmp):\n"
                for_stmt += normalizeStmt(stmt_node.children[5], node_idx + '|5')
                return tmp_stmt + "\n" + for_stmt

        else:
            pass

    elif stmt_node.type == 'assignment':
        if stmt_node.children[2].type == 'type': ### handle for "x: int = 1" => "x = 1"
            if len(stmt_node.children) == 5:
                child_0 = normalizeStmt(stmt_node.children[0], node_idx + "|0")
                child_4 = normalizeStmt(stmt_node.children[4], node_idx + "|4")
                return f"{child_0} = {child_4}"
            else:
                if PRINT_WARNING:
                    print("Warning: Unsupported typed assignment:", stmt_node.text.decode('utf-8'))
                pass
        else:
            pass
        
    elif stmt_node.type == 'attribute':
        if (stmt_node.children[0].type == 'attribute' and ### handle for 'node.__class__.__name__' => 'node._class_name.split(';')[0]'
            stmt_node.children[0].children[2].text.decode('utf-8') == '__class__' and
            stmt_node.children[2].text.decode('utf-8') == '__name__'):
            return normalizeStmt(stmt_node.children[0].children[0], node_idx + "|0|0") + "._class_name.split(';')[0]"
        elif stmt_node.children[2].text.decode('utf-8') in properties: ### handle for "@property" "node.grandparent" => "node.grandparent()"
            return normalizeStmt(stmt_node.children[0], node_idx + "|0") + "." + stmt_node.children[2].text.decode('utf-8') + "()"
        else:
            pass
    elif stmt_node.type == 'block':
        return '\n'.join([add_indent(4, normalizeStmt(child, node_idx + '|' + str(i))) for i, child in enumerate(stmt_node.children)])
    elif stmt_node.type == 'string_content':
        return source_code[stmt_node.start_byte:stmt_node.end_byte]
    elif stmt_node.type == 'comparison_operator': ### Instrument for operator overloading. Only support '==' and 'in' now
        if stmt_node.children[1].text.decode("utf-8") in ['==', '!=']:
            if node_idx in op_record["eq"]:
                if op_record["eq"][node_idx]["normal"] and not op_record["eq"][node_idx]["overload"]: # only normal op, thus do nothing
                    pass
                elif not op_record["eq"][node_idx]["normal"] and op_record["eq"][node_idx]["overload"]: # only overload
                    if stmt_node.children[1].text.decode("utf-8") == '==':
                        return normalizeStmt(stmt_node.children[0], node_idx + "|0") + ".__eq__(" + normalizeStmt(stmt_node.children[2], node_idx + "|2") + ")"
                    else:
                        return "not " + normalizeStmt(stmt_node.children[0], node_idx + "|0") + ".__eq__(" + normalizeStmt(stmt_node.children[2], node_idx + "|2") + ")"
                else: # both
                    child_0 = normalizeStmt(stmt_node.children[0], node_idx + '|0')
                    child_2 = normalizeStmt(stmt_node.children[2], node_idx + '|2')
                    if stmt_node.children[1].text.decode("utf-8") == '==':
                        first_part = f"(hasattr({child_0}, '__eq__') and {child_0}.__eq__({child_2}))"
                        second_part = f"(not hasattr({child_0}, '__eq__') and {child_0} == {child_2})"
                    else:
                        first_part = f"(hasattr({child_0}, '__eq__') and not {child_0}.__eq__({child_2}))"
                        second_part = f"(not hasattr({child_0}, '__eq__') and {child_0} != {child_2})"
                    return f"({first_part} or {second_part})"
            else:
                pass
        elif stmt_node.children[1].text.decode("utf-8") == 'in':
            if node_idx in op_record["contain"]:
                if op_record["contain"][node_idx]["normal"] and not op_record["contain"][node_idx]["overload"]:
                    pass # only normal op, thus do nothing
                elif not op_record["contain"][node_idx]["normal"] and op_record["contain"][node_idx]["overload"]: # only overload
                    return normalizeStmt(stmt_node.children[2], node_idx + "|2") + ".__contains__(" + normalizeStmt(stmt_node.children[0], node_idx + "|0") + ")"
                else: # both
                    child_0 = normalizeStmt(stmt_node.children[0], node_idx + '|0')
                    child_2 = normalizeStmt(stmt_node.children[2], node_idx + '|2')
                    first_part = f"(hasattr({child_2}, '__contains__') and {child_2}.__contains__({child_0}))"
                    second_part = f"(not hasattr({child_2}, '__contains__') and {child_0} in {child_2})"
                    return f"({first_part} or {second_part})"
            else:
                pass
        else:
            pass
    elif stmt_node.type == 'call':
        if stmt_node.child_by_field_name('function').type == 'identifier' and stmt_node.child_by_field_name('function').text.decode('utf-8') == 'type':
            return "user_get_type" + normalizeStmt(stmt_node.children[1], node_idx + "|1")
        elif stmt_node.child_by_field_name('function').type == 'identifier' and stmt_node.child_by_field_name('function').text.decode('utf-8') == 'isinstance':
            assert len(stmt_node.children[1].children) == 5 ### only support isinstance(x, y) now
            type_name = stmt_node.children[1].children[3].text.decode('utf-8')
            if type_name not in built_in_types:            
                return "user_check_type" + normalizeStmt(stmt_node.children[1], node_idx + "|1")
        elif (stmt_node.child_by_field_name('function').type == 'attribute' and 
              stmt_node.child_by_field_name('function').children[2].text.decode('utf-8') == '__init__' and
              stmt_node.child_by_field_name('function').children[0].type == 'call' and
              stmt_node.child_by_field_name('function').children[0].child_by_field_name('function').text.decode("utf-8") == 'super'):
            # print("super")
            return ""
        elif node_idx in call_match:
            reconciled_args = reconcile_call_with_function_def(node_idx, call_match[node_idx]) 
            return normalizeStmt(stmt_node.children[0], node_idx + "|0") + reconciled_args
        else:
            pass
    else:
        pass
    
    
    if len(stmt_node.children) == 0:
        return source_code[stmt_node.start_byte:stmt_node.end_byte]
    
    tar = normalizeStmt(stmt_node.children[0], node_idx + "|0")
    for child in stmt_node.children[1:]:
        child_node_idx = node_idx + '|' + str(stmt_node.children.index(child))
        if child.start_point[0] > stmt_node.children[stmt_node.children.index(child) - 1].end_point[0]:
            con = "\n"
        else:
            dis = child.start_point[1] - stmt_node.children[stmt_node.children.index(child) - 1].end_point[1]
            con = dis * " "
        tar += con + normalizeStmt(child, child_node_idx)
    return tar


def normalizeRootNode(root_node):
    normalized_code = skel_head_py
    js_template_code = skel_head_js
    is_global = False
    future_import = ""
    node_idx = ""
    for child in root_node.children:
        if child.type == "future_import_statement":
            future_import = future_import + source_code[child.start_byte:child.end_byte] + "\n"
            continue
        
        if is_global:
            normalized_code += source_code[child.start_byte:child.end_byte] + "\n\n"
        else:
            child_node_idx = node_idx + '|' + str(root_node.children.index(child))
            if child.type == "class_definition":
                py_class_code, js_class_code = normalizeClass(child, child_node_idx)
                normalized_code += py_class_code + "\n"
                js_template_code += js_class_code + "\n"
            elif child.type == "function_definition":
                py_function_code, js_function_code = normalizeFunction(child, child_node_idx)
                normalized_code += py_function_code + "\n"
                js_template_code += js_function_code + "\n"
            elif child.type == "decorated_definition":
                py_decorated_code, js_decorated_code, decorated_sign_py, decorated_sign_js = normalizeDecoratedFunction(child, child_node_idx)
                
                py_decorated_code += decorated_sign_py + "\n"
                js_decorated_code += decorated_sign_js + "\n"
                
                normalized_code += py_decorated_code + "\n"
                js_template_code += js_decorated_code + "\n"
            elif child.type == "comment" and "Global Begin" in source_code[child.start_byte:child.end_byte]:
                is_global = True
                normalized_code += source_code[child.start_byte:child.end_byte] + "\n\n"
                normalized_code += "### --- BLOCK BEGIN 0\n"
                js_template_code += "/// --- BLOCK BEGIN 0\n"
            else:
                normalized_code += source_code[child.start_byte:child.end_byte] + "\n\n"
    
    normalized_code = future_import + normalized_code
    
    normalized_code += "### --- BLOCK END 0\n"
    js_template_code += "/// --- BLOCK END 0\n"
    
    return normalized_code, js_template_code

import os
if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    folder = sys.argv[1]
    source_code_file = folder + "/source.py"
    dynamic_analysis_result_file = folder + "/dynamic_analysis_result.json"
    normalized_py_file = folder + "/source_normalized.py"
    js_template_file = folder + "/stage1_output/skeleton_syn.js"
    
    block_id_to_func_name_file = folder + "/stage1_output/block_id_to_func_name.json"
    class_name2block_id_file = folder + "/stage1_output/class_name_to_block_id.json"

    source_code = read_file(source_code_file)
    dynamic_analysis_result = json.loads(read_file(dynamic_analysis_result_file))
    call_match = dynamic_analysis_result["call_match"]
    op_record = dynamic_analysis_result["op_record"]
    properties = dynamic_analysis_result["properties"]
    tree = parser.parse(bytes(source_code, "utf8"))
    root_node = tree.root_node

    params_args_reconcile_record = {} # map call node args to function node params

    normalized_py_code, js_template_code = normalizeRootNode(root_node)
    tracer_skip_head_file = folder + "/tracer_skip_head.js"
    if os.path.exists(tracer_skip_head_file):
        tracer_skip_head_code = read_file(tracer_skip_head_file)
        js_template_code = tracer_skip_head_code + "\n" + js_template_code
    
    write_file(normalized_py_file, normalized_py_code)
    write_file(js_template_file, js_template_code)
    write_file(block_id_to_func_name_file, json.dumps(block_id2func_name, indent=4))
    write_file(class_name2block_id_file, json.dumps(class_name2block_id, indent=4))

    os.remove(dynamic_analysis_result_file)
    # js_template_co    de = fromPy2Js(normalized_code_file, js_template_code_file)
    # print(json.dumps(normalized_py_code, indent=2))
