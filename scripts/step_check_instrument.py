import tree_sitter_javascript as tsjs
from tree_sitter import Language, Parser
import json
import sys
SHIM_RANDOM_CALL = True
SHIM_PRINT_CALL = False

JS_LANGUAGE = Language(tsjs.language())
parser = Parser(JS_LANGUAGE)
obs_vars = {}

def read_file(file):
    with open(file, 'r') as f:
        return f.read()

def write_file(file, content):
    with open(file, 'w') as f:
        f.write(content)

def get_observed_vars(source_code, target_func_node):
    
    assert target_func_node.type in ['function_declaration', 'program', 'generator_function_declaration']

    if target_func_node.type == 'program':
        return None, obs_vars['0'], 0
    
    for child in target_func_node.child_by_field_name('body').children:
        if child.type == "comment" and "BLOCK BEGIN" in child.text.decode('utf-8'):
            blockId = child.text.decode('utf-8').split(" ")[-1]
            return None, obs_vars[blockId], blockId
    
    return None, -1, None

def add_indent (indent, code):
    return "\n".join([indent * " " + line for line in code.split("\n")])

def instrument_code(source_code, root_node):
    assert root_node.type == 'program'
    local_vars, refered_vars, blockId = get_observed_vars(source_code, root_node)
    vars_str = "{"
    for var in refered_vars:
        if var.startswith("class_var."):
            assert len(var.split(".")) == 2
            method_name = var.split(".")[1]
            vars_str += f"'{var}':  (('{method_name}' in class_var) ? {var} : 'undefined'), "
        else:
            vars_str += f"'{var}': {var}, "
    vars_str += "}"
    
    inst_code = ""
    start = False
    is_code = False
    for child in root_node.children:
        if child.type == 'comment' and "SKEL HEAD END" in child.text.decode('utf-8'):
            is_code = True
        
        if is_code:
            if not start and child.type == 'comment' and "BLOCK BEGIN" in child.text.decode('utf-8'):
                inst_code += f"_instrument_begin({vars_str}, {blockId})\n"
                inst_code += "try {\n"
                start = True
            
            if start:
                inst_code += add_indent(4, rewrite_node(source_code, child, vars_str, blockId, True)) + "\n"
            else:
                inst_code += rewrite_node(source_code, child, vars_str, blockId, False) + "\n"
        else:
            inst_code += source_code[child.start_byte:child.end_byte] + "\n"
    
    inst_code += add_indent(4, f"_instrument_return(_ret=null, _vars={vars_str}, blockId={blockId});") + "\n"
    inst_code += "}\n"
    inst_code += "catch (e) {\n"
    inst_code += add_indent(4, f"_instrument_throw(_err=e, _vars={vars_str}, blockId={blockId});") + "\n"
    inst_code += add_indent(4, f"throw e;\n") + "\n"
    inst_code += "}\n"

    checker_code = read_file(CHECKER_FILE)
    inst_code = checker_code + inst_code
    return inst_code

def instrument_func(source_code, target_func_node):
    assert target_func_node.type in ['function_declaration', 'generator_function_declaration']
    
    local_vars, refered_vars, blockId = get_observed_vars(source_code, target_func_node)
    if blockId == None: # not find the block id
        # return source_code[target_func_node.start_byte:target_func_node.end_byte]
        inst_func = ""
        for child in target_func_node.children[:-1]:
            dis = child.start_point[1] - target_func_node.children[target_func_node.children.index(child) - 1].end_point[1]
            con = dis * " "
            inst_func += con + source_code[child.start_byte:child.end_byte]
            
        assert target_func_node.children[-1].type == 'statement_block'
        inst_func += " {\n"
        body_nodes = target_func_node.children[-1].children[1:-1]
        
        inst_func += "\n"
        for child in body_nodes:
            if child.type in child.type in ['function_declaration', 'generator_function_declaration', 'function_expression']:
                inst_func += add_indent(4, instrument_func(source_code, child)) + "\n"
            else:
                inst_func += add_indent(4, source_code[child.start_byte:child.end_byte]) + "\n"
        inst_func += "}\n"
        return inst_func
    
    vars_str = "{"
    for var in refered_vars:
        if var.startswith("class_var."):
            assert len(var.split(".")) == 2
            method_name = var.split(".")[1]
            vars_str += f"'{var}':  (('{method_name}' in class_var) ? {var} : 'undefined'), "
        else:
            vars_str += f"'{var}': {var}, "
    vars_str += "}"
    
    inst_func = rewrite_node(source_code, target_func_node.children[0], vars_str, blockId, False)
    for child in target_func_node.children[1:-1]:
        # if child.start_point[0] > target_func_node.children[target_func_node.children.index(child) - 1].end_point[0]:
        #     con = "\n"
        # else:
        dis = child.start_point[1] - target_func_node.children[target_func_node.children.index(child) - 1].end_point[1]
        con = dis * " "
        inst_func += con +  rewrite_node(source_code, child, vars_str, blockId, False)
    
    assert target_func_node.children[-1].type == 'statement_block'
    inst_func += " {\n"
    body_nodes = target_func_node.children[-1].children[1:-1]
    
    inst_func += "\n"
    
    # for var in variables[1]:
    #     if var.startswith("class_var["):
    #         inst_func += add_indent(4, f"{var} = None;") + "\n"
    
    start = False
    for child in body_nodes:
        if not start and child.type == 'comment' and "BLOCK BEGIN" in child.text.decode('utf-8'):
            inst_func += add_indent(4, f"_instrument_begin({vars_str}, {blockId});") + "\n"
            inst_func += add_indent(4, "try {") + "\n"
            start = True
        
        if start:
            inst_func += add_indent(4 + 4, rewrite_node(source_code, child, vars_str, blockId, True)) + "\n"
        else:
            inst_func += add_indent(4, rewrite_node(source_code, child, vars_str, blockId, False)) + "\n"
    
    if start:
        inst_func += 4 * " " + 4 * " " + f"return _instrument_return(_ret=null, _vars={vars_str}, blockId={blockId});\n"
        inst_func += 4 * " " + "}\n"
        inst_func += 4 * " " + "catch (e) {\n"
        inst_func += 4 * " " + 4 * " " + f"_instrument_throw(_err=e, _vars={vars_str}, blockId={blockId});\n"
        inst_func += 4 * " " + 4 * " " + f"throw e;\n"
        inst_func += 4 * " " + "}\n"
    inst_func += "}\n"

    return inst_func

def rewrite_node(code, node, vars_str, blockId, inside_body):
    
    
    if node.type == 'return_statement':
        if len(node.children) == 1 or node.children[1].text.decode('utf-8') == ';':
            new_ret = f"return _instrument_return(_ret=null, _vars={vars_str}, blockId={blockId});"
        else:
            exp_node = node.children[1]
            new_ret = f"return _instrument_return(_ret={rewrite_node(code, exp_node, vars_str, blockId, inside_body)}, _vars={vars_str}, blockId={blockId});"
        return new_ret
    
    else:
        # Reconstruct code for other node types
        if len(node.children) == 0:
            return code[node.start_byte:node.end_byte]
        else:
            if node.type == 'statement_block':
                return '\n'.join([add_indent(4, rewrite_node(code, child, vars_str, blockId, inside_body)) for child in node.children])
            elif node.type in ['function_declaration', 'generator_function_declaration', 'function_expression']:
                if inside_body: ### Do not instrument the temporary function in JS side.
                    return code[node.start_byte:node.end_byte]
                else:
                    return instrument_func(code, node)
            # elif node.type == 'string_fragment':
            #     return code[node.start_byte:node.end_byte]
            elif (node.type == 'call_expression'
                  and node.child_by_field_name('function').type == 'member_expression'
                  and node.child_by_field_name('function').text.decode('utf-8') == 'console.log'
                  and SHIM_PRINT_CALL):
                return f"_instrument_print_shim({' '.join([rewrite_node(code, arg, vars_str, blockId, inside_body) for arg in node.child_by_field_name('arguments').children[1:-1]])})"
            elif (node.type == 'call_expression'
                    and node.child_by_field_name('function').type == 'identifier'
                    and node.child_by_field_name('function').text.decode('utf-8') == 'user_randint'
                    and SHIM_RANDOM_CALL):
                return f"_instrument_random_shim({' '.join([rewrite_node(code, arg, vars_str, blockId, inside_body) for arg in node.child_by_field_name('arguments').children[1:-1]])})"
            else:
                tar = rewrite_node(code, node.children[0], vars_str, blockId, inside_body)
                for child in node.children[1:]:
                    if child.start_point[0] > node.children[node.children.index(child) - 1].end_point[0]:
                        con = "\n"
                    else:
                        dis = child.start_point[1] - node.children[node.children.index(child) - 1].end_point[1]
                        con = dis * " "
                    if node.type == 'template_string':
                        con = code[node.children[node.children.index(child) - 1].end_byte:child.start_byte]
                        # print(con)
                    tar += con + rewrite_node(code, child, vars_str, blockId, inside_body)
                return tar

if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    folder = sys.argv[1]
    FAST_MODE = True if sys.argv[2] == "fast" else False
    if FAST_MODE:
        CHECKER_FILE = './scripts/instrumentation/fast_mode_checker_code.js'
    else:
        CHECKER_FILE = './scripts/instrumentation/optimized_mode_checker_code.js'
    code = read_file(folder + '/translated.js')
    obs_vars = json.loads(read_file(folder + '/stage1_output/obs_vars.json'))
    tree = parser.parse(bytes(code, "utf8"))
    root_node = tree.root_node
    inst_code = instrument_code(code, root_node)
    
    trace_folder = folder + '/traces_all'
    inst_code = f"\nconst TRACE_FOLDER = '{trace_folder}';\n" + inst_code
    write_file(folder + '/transed_inst.js', inst_code)

