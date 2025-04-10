import tree_sitter_python as tspython
from tree_sitter import Language, Parser
import json
import sys
SHIM_RANDOM_CALL = True
SHIM_PRINT_CALL = False

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
    "Decimal",
    "timedelta",
    "frozenset",
    "bool",
    "bytes",
    "bytearray"
    "memoryview",
    "enumerate",
    "zip",
    "NotImplemented",
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
    "partial",
    "wraps",
]
python_built_in_libs = [
    "re",
    "os",
    "sys",
    "math",
    "random",
    "datetime",
    "json",
    "time",
    "tool_functions",
    "functools",
    "inspect",
    "struct",
    "binascii",
    "np",
    "itertools",
    "six",
    "xml",
    "base64",
    "mmap",
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
instrumented_functions = [
    "user_get_type",
    "user_check_type",
]

PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

obs_vars = {}
def read_file(file):
    with open(file, 'r') as f:
        return f.read()

def write_file(file, content):
    with open(file, 'w') as f:
        f.write(content)

def get_observed_vars(source_code, target_func_node):
    
    assert target_func_node.type == 'function_definition' or target_func_node.type == 'module'
    
    analyzer = VariableAnalyzer(source_code)
    analyzer.analyze_function(target_func_node)

    # Variables referred from outer scopes are used but not assigned in the current scope
    referred_vars = set()
    for used_var in analyzer.used_vars:
        is_referred = True
        for local_var in analyzer.local_vars:
            ### If use is after assignment, then it is not a referred variable
            if used_var['var_name'] == local_var['var_name'] and used_var['start_byte'] > local_var['start_byte']:
                is_referred = False
                break
        if is_referred:
            referred_vars.add(used_var['var_name'])
            
    referred_vars = referred_vars - set(python_built_in_types) - set(python_built_in_exceptions) - set(python_built_in_libs) - set(python_built_in_funcs) - set(instrumented_functions)

    referred_vars = referred_vars.union(analyzer.nonlocal_vars)
    # if analyzer.blockIdx is None:
    #     return None, -1
    referred_vars = sorted(referred_vars) ### Use sort to make the order consistent
    obs_vars[analyzer.blockIdx] = [i for i in referred_vars]
    # print("Local variables:", analyzer.local_vars)
    # print("Variables referred from outer scopes:", referred_vars)
    return analyzer.local_vars, referred_vars, analyzer.blockIdx

# Analyze variables in the scope of 'inner_func'
class VariableAnalyzer:
    def __init__(self, code):
        self.code = code
        self.local_vars = []
        self.used_vars = []
        self.current_scope_vars = []
        self.blockIdx = None
        self.nonlocal_vars = []
    
    def analyze_function(self, node):
        # Process statements in the function body
        self.current_scope_vars = []
        if node.type == 'function_definition':
            start = False
            if node.children[-2].type == 'comment' and "BLOCK BEGIN" in node.children[-2].text.decode('utf-8'):
                self.blockIdx = node.children[-2].text.decode('utf-8').split(" ")[-1]
                start = True
                
            for child in node.child_by_field_name('body').children:
                if child.type in ["nonlocal_statement", "global_statement"]:
                    for var_name in child.children[1:]:
                        if var_name.type == 'identifier':
                            self.nonlocal_vars.append(var_name.text.decode('utf-8'))

                if not start and child.type == 'comment' and "BLOCK BEGIN" in child.text.decode('utf-8'):
                    self.blockIdx = child.text.decode('utf-8').split(" ")[-1]
                    start = True
                    
                if start:
                    self._analyze_node(child)
        else:
            self.blockIdx = 0
            self._analyze_block(node)
        self.local_vars = self.current_scope_vars
    
    def _analyze_block(self, node):
        for child in node.children:
            self._analyze_node(child)
    
    def _analyze_node(self, node):
        if node.type == 'expression_statement':
            self._analyze_node(node.child(0))
        elif node.type == 'assignment':
            # Left-hand side is assigned variables
            target = node.child_by_field_name('left')
            self._collect_assigned_vars(target)
            
            # type
            type = node.child_by_field_name('type')
            if type:
                self._analyze_expression(type)
            
            # Right-hand side may use variables
            value = node.child_by_field_name('right')
            if value:
                self._analyze_expression(value, node.start_byte)
        elif node.type == 'return_statement':
            if len(node.children) > 1:
                for child in node.children[1:]:
                    self._analyze_expression(child)
        elif node.type == 'for_statement':
            target = node.child_by_field_name('left')
            self._collect_assigned_vars(target)
            iterable = node.child_by_field_name('right')
            self._analyze_expression(iterable)
            body = node.child_by_field_name('body')
            self._analyze_block(body)
        elif node.type == 'function_definition':
            target = node.child_by_field_name('name')
            self.current_scope_vars.append({'var_name': self.code[target.start_byte:target.end_byte], 'start_byte': target.start_byte})
        elif node.type == 'call':
            # Analyze function calls
            self._analyze_expression(node)
        elif node.type == 'if_statement':
            condition = node.child_by_field_name('condition')
            if condition:
                self._analyze_expression(condition)
            for child in node.children[3:]:
                self._analyze_node(child)
        elif node.type == 'elif_clause':
            condition = node.child_by_field_name('condition')
            if condition:
                self._analyze_expression(condition)
            body = node.child_by_field_name('consequence')
            self._analyze_block(body)
        elif node.type == 'while_statement':
            condition = node.child_by_field_name('condition')
            if condition:
                self._analyze_expression(condition)
            body = node.child_by_field_name('body')
            self._analyze_block(body)
        elif node.type == "as_pattern":
            assert node.children[2].children[0].type == 'identifier'
            self._collect_assigned_vars(node.children[2].children[0])
        elif node.type == 'lambda':
            pass ### Skip for simplicity
        elif node.type in ['list_comprehension', 'dictionary_comprehension', 'set_comprehension', 'generator_expression']: 
            # self._analyze_expression(node.child_by_field_name('body'), node.start_byte)
            # pass
            for child in node.children[2:]:
                if child.type == 'for_in_clause':
                    target = child.child_by_field_name('left')
                    self._collect_assigned_vars(target)
                    iterable = child.child_by_field_name('right')
                    self._analyze_expression(iterable)
                elif child.type == 'if_clause': ### Skip for simplicity
                    pass
        else:
            for child in node.children:
                self._analyze_node(child)
    
    def _analyze_expression(self, node, start_byte=None):
        
        if node.type == 'identifier':
            name = self.code[node.start_byte:node.end_byte]
            self.used_vars.append({'var_name': name, 'start_byte': node.start_byte if start_byte == None else start_byte})
        elif node.type == 'assignment':
            # Left-hand side is assigned variables
            target = node.child_by_field_name('left')
            self._collect_assigned_vars(target)
            
            # type
            type = node.child_by_field_name('type')
            if type:
                self._analyze_expression(type, start_byte)
            
            # Right-hand side may use variables
            value = node.child_by_field_name('right')
            if value:
                self._analyze_expression(value, start_byte)
        elif node.type == 'attribute':
            # e.g., self.member_func
            value_node = node.child_by_field_name('object')
            if self.code[value_node.start_byte:value_node.end_byte] == 'class_var':
                name = self.code[node.start_byte:node.end_byte]
                self.used_vars.append({'var_name': name, 'start_byte': node.start_byte})
                return
            
            self._analyze_expression(value_node, start_byte)
        elif node.type == 'call':
            # Function call
            function_node = node.child_by_field_name('function')
            self._analyze_expression(function_node, start_byte)
            arguments_node = node.child_by_field_name('arguments')
            if arguments_node:
                for arg_node in arguments_node.children:
                    self._analyze_expression(arg_node, start_byte)
        elif node.type == 'lambda':
            pass ### Skip for simplicity
        elif node.type in ('binary_operator', 'unary_operator', 'augmented_assignment'):
            for child in node.children:
                self._analyze_expression(child, start_byte)
        elif node.type in ('subscript'):
            value_node = node.child_by_field_name('value')
            slice_node = node.child_by_field_name('subscript')
            if self.code[value_node.start_byte:value_node.end_byte] == 'class_var' and slice_node.type == 'string':
                name = self.code[node.start_byte:node.end_byte]
                self.used_vars.append({'var_name': name.replace("'", '"'), 'start_byte': node.start_byte})
                return
            self._analyze_expression(value_node, start_byte)

            if slice_node:
                self._analyze_expression(slice_node, start_byte)
        elif node.type == 'for_in_clause':
            target = node.child_by_field_name('left')
            self._collect_assigned_vars(target)
            iterable = node.child_by_field_name('right')
            self._analyze_expression(iterable, start_byte)
        elif node.type in ('list', 'tuple', 'dictionary', 'set'):
            for child in node.children:
                self._analyze_expression(child, start_byte)
        elif node.type == 'keyword_argument':
            value_node = node.child_by_field_name('value')
            self._analyze_expression(value_node, start_byte)
        elif node.type in ['list_comprehension', 'dictionary_comprehension', 'set_comprehension', 'generator_expression']: 
            # self._analyze_expression(node.child_by_field_name('body'), node.start_byte)
            # pass
            for child in node.children[2:]:
                if child.type == 'for_in_clause':
                    target = child.child_by_field_name('left')
                    self._collect_assigned_vars(target)
                    iterable = child.child_by_field_name('right')
                    self._analyze_expression(iterable, start_byte)
                elif child.type == 'if_clause': ### Skip for simplicity
                    pass
        else:
            for child in node.children:
                self._analyze_expression(child, start_byte)
    
    def _collect_assigned_vars(self, node):
        if node.type == 'identifier':
            name = self.code[node.start_byte:node.end_byte]
            self.current_scope_vars.append({'var_name': name, 'start_byte': node.start_byte})
        elif node.type in ('tuple', 'list'):
            for child in node.children:
                self._collect_assigned_vars(child)
        elif node.type == 'attribute':
            # e.g., self.x = 1
            value_node = node.child_by_field_name('object')
            if self.code[value_node.start_byte:value_node.end_byte] == 'class_var': ### Should be put in used_vars
                name = self.code[node.start_byte:node.end_byte]
                self.used_vars.append({'var_name': name, 'start_byte': node.start_byte})
                return
            
            self._analyze_expression(value_node, node.start_byte)
        elif node.type == 'subscript':
            # e.g., a[i] = 1
            value_node = node.child_by_field_name('value')
            slice_node = node.child_by_field_name('subscript')
            if self.code[value_node.start_byte:value_node.end_byte] == 'class_var' and slice_node.type == 'string': ### Should be put in used_vars
                name = self.code[node.start_byte:node.end_byte]
                self.used_vars.append({'var_name': name.replace("'", '"'), 'start_byte': node.start_byte})
                return
            self._analyze_expression(value_node)
            
            if slice_node:
                self._analyze_expression(slice_node)
        else:
            for child in node.children:
                self._collect_assigned_vars(child)

def add_indent (indent, code):
    return "\n".join([indent * " " + line for line in code.split("\n")])

def instrument_code(source_code, root_node):
    
    assert root_node.type == 'module'
    local_vars, refered_vars, blockId = get_observed_vars(source_code, root_node)
    vars_str = "{"
    for var in refered_vars:
        if var.startswith("class_var."):
            assert len(var.split(".")) == 2
            method_name = var.split(".")[1]
            vars_str += f"'{var}': {var} if hasattr(class_var, '{method_name}') else 'undefined', "
        else:
            vars_str += f"'{var}': {var}, "
    vars_str += "}"
    
    inst_code = ""
    start = False
    is_code = False
    future_import = ""
    for child in root_node.children:
        if child.type == "future_import_statement":
            future_import = future_import + source_code[child.start_byte:child.end_byte] + "\n"
            continue
        
        if child.type == 'comment' and "SKEL HEAD END" in child.text.decode('utf-8'):
            is_code = True
        
        if is_code:
            if child.type == 'comment' and "BLOCK BEGIN" in child.text.decode('utf-8'):
                inst_code += f"_instrument_begin({{'args':{{}}, 'func_name':'global'}}, {vars_str}, {blockId})\n"
                inst_code += f"try:\n"
                start = True
            
            if start:
                inst_code += add_indent(4, rewrite_node(source_code, child, vars_str, blockId)) + "\n"
            else:
                inst_code += rewrite_node(source_code, child, vars_str, blockId) + "\n"
        else:
            inst_code += source_code[child.start_byte:child.end_byte] + "\n"
    
    inst_code += add_indent(4, f"_instrument_return(_ret=None, _vars={vars_str}, _blockId={blockId})") + "\n" # no "return" in global scope
    inst_code += f"except Exception as e:\n"
    inst_code += add_indent(4, f"_instrument_throw(_err=e, _vars={vars_str}, _blockId={blockId})") + "\n"
    inst_code += add_indent(4, f"raise e\n") + "\n"

    checker_code = read_file(CHECKER_FILE)
    inst_code = checker_code + inst_code
    trace_folder = folder + '/traces_all'
    inst_code = f"TRACE_FOLDER = '{trace_folder}'\n" + inst_code
    
    
    inst_code = future_import + inst_code
    
    return inst_code

def instrument_func(source_code, target_func_node):
    assert target_func_node.type == 'function_definition'
    
    local_vars, refered_vars, blockId = get_observed_vars(source_code, target_func_node)
    
    if blockId == None: # not find the block id
        # return source_code[target_func_node.start_byte:target_func_node.end_byte]
        inst_func = ""
        for child in target_func_node.children[:-1]:
            dis = child.start_point[1] - target_func_node.children[target_func_node.children.index(child) - 1].end_point[1]
            con = dis * " "
            inst_func += con + source_code[child.start_byte:child.end_byte]
            
        assert target_func_node.children[-1].type == 'block'
        body_node = target_func_node.children[-1]
        inst_func += "\n"
        for child in body_node.children:
            if child.type == "function_definition":
                inst_func += add_indent(4, instrument_func(source_code, child)) + "\n"
            else:
                inst_func += add_indent(4, source_code[child.start_byte:child.end_byte]) + "\n"
        return inst_func
    
    vars_str = "{"
    for var in refered_vars:
        if var.startswith("class_var."):
            assert len(var.split(".")) == 2
            method_name = var.split(".")[1]
            vars_str += f"'{var}': {var} if hasattr(class_var, '{method_name}') else 'undefined', "
        else:
            vars_str += f"'{var}': {var}, "
    vars_str += "}"
    
    call_info_str = "{'args': {"
    count = 0
    for arg in target_func_node.child_by_field_name('parameters').children:
        if arg.type == 'identifier':
            call_info_str += f"'arg_{count}': {source_code[arg.start_byte:arg.end_byte]}, "
            count += 1
    call_info_str += "}, "
    call_info_str += f"'func_name': '{target_func_node.child_by_field_name('name').text.decode('utf-8')}'"
    call_info_str += "}"
    
    inst_func = rewrite_node(source_code, target_func_node.children[0], "", blockId)
    
    for child in target_func_node.children[1:-1]:
        # if child.start_point[0] > target_func_node.children[target_func_node.children.index(child) - 1].end_point[0]:
        #     con = "\n"
        # else:
        dis = child.start_point[1] - target_func_node.children[target_func_node.children.index(child) - 1].end_point[1]
        con = dis * " "
        inst_func += con +  rewrite_node(source_code, child, vars_str, blockId)
    
    assert target_func_node.children[-1].type == 'block'
    body_node = target_func_node.children[-1]
    
    inst_func += "\n"
    
    # for var in variables[1]:
    #     if var.startswith("class_var["):
    #         inst_func += add_indent(4, f"{var} = None") + "\n"
                
    start = False
    if target_func_node.children[-2].type == 'comment' and target_func_node.children[-2].text.decode('utf-8').find("BLOCK BEGIN") >= 0:
        inst_func += add_indent(4, f"_instrument_begin({call_info_str}, {vars_str}, {blockId})") + "\n"
        inst_func += add_indent(4, f"try:") + "\n"
        start = True

    
    for child in body_node.children:
        if not start and child.type == 'comment' and child.text.decode('utf-8').find("BLOCK BEGIN") >= 0:
            inst_func += add_indent(4, f"_instrument_begin({call_info_str}, {vars_str}, {blockId})") + "\n"
            inst_func += add_indent(4, f"try:") + "\n"
            start = True
        
        if start:
            inst_func += add_indent(4 + 4, rewrite_node(source_code, child, vars_str, blockId)) + "\n"
        else:
            inst_func += add_indent(4, rewrite_node(source_code, child, vars_str, blockId)) + "\n"
    
    # if start:
    inst_func += 4 * " " + 4 * " " + f"return _instrument_return(_ret=None, _vars={vars_str}, _blockId={blockId})\n"
    inst_func += 4 * " " + f"except Exception as e:\n"
    inst_func += 4 * " " + 4 * " " + f"_instrument_throw(_err=e, _vars={vars_str}, _blockId={blockId})\n"
    inst_func += 4 * " " + 4 * " " + f"raise e\n"

    inst_func = inst_func + "\n"
    
    return inst_func

def rewrite_node(code, node, vars_str, blockId):
    # if node.type == 'call':
    #     func_node = node.child_by_field_name('function')
    #     arg_nodes = node.child_by_field_name('arguments')

    #     # Process the function name
    #     func_code = rewrite_node(code, func_node, vars_str)

    #     # Process the arguments
    #     args = []
    #     if arg_nodes:
    #         for arg in arg_nodes.named_children:
    #             arg_code = rewrite_node(code, arg, vars_str)
    #             args.append(arg_code)

    #     # Build the _call(vars={}, args=[...]) string
    #     args_str = '[' + ', '.join(args) + ']'
    #     call_str = f"_instrument_call(_f={func_node.text.decode('utf-8')}, _args={args_str}, _vars={vars_str})"

    #     # Build the new function call
    #     new_call = f"{func_code}(*{call_str})"
    #     return new_call
    
    if node.type == 'return_statement':
        if len(node.children) == 1:
            new_ret = f"return _instrument_return(_ret=None, _vars={vars_str}, _blockId={blockId})"
        else:
            exp_node = node.children[1]
            new_ret = f"return _instrument_return(_ret=({rewrite_node(code, exp_node, vars_str, blockId)}), _vars={vars_str}, _blockId={blockId})"
        return new_ret
    
    else:
        # Reconstruct code for other node types
        if len(node.children) == 0:
            return code[node.start_byte:node.end_byte]
        else:
            if node.type == 'block':
                return '\n'.join([add_indent(4, rewrite_node(code, child, vars_str, blockId)) for child in node.children])
            elif node.type == 'function_definition':
                return instrument_func(code, node)
            elif node.type == 'string_content':
                return code[node.start_byte:node.end_byte]
            elif (node.type == 'call'
                  and node.child_by_field_name('function').type == 'identifier'
                  and node.child_by_field_name('function').text.decode('utf-8') == 'print'
                  and SHIM_PRINT_CALL):
                return f"_instrument_print_shim({' '.join([rewrite_node(code, arg, vars_str, blockId) for arg in node.child_by_field_name('arguments').children[1:-1]])})"
            elif (node.type == 'call'
                    and node.child_by_field_name('function').type == 'identifier'
                    and node.child_by_field_name('function').text.decode('utf-8') == 'user_randint'
                    and SHIM_RANDOM_CALL):
                return f"_instrument_random_shim({' '.join([rewrite_node(code, arg, vars_str, blockId) for arg in node.child_by_field_name('arguments').children[1:-1]])})"
            else:
                tar = rewrite_node(code, node.children[0], vars_str, blockId)
                for child in node.children[1:]:
                    if child.start_point[0] > node.children[node.children.index(child) - 1].end_point[0]:
                        con = "\n"
                    else:
                        dis = child.start_point[1] - node.children[node.children.index(child) - 1].end_point[1]
                        con = dis * " "
                    tar += con + rewrite_node(code, child, vars_str, blockId)
                return tar


if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    folder = sys.argv[1]
    FAST_MODE = True if sys.argv[2] == 'fast' else False

    if FAST_MODE:
        CHECKER_FILE = './scripts/instrumentation/fast_mode_checker_code.py'
    else:
        CHECKER_FILE = './scripts/instrumentation/optimized_mode_checker_code.py'
    
    source_code = read_file(folder + '/source_normalized.py')
    tree = parser.parse(bytes(source_code, "utf8"))
    root_node = tree.root_node
    inst_code = instrument_code(source_code, root_node)
    
    write_file(folder + '/source_normalized_inst.py', inst_code)
    json.dump(obs_vars, open(folder + '/stage1_output/obs_vars.json', 'w'), indent=4)
