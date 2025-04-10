import inspect
import json
import sys
import os
import io

# TRACE_FOLDER = ...
DEBUG = False
LOG_STEP = 10000 # total steps per log file
SKIP_STEP = 0 # skip the first n steps

total_step = -1
msg_queue = ""
call_stack = []
id2oid = {}
all_objects = []
global_object_idx = 0
first_occurrence_of_block = {}

### shims
shim_random_seq = []
shim_print_seq = []

def summary(obj, object_table):
    global global_object_idx
    typestr = type(obj).__name__
    
    ### If is primitive type, return directly.
    if obj == None:
        return None
    elif inspect.isbuiltin(obj):
        return ["U"]
    elif typestr in ["bool", "int", "float", "str"]:
        return obj
    
    if id(obj) not in id2oid:
        oid = "oid_" + str(global_object_idx)
        id2oid[id(obj)] = oid
        all_objects.append(obj) ### This will keep the refer count of the object >= 1. And make the object not be collected by GC.
        global_object_idx += 1
    else:
        oid = id2oid[id(obj)]
        if oid in object_table:
            return oid
        else:
            object_table[oid] = ["TO_BE_FILLED"]

    if (
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
        val = []
        count = 0
        for v in obj:
            count += 1
            val.append(summary(v, object_table))
        
        object_table[oid] = ["L", count, val]
        return oid
    elif typestr == "set":
        val = []
        for v in obj:
            val.append(summary(v, object_table))
        
        object_table[oid] = ["SET", val]
        return oid
    elif typestr == "dict" or isinstance(obj, dict):
        val = []
        for k in obj:
            
            if type(k).__name__ in ["type", "function"]:
                key = "U"
                tmp = "U"
            else:
                tmp = summary(obj[k], object_table)
                if tmp == ["U"]:
                    continue
                key = summary(k, object_table)
            
            val.append([key, tmp])
        
        object_table[oid] = ["D", val]
        return oid
    elif typestr == "function":
        
        object_table[oid] = ["F", obj.__name__]
        return oid
    elif typestr == "type":
        
        object_table[oid] = ["C", obj.__name__]    
        return oid
    else:
        object_table[oid] = ["U"]
        return oid

def _instrument_random_shim(min, max):
    if total_step >= SKIP_STEP:
        shim_random_seq.append([min, max])
    return user_randint(min, max)

def _instrument_print_shim(*args, **kwargs):
    if total_step >= SKIP_STEP:
        output_capture = io.StringIO()
        sys.stdout = output_capture
        print(*args, **kwargs)
        IO_str = output_capture.getvalue()
        sys.stdout = sys.__stdout__
        shim_print_seq.append(IO_str)

    return print(*args, **kwargs)


def _instrument_begin(_call_info, _vars, _blockId):
    global total_step
    total_step += 1
    
    _from = call_stack[-1] if len(call_stack) > 0 else "START"
    call_stack.append(_blockId)
    _to = _blockId
    if total_step < SKIP_STEP:
        return
    
    vars = {}
    object_table = {}
    for var in _vars:
        if var.startswith("__"):
            continue
        vars[var] = summary(_vars[var], object_table)
    
    args = {}
    for arg in _call_info['args']:
        if arg.startswith("__"):
            continue
        args[arg] = summary(_call_info['args'][arg], object_table)
    call_info = {'args': args, 'func_name': _call_info['func_name']}
    _record_trace('begin', _blockId, _from, _to, vars, object_table, call_info)

def _instrument_throw(_err, _vars, _blockId):
    global total_step
    total_step += 1
    _from = _blockId
    call_stack.pop()
    _to = call_stack[-1] if len(call_stack) > 0 else "END"
    if total_step < SKIP_STEP:
        return
    
    vars = {}
    object_table = {}
    err = str(_err)
    for var in _vars:
        if var.startswith("__"):
            continue
        vars[var] = summary(_vars[var], object_table)
    _record_trace('throw', _blockId, _from, _to, vars, object_table, err)

def _instrument_return(_ret, _vars, _blockId):
    global total_step
    total_step += 1
    _from = _blockId
    call_stack.pop()
    _to = call_stack[-1] if len(call_stack) > 0 else "END"
    if total_step < SKIP_STEP:
        return _ret
    
    vars = {}
    object_table = {}
    ret = summary(_ret, object_table)
    for var in _vars:
        if var.startswith("__"):
            continue
        vars[var] = summary(_vars[var], object_table)
    _record_trace('return', _blockId, _from, _to, vars, object_table, ret)
    return _ret

def _record_trace(evt, blockId, _from, _to, vars, object_table, extra=None):
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
        msg_queue += "Call|||From:" + str(_from) + "|||To:" + str(_to) + "|||" + json.dumps(vars)+ "|||" + json.dumps(object_table) + "|||" + json.dumps(extra)
    elif evt == "return":
        msg_queue += "Return|||From:" + str(_from) + "|||To:" + str(_to) + "|||" + json.dumps(vars)+ "|||" + json.dumps(object_table) + "|||" + json.dumps(extra)
    elif evt == "throw":
        msg_queue += "Throw|||From:" + str(_from) + "|||To:" + str(_to) + "|||" + json.dumps(vars)+ "|||" + json.dumps(object_table) + "|||" + json.dumps(extra)
    else:
        ...
    
    if shim_random_seq != []:
        msg_queue += "|||" + json.dumps(shim_random_seq)
        shim_random_seq.clear()
    else:
        msg_queue += "|||[]"
    
    if shim_print_seq != []:
        msg_queue += "|||" + json.dumps(shim_print_seq)
        shim_print_seq.clear()
    else:
        msg_queue += "|||[]"
    
    msg_queue += "\n"
    
    if evt in ["throw", "return"] and blockId == 0: ### End of the program
        filename = f"/_step_trace_from_{total_step - total_step % LOG_STEP}_to_{total_step - total_step % LOG_STEP + LOG_STEP}.log" 
        with open(TRACE_FOLDER + filename, 'w') as f:
            f.write(msg_queue)
        with open(TRACE_FOLDER + '/_step_trace_info.json', 'w') as f:
            trace_info = {'total_step': total_step, 'log_step': LOG_STEP, 'skip_step': SKIP_STEP}
            f.write(json.dumps(trace_info, indent=4))
        with open(TRACE_FOLDER + '/_first_occurrence_of_block.json', 'w') as f:
            f.write(json.dumps(first_occurrence_of_block, indent=4))
        msg_queue = ""
        
