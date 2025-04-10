# from execgraph import execgraph
from utils.query_llm_cached import turbo_chat_completion
import time
import json
import sys
ENGINE = "gpt-4-turbo"
MAX_LEVEL = 2
Code_Trans_Prompt_Without_Specs = """
You are a helpful assistant who translates Python code into JavaScript code. You should translate according to the following instructions:
- You are provided with the Python code.
- You should translate the given Python code to the JavaScript code.
- You should output the code directly without explanations and always in the same format.
- You should ALWAYS output best-effort translation, even if you are provided with partial code, modules, or code with dependencies.
- You should keep the naming style unchanged for the function names and variables.
- You should ALWAYS use `var` keyword for variable declarations in the translated code. AVOID using `let` or `const`.
- The Python code is the body of a function or a generator function. You SHOULD return or yield in your translated code if the Python code does so. But you should NOT wrap the code in a function or a class.
"""

Code_Trans_Prompt = """You are a helpful assistant who translates Python code into JavaScript code. You should translate according to the following instructions:
- You are provided with the following things:
    1. The Python code.
    2. The Input/Output specifications.
- You should translate the given Python code to the JavaScript code that satisfies all the specifications.
- You should output the code directly without explanations and always in the same format.
- You should ALWAYS output best-effort translation, even if you are provided with partial code, modules, or code with dependencies.
- You should keep the naming style unchanged for the function names and variables.
- You should ALWAYS use `var` keyword for variable declarations in the translated code. AVOID using `let` or `const`.
- The Python code is the body of a function or a generator function. You SHOULD return or yield in your translated code if the Python code does so. But you should NOT wrap the code in a function or a class.
"""

Code_Fix_Prompt = """You are a helpful assistant who fixes the incorrect JavaScript code, which is a translation from the given Python code. You should fix the code according to the following instructions:
- You are provided with the following things:
    1. The original Python code.
    2. The Input/Output specifications.
    3. The incorrect JavaScript code.
    4. The error message during testing the incorrect translated code.
- You should fix the incorrect JavaScript code. Your fixed JavaScript code should satisfy all the specifications.
- You should output the code directly without explanations and always in the same format.
- You should ALWAYS output best-effort translation, even if you are provided with partial code, modules, or code with dependencies.
- You should keep the naming style unchanged for the function names and variables.
- You should ALWAYS use `var` keyword for variable declarations in the translated code. AVOID using `let` or `const`.
- The Python code is the body of a function or a generator function. You SHOULD return or yield in your translated code if the Python code does so. But you should NOT wrap the code in a function or a class.
"""

def read_json(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

def read_text(path):
    with open(path, "r") as f:
        return f.read()

def write_text(path, content):
    with open(path, "w") as f:
        f.write(content)
        
def auto_retry_query(system, chat_history, user, engine="gpt-4-turbo"):
    try:
        res = turbo_chat_completion(system=system, chat_history=chat_history, user=user, engine=engine)
        if "error_msg" in res:
            raise Exception(res["error_msg"])
        return res

    except Exception as e:
        raise Exception(f"Error in auto_retry_query: {e}")

def read_prompts(prompts_file):
    prompts = []
    examples = read_json(prompts_file)
    for example in examples:

        if 'error_code' in example:
            user = combine_input(example['source_code'], example['specs'], example['error_code'], example['error_msg'])
        else:
            user = combine_input(example['source_code'], example['specs'])
        assistant = "```javascript\n"
        assistant += example['transed_code'] + "\n"
        assistant += "\n```"
        prompts.append({'usr': user, 'assist': assistant})
    return prompts

def compressed2readable(x, object_table, level = MAX_LEVEL):

    typestr = type(x).__name__
    
    ### If is primitive type, return directly.
    if x == None:
        return x
    elif typestr in ["bool", "int", "float"]:
        return x
    elif typestr == "str" and not x.startswith("oid_"):
        return x
    
    if level == 0:
        return "hidden value"
    
    ### If x is "oid_xxx", recursive on the real value.
    if typestr == "str" and x.startswith("oid_"):
        return compressed2readable(object_table[x], object_table, level)    
    
    ### x is in the format of "['TYPE', value]"
    typestr = x[0]
    if typestr in ["L", "A"]:
        arr = []
        for i in range(min(10, x[1])):
            arr.append(compressed2readable(x[2][i], object_table, level - 1))
        return arr
    elif typestr == "SET":
        retval = set()
        for i in range(min(10, len(x[1]))):
            retval.add(compressed2readable(x[1][i], object_table, level - 1))
        return retval
    elif typestr == "BYTES":
        retval = []
        if isinstance(x[1], list):
            for i in range(len(x[1])):
                retval.append(x[1][i])
        else:
            for i in range(len(x[2])):
                retval.append(x[2][i])
        return retval
    elif typestr in ["D", "OBJ", "MAP"]:
        retval = {}
        for i in range(min(10, len(x[1]))):
            retval[str(compressed2readable(x[1][i][0], object_table, level-1))] = compressed2readable(x[1][i][1], object_table, level-1)
        return retval
    elif typestr == "F":
        return f'<function {x[1]}>'
    elif typestr == "C":
        return f'<class {x[1]}>'
    elif typestr in ["NONE", "NULL"]:
        return None
    else:
        return "unknown value"

def shortCut2JsType(x, object_table):
    
    typestr = type(x).__name__
    
    ### If is primitive type, return directly.
    if x == None:
        return "null"
    elif typestr in ["bool"]:
        return "boolean"
    elif typestr in ["int", "float"]:
        return "number"
    elif typestr == "str" and not x.startswith("oid_"):
        return "string"
    
    ### If x is "oid_xxx", first get the real value from object_table.
    if typestr == "str" and x.startswith("oid_"):
        return shortCut2JsType(object_table[x], object_table)    
    
    shortCut = x[0]
    if shortCut in ['L', 'A']:
        return 'array'
    elif shortCut == 'D':
        return 'object'
    elif shortCut == 'OBJ':
        return 'object'
    elif shortCut == 'MAP':
        return 'map'
    elif shortCut == 'C':
        return 'class object'
    elif shortCut == 'F':
        return 'function object'
    elif shortCut == 'NONE':
        return 'null'
    elif shortCut == 'NULL':
        return 'null'
    ### Complex types will be supported in future
    elif shortCut == 'BYTES':
        return 'Buffer in JavaScript. (use xxx.buffer to convert it into ArrayBuffer if needed)'
    elif shortCut == 'DATE':
        return 'Date object in JavaScript. (use xxx.toISOString() to convert it into string if needed)'
    elif shortCut == 'REGEXP':
        return 'RegExp object in JavaScript.'
    elif shortCut == 'U':
        return 'unknown'
    else:
        raise TypeError("Unknown type")

def gen_one_line_prompt_input(variableName, value, object_table):
    val = compressed2readable(value, object_table)
    short_cut_type = shortCut2JsType(value, object_table)
    
    if short_cut_type in ['class object', 'function object', 'unknown']:
        return ""
    else:
        return "- The variable `{}` has value {} with type `{}`.\n".format(variableName, json.dumps(val), short_cut_type)


def gen_one_line_prompt_output(variableName, value, object_table):
    if variableName == "call info":
        args = value['args']
        func_name = value['func_name']
        count = 0
        arg_values_str = "("
        while True:
            if f"arg_{count}" in args:
                arg_values_str += json.dumps(compressed2readable(args[f"arg_{count}"], object_table)) + ", "
                count += 1
            else:
                break
        arg_values_str += ")"
        return "- After execution, the code will call to user function `{}` with arguments `{}`.\n".format(func_name, arg_values_str)
    
    
    val = compressed2readable(value, object_table)
    short_cut_type = shortCut2JsType(value, object_table)
    if variableName == "return value":
        return "- The return value of this function should be {} with type `{}`.\n".format(json.dumps(val), short_cut_type)
    elif variableName == "throw value":
        return "- This function should throw an error: `{}`.\n".format(val)
    elif short_cut_type in ['class object', 'function object', 'unknown']:
        return ""
    else:
        return "- The variable `{}` should have value {} with type `{}`.\n".format(variableName, json.dumps(val), short_cut_type)


def gen_one_line_prompt_f(variableName, value, object_table):
    if isinstance(value, str) and value.startswith("oid_") and object_table[value][0] == "F" or isinstance(value, list) and value[0] == 'F':
        return "`{}`,".format(variableName)
    else:
        return ""

def gen_one_line_prompt_c(variableName, value, object_table):
    if isinstance(value, str) and value.startswith("oid_") and object_table[value][0] == "C":
        return "`{}`,".format(variableName)
    else:
        return ""

def gen_one_line_prompt_u(variableName, value):
    if isinstance(value, list) and value[0] == 'U':
        return "`{}`,".format(variableName)
    else:
        return ""

def combine_input(code, specs=None, error_code=None, error_msg=None):
    # res_comment = "##### Python side\n"
    # res_comment += "### The program state before execution:\n"
    # for variable in variables['py']['before_state']:
    #     res_comment += gen_one_line_prompt(variable, variables['py']['before_state'][variable])
    res_comment = "### The Python code to translate:\n"
    res_comment += "```python\n"
    res_comment += code + "\n"
    res_comment += "```\n"
    # res_comment += "### The program state after execution:\n"
    # for variable in variables['py']['after_state']:
    #     res_comment += gen_one_line_prompt(variable, variables['py']['after_state'][variable])

    # res_comment += "##### JavaScript side\n"
    res_comment += "### You should translate this Python code to JavaScript code.\n"
    
    if specs != None:
        res_comment += "### Make sure that your translated code satisfies the following input/output specifications:\n"
        for i, spec in enumerate(specs):
            res_comment += f"## Specification {i}\n"
            res_comment += "# Input (Before Execution):\n"
            
            for variable in spec['before_state']['vars']:
                res_comment += gen_one_line_prompt_input(variable, spec['before_state']['vars'][variable], spec['before_state']['object_table'])
            
            tmp = "- ["
            has_any = False
            for variable in spec['before_state']['vars']:
                sub_tmp = gen_one_line_prompt_f(variable, spec['before_state']['vars'][variable], spec['before_state']['object_table'])
                if sub_tmp != "":
                    tmp += sub_tmp
                    has_any = True
            tmp += "] are the user-defined functions used in the current scope. You should preserve the original interaction patterns with these functions.\n"
            if has_any:
                res_comment += tmp
            
            # tmp = "- All the user-defined classes in the current scope: ["
            # has_any = False
            # for variable in spec['before_state']['vars']:
            #     tmp += gen_one_line_prompt_c(variable, spec['before_state']['vars'][variable], spec['before_state']['object_table'])
            #     if tmp != "":
            #         has_any = True
            # tmp += "]. You should preserve their original behavior.\n"
            # if has_any:
            #     res_comment += tmp

            # tmp = "- Variables with unknown value types in the current scope, they can be modules or more complex types: ["
            # has_any = False
            # for variable in states['before_state']['vars']:
            #     has_any = True
            #     tmp += gen_one_line_prompt_u(variable, states['before_state']['vars'][variable])
            # tmp += "]\n"
            # if has_any:
            #     res_comment += tmp

            res_comment += "# Output (After Execution):\n"
            
            for variable in spec['after_state']['vars']:
                res_comment += gen_one_line_prompt_output(variable, spec['after_state']['vars'][variable], spec['after_state']['object_table'])

    if error_msg and error_code:
        res_comment += "### The incorrect JavaScript code:\n"
        res_comment += "```javascript\n" + error_code + "\n```\n"
        res_comment += "### The error message during testing the incorrect JavaScript code:\n"
        # if error_msg.find("Value mismatch") >= 0:
        #     res_comment += "```" + error_msg.split("\n")[0] + "\n```\n"
        # else:
        res_comment += "```" + error_msg + "\n```\n"
        res_comment += "### The fixed JavaScript code:\n"

    else:
        res_comment += "### The translated JavaScript code:\n"
    # res_comment += "```javascript\n"
    # res_comment += code
    # res_comment += "```\n"

    return res_comment

def combineErrMsg(source_path, step_check_result):
    block_id_to_func_name_file = source_path + "/stage1_output/block_id_to_func_name.json"
    block_id_to_func_name = json.loads(read_text(block_id_to_func_name_file))
    
    assert 'err' in step_check_result
    _err_msg = step_check_result['err']
    if _err_msg['Reason'] == "Event Mismatch":
        assert _err_msg['ExpectedEvt'] != _err_msg['GotEvt']
        err_msg = "[ERROR] Behaviour Mismatch. The code is expected to "
        
        if _err_msg['ExpectedEvt'] == "Call":
            err_msg += f"call to user function '{block_id_to_func_name[_err_msg['ExpectedTo']]}'"
        elif _err_msg['ExpectedEvt'] == "Return":
            err_msg += "return to previous user function"
        elif _err_msg['ExpectedEvt'] == "Throw":
            err_msg += f"throw an error '{_err_msg['ExpectedExtra']}'"
        else:
            assert False
        
        err_msg += f", but it does not have the expected behaviour. Instead, "
        
        if _err_msg['GotEvt'] == "Call":
            err_msg += f"it call to user function '{block_id_to_func_name[str(_err_msg['GotTo'])]}'"
        elif _err_msg['GotEvt'] == "Return":
            err_msg += "it directly return to previous user function"
        elif _err_msg['GotEvt'] == "Throw":
            err_msg += f"it throw an error '{_err_msg['GotExtra']}'"
        else:
            assert False
        
        err_msg += "."
        return err_msg
    
    elif _err_msg['Reason'] == "Jump Target Mismatch":
        assert _err_msg['ExpectedEvt'] == _err_msg['GotEvt']
        assert _err_msg['ExpectedEvt'] == "Call" ### can only be call event
        assert _err_msg['ExpectedFrom'] == str(_err_msg['GotFrom'])
        assert _err_msg['ExpectedTo'] != str(_err_msg['GotTo'])
        
        err_msg = f"[ERROR] Call Target Mismatch. The code is expected to call to user function {block_id_to_func_name[_err_msg['ExpectedTo']]}"
        err_msg += f", but it incorrectly call to user function {block_id_to_func_name[str(_err_msg['GotTo'])]}."
        
        return err_msg

    elif _err_msg['Reason'] == "Return Value Mismatch":
        assert _err_msg['ExpectedEvt'] == _err_msg['GotEvt']
        assert _err_msg['ExpectedEvt'] == "Return"
        assert _err_msg['ExpectedFrom'] == str(_err_msg['GotFrom'])
        assert _err_msg['ExpectedTo'] == str(_err_msg['GotTo'])

        val = compressed2readable(_err_msg['ExpectedExtra'], _err_msg['ExpectedObjectTable'])
        short_cut_type = shortCut2JsType(_err_msg['ExpectedExtra'], _err_msg['ExpectedObjectTable'])
        err_msg = f"[ERROR] Return Value Mismatch. The code is expected to return value {json.dumps(val)} with type `{short_cut_type}`"        
        
        ### Refine the repr for values
        err_msg += f", but it incorrectly return value {json.dumps(_err_msg['GotExtra'])[:200]}."

        return err_msg
    elif _err_msg['Reason'] == "Variable Mismatch":
        assert _err_msg['ExpectedEvt'] == _err_msg['GotEvt']
        assert _err_msg['ExpectedEvt'] in ["Call", "Return", "Throw"]
        assert _err_msg['ExpectedFrom'] == str(_err_msg['GotFrom'])
        assert _err_msg['ExpectedTo'] == str(_err_msg['GotTo'])
        
        val = compressed2readable(_err_msg['ExpectedValue'], _err_msg['ExpectedObjectTable'])
        short_cut_type = shortCut2JsType(_err_msg['ExpectedValue'], _err_msg['ExpectedObjectTable'])
        err_msg = f"[ERROR] Variable Mismatch. After execution, vairable `{_err_msg['VarName']}` is expected to have value {json.dumps(val)} with type `{short_cut_type}`"
        
        ### Refine the repr for values
        err_msg += f", but got {json.dumps(_err_msg['GotValue'])[:200] if 'GotValue' in _err_msg  else json.dumps(None)}."

        return err_msg
    
    ### Shims for special functions
    elif _err_msg['Reason'] == "Random Shim Call Value Mismatch":
        err_msg = f"[ERROR] Random Call Mismatch. The code is expected to call `user_randint` function with input {_err_msg['Expected']}"
        err_msg += f", but it incorrectly call `user_randint with input {_err_msg['Got']}."
        return err_msg
    elif _err_msg['Reason'] == "Random Shim Call Number Mismatch":
        err_msg = f"[ERROR] Random Call Number Mismatch. The code is expected to call `user_randint` function {_err_msg['Expected']} times"
        err_msg += f", but it incorrectly call `user_randint` function {_err_msg['Got']} times."
        return err_msg
    elif _err_msg['Reason'] == "Print Shim Call Value Mismatch":
        err_msg = f"[ERROR] Print Call Mismatch. The code is expected to call `console.log` function and print {_err_msg['Expected']} to IO"
        err_msg += f", but it incorrectly print {_err_msg['Got']} to IO."
        return err_msg
    elif _err_msg['Reason'] == "Print Shim Call Number Mismatch":
        err_msg = f"[ERROR] Print Call Number Mismatch. The code is expected to call `console.log` function {_err_msg['Expected']} times"
        err_msg += f", but it incorrectly call `console.log` function {_err_msg['Got']} times."
        return err_msg
    else:
        assert False


import re
DEBUG = 0
def trans(system, his_msg, user, engine = "gpt-4-turbo", obs_vars = None):
    
    if DEBUG:
        print(system)
        print("-------------------")
        print(his_msg[0][0])
        print(his_msg[0][1])
        print("-------------------")
        print(user)
        exit(1)

    results = auto_retry_query(system=system, chat_history=his_msg, user=user, engine=engine)
    # print(results)
    req_and_tar_code = results['completion']

    if req_and_tar_code.find("```javascript") >= 0:
        req_and_tar_code = req_and_tar_code[req_and_tar_code.find("```javascript") + len("```javascript"):]
        req_and_tar_code = req_and_tar_code[:-3]
    if req_and_tar_code[0] == "\n":
        req_and_tar_code = req_and_tar_code[1:]
    if req_and_tar_code[-1] == "\n":
        req_and_tar_code = req_and_tar_code[:-1]
    req_and_tar_code = re.sub(r'\blet\b', 'var', req_and_tar_code)
    req_and_tar_code = re.sub(r'\bconst\b', 'var', req_and_tar_code)
    
    def replacement(match):
        var_name = match.group(1)  # Extract the variable name
        if var_name in obs_vars:
            return f"{var_name} ="  # Perform replacement
        else:
            return match.group(0)  # Return the original string unchanged
        
    pattern = re.compile(r'var\s+(\w+)\s*=')
    req_and_tar_code = re.sub(pattern, replacement, req_and_tar_code)

    if DEBUG:
        print(req_and_tar_code)
    
    return req_and_tar_code
    



if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    if len(sys.argv) < 2:
        source_path = "./benchmarks_new/test"
    else:
        source_path = sys.argv[1]
    
    ### 1. Get the translation info
    trans_info_file = source_path + "/trans_info.json"
    trans_info = read_json(trans_info_file)
    
    ### 2. Get the source code block
    source_code_blocks_file = source_path + "/stage1_output/source_codeblocks.json"
    source_code_blocks = read_json(source_code_blocks_file)
    source_code_block = source_code_blocks[trans_info['block_id']]['content']

    
    ### 3. Construct the input
    if trans_info['action'] == 'trans':
        if len(trans_info['specs']) == 1:
            trans_prompts_file = "./scripts/prompts/trans_prompts.json"
            prompts = read_prompts(trans_prompts_file)
            system = Code_Trans_Prompt
            user = combine_input(source_code_block, trans_info['specs'])
        else:
            trans_prompts_without_spec_file = "./scripts/prompts/trans_prompts_without_spec.json"
            prompts = read_prompts(trans_prompts_without_spec_file)
            system = Code_Trans_Prompt_Without_Specs
            user = combine_input(source_code_block)
    else:
        assert len(trans_info['specs']) >= 1
        ### Get the old incorrect transed block
        transed_code_blocks_file = source_path + "/checkpoint_files/transed_codeblocks.json"
        transed_code_blocks = read_json(transed_code_blocks_file)
        transed_code_block = transed_code_blocks[trans_info['block_id']]
        
        step_check_result_file = source_path + "/traces_all/_step_check_result.json"
        step_check_result = json.loads(read_text(step_check_result_file))
        fix_prompts_file = "./scripts/prompts/fix_prompts.json"
        prompts = read_prompts(fix_prompts_file)
        system = Code_Fix_Prompt
        err_msg = combineErrMsg(source_path, step_check_result)
        user = combine_input(source_code_block, trans_info['specs'], transed_code_block, err_msg)
    
    his_msg = []
    for i in range(len(prompts)):
        his_msg.append((prompts[i]['usr'], prompts[i]['assist']))
        
    obs_vars_file = source_path + "/stage1_output/obs_vars.json"
    obs_vars = json.loads(read_text(obs_vars_file))
    obs_vars_for_block = obs_vars[trans_info['block_id']]
    ### 5. Translate
    engine = trans_info['engine']
    print("[INFO] LLM Translating...", file=sys.stderr)
    translated_js_code_block = trans(system, his_msg, user, engine, obs_vars_for_block)
    print("[INFO] LLM Translation Finished.", file=sys.stderr)
    ### 6. Save the translated code
    transed_result_file = source_path + "/transed_result_file.txt"
    write_text(transed_result_file, translated_js_code_block)
    
