import inspect
import json
import sys
import os

# TRACE_FOLDER = ...
DEBUG = False
MAX_LEVEL = 2 # only used in fast mode
LOG_STEP = 10000 # total steps per log file
SKIP_STEP = 0 # skip the first n steps

total_step = -1
msg_queue = ""
call_stack = []
first_occurrence_of_block = {}


def summary(x, level=MAX_LEVEL):
    typestr = type(x).__name__
    if level == 0:
        return ["U"]
    if typestr in ["bool", "int", "float", "str"]:
        return x
        # return ["B", "T"] if x is True else ["B", "F"]
    # elif typestr == "int":
    #     return ["I", str(x)]
    # elif typestr == "float":
    #     return ["FL", str(x)[:-2]] if str(x).endswith(".0") else ["FL", str(x)]
    # elif typestr == "str":
    #     # if SIMPLIFY:
    #     #     return ["S", len(x), x[:10]]
    #     return ["S", len(x), x]
    elif (
        typestr == "list"
        or typestr == "tuple"
        # or isinstance(x, range)
        # or isinstance(x, zip)
        # or isinstance(x, enumerate)
        # or isinstance(x, deque)
        # or typestr == "<class 'collections.deque'>"
        or typestr == "dict_keys"
        or typestr == "dict_values"
        or typestr == "dict_items"
        # or typestr == "<class 'generator'>" # Lazy generator value
        # or isinstance(x, queue.Queue)
    ):
        # if isinstance(x, queue.Queue):
        #     _x = x.queue
        # elif isinstance(x, (tuple, range, zip, enumerate)):
        #     _x = list(copy.deepcopy(x))
        # elif (typestr == "<class 'generator'>"):
        #     _x = [i for i in x]
        # else:
        # _x = x
        # if level == 0:
        #     arr = ["L", 0, []]
        #     return arr
        # if len(x) > 0:
        # arr = ["L", len(x)]
        val = []
        count = 0
        for v in x:
            count += 1
            val.append(summary(v, level - 1))
        # arr.append(val)
        # if SIMPLIFY:
        #    arr[2] = arr[2][:10]
        return ["L", count, val]
        # else:
        #     return ["L", 0, []]
    elif typestr == "set":
        # if level == 0:
        #     return ["SET", []]
        # retval = ["SET"]
        val = []
        for v in x:
            val.append(summary(v, level - 1))
        # retval.append(val)
        return ["SET", val]
    elif typestr == "bytes":
        val = []
        count = 0
        for v in x:
            if count >= 20:
                break
            val.append(summary(v, level - 1))
            count += 1
        return ["BYTES", len(x), val]
    elif typestr == "dict":
        # or isinstance(x, Counter) or isinstance(x, defaultdict):
        # if level == 0:
        #     return ["D", []]
        # retval = ["D"]
        val = []
        for k in x:
            tmp = summary(x[k], level - 1)
            # if SIMPLIFY:
            if tmp == ["U"]:
                continue
            val.append([summary(k, level - 1), tmp])
        # retval.append(val)
        return ["D", val]
    elif x == None:
        return None
    # check if x is method, function, built-in function, class, type, module, or code
    elif inspect.isbuiltin(x):
        return ["U"]
    elif typestr == "function":
        # inspect.ismethod(x)
        # or inspect.isfunction(x)
        
        # if SIMPLIFY:
        #    return ["U"]
        #    print("BUILT IN FUNC", x.__name__)
        # key = x.__code__.co_firstlineno
        # # name = 'func at line ' + str(key)
        # if key not in funcIndexPy:
        #     funcIndexPy[key] = {'count': 1, 'address': set([id(x)])}
        # elif id(x) not in funcIndexPy[key]['address']:
        #     funcIndexPy[key]['count'] += 1
        #     funcIndexPy[key]['address'].add(id(x))

        # return ["F", x.__name__, funcIndexPy[key]['count']]
        return ["F", x.__name__]
    
    elif typestr == "type": 
        # inspect.isclass(x)
        
        # if SIMPLIFY:
        #    return ["U"]
        # key = x.__class__.__name__
        # if key == "type":
        #     return ["U"]
        # name = 'func at line ' + str(key)
        # if key not in classIndexPy:
        #     classIndexPy[key] = {'count': 0, 'address': set()}
        # elif id(x) not in classIndexPy[key]['address']:
        #     classIndexPy[key]['count'] += 1
        #     classIndexPy[key]['address'].add(id(x))
        return ["C", x.__name__]
    else:
        return ["U"]

def _instrument_begin(_call_info, _vars, _blockId):
    global total_step
    total_step += 1
    
    _from = call_stack[-1] if len(call_stack) > 0 else "START"
    call_stack.append(_blockId)
    _to = _blockId
    if total_step < SKIP_STEP:
        return
    
    vars = {}
    for var in _vars:
        if var.startswith("__"):
            continue
        vars[var] = summary(_vars[var])
    
    args = {}
    for arg in _call_info['args']:
        if arg.startswith("__"):
            continue
        args[arg] = summary(_call_info['args'][arg])
    call_info = {'args': args, 'func_name': _call_info['func_name']}
    _record_trace('begin', _blockId, _from, _to, vars, call_info)

def _instrument_throw(_err, _vars, _blockId):
    global total_step
    total_step += 1
    _from = _blockId
    call_stack.pop()
    _to = call_stack[-1] if len(call_stack) > 0 else "END"
    if total_step < SKIP_STEP:
        return
    
    vars = {}
    err = str(_err)
    for var in _vars:
        if var.startswith("__"):
            continue
        vars[var] = summary(_vars[var])
    _record_trace('throw', _blockId, _from, _to, vars, err)


def _instrument_return(_ret, _vars, _blockId):
    global total_step
    total_step += 1
    _from = _blockId
    call_stack.pop()
    _to = call_stack[-1] if len(call_stack) > 0 else "END"
    if total_step < SKIP_STEP:
        return _ret
    
    vars = {}
    ret = summary(_ret)
    for var in _vars:
        if var.startswith("__"):
            continue
        vars[var] = summary(_vars[var])
    _record_trace('return', _blockId, _from, _to, vars, ret)
    return _ret

def _record_trace(evt, blockId, _from, _to, vars, extra=None):
    global total_step, msg_queue
    if DEBUG and total_step >= 10 * LOG_STEP:
        exit()
    if total_step != SKIP_STEP and total_step % LOG_STEP == 0:
        filename = f"/_step_trace_from_{total_step - LOG_STEP}_to_{total_step}.log"
        print(f"[INFO] Writing to file {filename}")
        with open(TRACE_FOLDER + filename, 'w') as f:
            f.write(msg_queue)
        msg_queue = ""
        
    if _from not in first_occurrence_of_block: ### Record the first occurrence of the block.
        first_occurrence_of_block[_from] = total_step
        
    if evt == "begin":
        msg_queue += "Call|||From:" + str(_from) + "|||To:" + str(_to) + "|||" + json.dumps(vars) + "|||" + json.dumps(extra) + "\n"
    elif evt == "return":
        msg_queue += "Return|||From:" + str(_from) + "|||To:" + str(_to) + "|||" + json.dumps(vars) + "|||" + json.dumps(extra) + "\n"
    elif evt == "throw":
        msg_queue += "Throw|||From:" + str(_from) + "|||To:" + str(_to) + "|||" + json.dumps(vars) + "|||" + json.dumps(extra) + "\n"
    else:
        ...
    
    if evt in ["throw", "return"] and blockId == 0:
        filename = f"/_step_trace_from_{total_step - total_step % LOG_STEP}_to_{total_step - total_step % LOG_STEP + LOG_STEP}.log" 
        with open(TRACE_FOLDER + filename, 'w') as f:
            f.write(msg_queue)
        with open(TRACE_FOLDER + '/_step_trace_info.json', 'w') as f:
            trace_info = {'total_step': total_step, 'log_step': LOG_STEP, 'skip_step': SKIP_STEP}
            f.write(json.dumps(trace_info, indent=4))
        with open(TRACE_FOLDER + '/_first_occurrence_of_block.json', 'w') as f:
            f.write(json.dumps(first_occurrence_of_block, indent=4))
        msg_queue = ""
        
        
    

# code_name = os.path.abspath(__file__).split("/")[-1]

# def trace_calls(frame, event, arg):
#     if event != 'call':
#         return
#     code = frame.f_code
    
#     func_name = code.co_name
#     filename = os.path.abspath(code.co_filename)

#     if len(channel["_print_msg"]) > 0:
#         if filename.split("/")[-1] == code_name and func_name not in ["_instrument_begin", "_instrument_call", "_instrument_throw", "_instrument_return", "summary"]:
#             # print(f"Calling function '{func_name}' in file '{filename}' (inside program)")
#             print(channel["_print_msg"])
#             channel["_print_msg"] = ""

#     return trace_calls  # Continue tracing inside called functions

# real code begin
