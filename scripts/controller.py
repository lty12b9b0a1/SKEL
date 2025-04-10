import sys
import os
import json
import time


SCRIPT_DIR = os.path.abspath(os.path.dirname(os.path.realpath(__file__)))
REL = lambda *x: os.path.abspath(os.path.join(SCRIPT_DIR, *x))
TESTS_ROOT = REL("../benchmarks_new")
SCRIPTS_ROOT = REL("../scripts")
ALLOW_MODIFY_OTHER_CODE_BLOCKS = True

def read_text(filename):
  with open(filename, 'r') as f: return f.read()

def write_text(filename, content):
  with open(filename, 'w') as f: f.write(content)

def get_codeBlocks_py(code):
  t = False
  blocks = {}
  block_id = '-1'
  for i, line in enumerate(code):
    if line.find("### --- BLOCK BEGIN") >= 0:
      t = True
      block_id = line[line.find("### --- BLOCK BEGIN") + len("### --- BLOCK BEGIN "):]
      blocks[block_id] = {"block_start": i+2, "block_end": -1, "content": ""}
    
    elif line.find("### --- BLOCK END") >= 0:
      blocks[block_id]['block_end'] = i
      blocks[block_id]['content'] = blocks[block_id]['content'][:-1]
      t = False
    
    elif t:
      blocks[block_id]['content'] += line + '\n'

  return blocks

def initTestCase(test_folder_name, skip_trace=False):
    
    
    source_folder = TESTS_ROOT + test_folder_name
    trace_folder = f"{source_folder}/traces_all"
    if not os.path.exists(trace_folder):
        command = f"mkdir {source_folder}/traces_all"
        ret = os.system(command)

    stage1_output_folder = f"{source_folder}/stage1_output"
    if not os.path.exists(stage1_output_folder):
        command = f"mkdir {source_folder}/stage1_output"
        ret = os.system(command)

    checkpoint_files_folder = f"{source_folder}/checkpoint_files"
    if not os.path.exists(checkpoint_files_folder):
        command = f"mkdir {source_folder}/checkpoint_files"
        ret = os.system(command)

    ### 1. Normalize the source code.
    normalize_script_path = SCRIPTS_ROOT + "/normalize.py"
    command = f"timeout 3600 python {normalize_script_path} {source_folder}"
    ret = os.system(command)
    assert ret == 0
    
    ### 2. Get sourece codeblocks.
    normalized_source_code_file = TESTS_ROOT + test_folder_name + "/source_normalized.py"
    normalized_source_code = read_text(normalized_source_code_file)
    
    source_code_blocks = get_codeBlocks_py(normalized_source_code.split('\n'))
    source_code_blocks_file = TESTS_ROOT + test_folder_name + "/stage1_output/source_codeblocks.json"
    write_text(source_code_blocks_file, json.dumps(source_code_blocks, indent=4))

    if not skip_trace:
        ### 3. Trace the source code. This can be quite slow.
        step_record_script_path = SCRIPTS_ROOT + "/step_record.py"
        command = f"timeout 36000 python {step_record_script_path} {source_folder} {'fast' if FAST_MODE else 'optimized'}"
        ret = os.system(command)
        assert ret == 0
        
    else:
        ### 3. Instrument (Obtain the observable variables)
        step_record_instrument_path = SCRIPTS_ROOT + "/step_record_instrument.py"
        command = f"timeout 600 python {step_record_instrument_path} {source_folder} {'fast' if FAST_MODE else 'optimized'}"
        ret = os.system(command)
        assert ret == 0

    ### 4. Write the js template code to the translated.js file
    transed_template_code_file = TESTS_ROOT + test_folder_name + "/stage1_output/skeleton_syn.js"
    transed_code_file = TESTS_ROOT + test_folder_name + "/translated.js"
    transed_template_code = read_text(transed_template_code_file)
    write_text(transed_code_file, transed_template_code)

    ### 5. Initialize the transed code blocks.
    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    transed_code_blocks = {key: "" for key in source_code_blocks.keys()}
    write_text(transed_code_blocks_file, json.dumps(transed_code_blocks, indent=4))
    
    ### 6. Init the control file.
    control_info_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/control.json"
    control_info = {"cur_step": 1, "is_transed": {block_id: False for block_id in transed_code_blocks}}
    write_text(control_info_file, json.dumps(control_info, indent=4))
    
    ### 7. Init the specifcation file.
    spec_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/specifications.json"
    spec = {block_id: {} for block_id in transed_code_blocks}
    write_text(spec_file, json.dumps(spec, indent=4))

    return 0


def refreshTransedCode(test_folder_name):
    source_folder = TESTS_ROOT + test_folder_name

    ### 1. Write the js template code to the translated.js file
    transed_template_code_file = TESTS_ROOT + test_folder_name + "/stage1_output/skeleton_syn.js"
    transed_code_file = TESTS_ROOT + test_folder_name + "/translated.js"
    transed_template_code = read_text(transed_template_code_file)
    write_text(transed_code_file, transed_template_code)
    
    ### 2. Refresh the transed code blocks.
    source_code_blocks_file = TESTS_ROOT + test_folder_name + "/stage1_output/source_codeblocks.json"
    source_code_blocks = json.loads(read_text(source_code_blocks_file))
    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    transed_code_blocks = {key: "" for key in source_code_blocks.keys()}
    write_text(transed_code_blocks_file, json.dumps(transed_code_blocks, indent=4))
    
    ### 3. Refresh the control file.
    control_info_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/control.json"
    control_info = {"cur_step": 1, "is_transed": {block_id: False for block_id in transed_code_blocks}}
    write_text(control_info_file, json.dumps(control_info, indent=4))
    
    ### 4. Refresh the specifcation file.
    spec_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/specifications.json"
    spec = {block_id: {} for block_id in transed_code_blocks}
    write_text(spec_file, json.dumps(spec, indent=4))
    
    return 0

def decodeTraceLog(log):
    log = log.split("\n")
    trace = []
    for line in log:
        if line == "":
            continue
        if FAST_MODE:
            evt, _from, _to, vars, extra = line.split("|||")
            object_table = "{}"
        else:
            evt, _from, _to, vars, object_table, extra, random_shim_call, print_shim_call = line.split("|||")
            
        _from = _from.split(":")[1]
        _to = _to.split(":")[1]
        trace.append({"evt": evt, "from": _from, "to": _to, "vars": json.loads(vars), "object_table": json.loads(object_table), "extra": json.loads(extra)})
    return trace

def stepTransPrepare(test_folder_name):
    
    ### 1. Check if the current step is the last
    control_info_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/control.json"
    trace_info_file = TESTS_ROOT + test_folder_name + "/traces_all/_step_trace_info.json"
    control_info = json.loads(read_text(control_info_file))
    trace_info = json.loads(read_text(trace_info_file))
    cur_step = control_info['cur_step']
    total_step = trace_info['total_step']
    log_step = trace_info['log_step']
    if cur_step >= total_step:
        print(f"[INFO] The current step {cur_step} is the last step.")
        return 0
    
    ### 2. Check if the code block in current pc has been transed
    from_step = cur_step - cur_step % log_step
    to_step = cur_step - cur_step % log_step + log_step
    step_trace_log_file = TESTS_ROOT + test_folder_name + f"/traces_all/_step_trace_from_{from_step}_to_{to_step}.log"
    step_trace_log = decodeTraceLog(read_text(step_trace_log_file)) ### In step trans, reload it each time. In automatic translation, only load it once.
    block_id = step_trace_log[cur_step % log_step]['from']
    isTransed = control_info['is_transed']
    if isTransed[block_id] == True:
        print(f"[INFO] The code block {block_id} in current step {cur_step} has been transed. Skipped.", file=sys.stderr)
        transed_result_file = TESTS_ROOT + test_folder_name + "/transed_result_file.txt"
        write_text(transed_result_file, "[Transed]")
        return 0
    
    ### 3. Step Translation
    ret = stepTrans(test_folder_name, step_trace_log, cur_step, log_step)
    assert ret == 0
    
    ### 4. Update the control file
    isTransed[block_id] = True
    control_info['is_transed'] = isTransed
    write_text(control_info_file, json.dumps(control_info, indent=4))
    return 0

def fillNotCoveredBlocks(test_folder_name):

    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    transed_code_blocks = json.loads(read_text(transed_code_blocks_file))
    control_info_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/control.json"
    control_info = json.loads(read_text(control_info_file))

    trans_info_file = TESTS_ROOT + test_folder_name + "/trans_info.json"
    step_trans_script_path = SCRIPTS_ROOT + "/step_trans.py"
    source_folder = TESTS_ROOT + test_folder_name
    transed_result_file = TESTS_ROOT + test_folder_name + "/transed_result_file.txt"
    not_covered_blocks = [block_id for block_id in control_info['is_transed'] if control_info['is_transed'][block_id] == False]

    print(f"[INFO] Fillling the remaining code blocks...")
    for block_id in not_covered_blocks:
        print(f"[INFO] Translating code block {block_id}...", file=sys.stderr)
        trans_info = trans_info = {
            'action': 'trans',
            'block_id': block_id,
            'specs': [], ### No spec for the translation.
            'engine': ENGINE
        }
        write_text(trans_info_file, json.dumps(trans_info, indent=4))
        
        command = f"timeout 600 python {step_trans_script_path} {source_folder}"
        ret = os.system(command)
        assert ret == 0
        
        transed_result = read_text(transed_result_file)
        os.remove(transed_result_file)
        os.remove(trans_info_file)


        transed_code_blocks[block_id] = transed_result

    write_text(transed_code_blocks_file, json.dumps(transed_code_blocks))

    ret = patchJsCode(test_folder_name)
    assert ret == 0

    return 0

def stepTrans(test_folder_name, step_trace_log, cur_step, log_step):
    
    block_id = step_trace_log[cur_step % log_step]['from']
    
    ### 1. Check if human provided the translation. (For test code blocks)
    test_fragments_file = TESTS_ROOT + test_folder_name + f"/test_fragments/block_{block_id}.txt"
    if os.path.exists(test_fragments_file):
        ### 2.1. Read the human provided translation
        print(f"[INFO] The translation of code block {block_id} is provided by human.")
        transed_result = read_text(test_fragments_file)
    else:
        ### 2.2.1 Write the translation info
        trans_info_file = TESTS_ROOT + test_folder_name + "/trans_info.json"
        if ALLOW_SPEC:
            state = combineSpec(step_trace_log, cur_step, log_step)
            trans_info = {
                'action': 'trans',
                'block_id': block_id,
                'specs': [{'before_state': state['before_state'], 'after_state': state['after_state']}],
                'engine': ENGINE
            }
        else:
            trans_info = trans_info = {
                'action': 'trans',
                'block_id': block_id,
                'specs': [], ### No spec for the translation.
                'engine': ENGINE
            }
        
        write_text(trans_info_file, json.dumps(trans_info, indent=4))

        ### 2.2.2. Translate the code block
        step_trans_script_path = SCRIPTS_ROOT + "/step_trans.py"
        source_folder = TESTS_ROOT + test_folder_name
        command = f"timeout 600 python {step_trans_script_path} {source_folder}"
        ret = os.system(command)
        assert ret == 0
        
        ### 2.2.3. Read the translation result
        transed_result_file = TESTS_ROOT + test_folder_name + "/transed_result_file.txt"
        transed_result = read_text(transed_result_file)
        os.remove(transed_result_file)
        os.remove(trans_info_file)
    
    ### 3. Save the result
    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    transed_code_blocks = json.loads(read_text(transed_code_blocks_file))
    transed_code_blocks[block_id] = transed_result
    write_text(transed_code_blocks_file, json.dumps(transed_code_blocks))
    
    return 0


def stepFix(test_folder_name, block_id, _specs):

    ### 1. Assert the error block should not from test.
    test_fragments_file = TESTS_ROOT + test_folder_name + f"/test_fragments/block_{block_id}.txt"
    assert not os.path.exists(test_fragments_file)

    ### 2. Write the translation info
    assert len(_specs.keys()) >= 1
    specs = []
    for history_step in _specs:
        specs.append({'before_state': _specs[history_step]['before_state'], 'after_state': _specs[history_step]['after_state']})

    trans_info_file = TESTS_ROOT + test_folder_name + "/trans_info.json"
    trans_info = {
        'action': 'fix',
        'block_id': block_id,
        'specs': specs,
        'engine': ENGINE
    }
    write_text(trans_info_file, json.dumps(trans_info, indent=4))

    ### 3. Translate the code block
    step_trans_script_path = SCRIPTS_ROOT + "/step_trans.py"
    source_folder = TESTS_ROOT + test_folder_name
    command = f"timeout 600 python {step_trans_script_path} {source_folder}"
    ret = os.system(command)
    assert ret == 0
    
    ### 4. Read the translation result
    transed_result_file = TESTS_ROOT + test_folder_name + "/transed_result_file.txt"
    transed_result = read_text(transed_result_file)
    os.remove(transed_result_file)
    os.remove(trans_info_file)
    
    ### 5. Save the result
    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    transed_code_blocks = json.loads(read_text(transed_code_blocks_file))
    transed_code_blocks[block_id] = transed_result
    write_text(transed_code_blocks_file, json.dumps(transed_code_blocks))
    
    return 0


def stepCheck(test_folder_name):
    ### 1. Trace the transed code. This can be quite slow.
    step_check_script_path = SCRIPTS_ROOT + "/step_check.py"
    source_folder = TESTS_ROOT + test_folder_name
    command = f"timeout 36000 python {step_check_script_path} {source_folder} {'fast' if FAST_MODE else 'optimized'}"
    ret = os.system(command)
    assert ret == 0
    
    ### 2. Check the result
    step_check_result_file = TESTS_ROOT + test_folder_name + "/traces_all/_step_check_result.json"
    step_check_result = json.loads(read_text(step_check_result_file))
    # if 'err' in step_check_result:
    #     print(f"[INFO] Step check failed on step {step_check_result['step']}")
    # else:
    #     print(f"[INFO] Step check success for all steps from 0 to {step_check_result['step']}")
    
    return step_check_result

def runTracerPy(test_folder_name):
    source_folder = TESTS_ROOT + test_folder_name

    ### 1. Normalize the source code.
    normalize_script_path = SCRIPTS_ROOT + "/normalize.py"
    command = f"timeout 3600 python {normalize_script_path} {source_folder}"
    ret = os.system(command)
    assert ret == 0

    ### 2. Trace the source code. This can be quite slow.
    step_record_script_path = SCRIPTS_ROOT + "/step_record.py"
    command = f"timeout 36000 python {step_record_script_path} {source_folder} {'fast' if FAST_MODE else 'optimized'}"
    ret = os.system(command)
    assert ret == 0

    ### 3. Get the source code blocks.
    normalized_source_code_file = TESTS_ROOT + test_folder_name + "/source_normalized.py"
    normalized_source_code = read_text(normalized_source_code_file)
    
    ### 4. Save the source code blocks
    source_code_blocks = get_codeBlocks_py(normalized_source_code.split('\n'))
    source_code_blocks_file = TESTS_ROOT + test_folder_name + "/stage1_output/source_codeblocks.json"
    write_text(source_code_blocks_file, json.dumps(source_code_blocks, indent=4))
    
    return 0

def patchJsCode(test_folder_name):
    transed_template_code_file = TESTS_ROOT + test_folder_name + "/stage1_output/skeleton_syn.js"
    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    transed_template_code = read_text(transed_template_code_file)
    transed_code_blocks = json.loads(read_text(transed_code_blocks_file))
    transed_code_file = TESTS_ROOT + test_folder_name + "/translated.js"

    for blockId, blockCode in transed_code_blocks.items():
        transed_template_code = transed_template_code.replace(f"/// --- BLOCK BEGIN {blockId}\n", f"/// --- BLOCK BEGIN {blockId}\n" + blockCode)
    write_text(transed_code_file, transed_template_code)
    return 0

import re
def eraseJsCode(test_folder_name):
    js_code_template_file = TESTS_ROOT + test_folder_name + "/main.js"
    js_code_blocks_file = TESTS_ROOT + test_folder_name + "/main.js.codeblocks.json"
    js_code_patched_file = TESTS_ROOT + test_folder_name + "/main_patched.js"
    js_code_blocks_id = [id for id, _ in json.loads(read_text(js_code_blocks_file)).items()]
    content = read_text(js_code_template_file)
    # remove all the code between each '/// --- BLOCK BEGIN' and '/// --- BLOCK END'
    content = re.sub(r'(?m)^(^[ \t]*/// --- BLOCK BEGIN \d+\n).*?(^[ \t]*/// --- BLOCK END \d+)', r'\1\n\2', content, flags=re.DOTALL)
    
    write_text(js_code_patched_file, content)
    return 0


def get_codeBlocks_js(code:str):
    t = False
    blocks = {}
    block_id = '-1'
    for i, line in enumerate(code):
        if line.find("/// --- BLOCK BEGIN") >= 0:
            t = True
            block_id = line[line.find("/// --- BLOCK BEGIN") + len("/// --- BLOCK BEGIN "):]
            # blocks[block_id] = {"block_start": i+2, "block_end": -1, "content": ""}
            blocks[block_id] = ""
        
        elif line.find("/// --- BLOCK END") >= 0:
            # blocks[block_id]['block_end'] = i
            # blocks[block_id]['content'] = blocks[block_id]['content'][:-1]
            blocks[block_id] += line[:line.find("/// --- BLOCK END")] + '\n'
            blocks[block_id] = blocks[block_id][:-1]
            t = False
        
        elif t:
            # blocks[block_id]['content'] += line + '\n'
            blocks[block_id] += line + '\n'
    # blocks.pop('START')
    # blocks.pop('END')
    return blocks

def load_manually_fixed_code(test_folder_name):
    # raise NotImplementedError("Not implemented yet.")
    transed_code_file = TESTS_ROOT + test_folder_name + "/translated.js"
    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    transed_code_blocks = get_codeBlocks_js(read_text(transed_code_file).split('\n'))
    ### remove the ending "\n"
    new_transed_code_blocks = {}
    for block_id in transed_code_blocks:
        block = transed_code_blocks[block_id]
        while block[-1] in ['\n', " "]:
            block = block[:-1]
            if block == "":
                break
        
        block += '\n'
        new_transed_code_blocks[block_id] = block
            
    write_text(transed_code_blocks_file, json.dumps(new_transed_code_blocks, indent=4))

def updateStep(test_folder_name, new_step):
    first_occurrence_of_block_file = TESTS_ROOT + test_folder_name + "/traces_all/_first_occurrence_of_block.json"
    first_occurrence_of_block_file = json.loads(read_text(first_occurrence_of_block_file))
    
    control_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/control.json"
    controlRec = json.loads(read_text(control_file))
    cur_step = controlRec['cur_step']
    is_transed = controlRec['is_transed']
    
    newest_step = new_step
    for block_id in first_occurrence_of_block_file:
        if first_occurrence_of_block_file[block_id] >= cur_step and is_transed[block_id] == False:
            newest_step = min(newest_step, first_occurrence_of_block_file[block_id])
    
    controlRec['cur_step'] = newest_step
    write_text(control_file, json.dumps(controlRec))
    return newest_step

def combineSpec(step_trace_log, cur_step, log_step):
    evt = step_trace_log[cur_step % log_step]['evt']
    after_state = {'object_table': step_trace_log[cur_step % log_step]['object_table']}
    if evt == "Call":
        # after_state['vars'] = step_trace_log[cur_step % log_step]['vars'] ### This is special. For call action, the state in the callee side is not useful.
        after_state['vars'] = {}
        after_state['vars']['call info'] = step_trace_log[cur_step % log_step]['extra']
    elif evt == "Return":
        after_state['vars'] = step_trace_log[cur_step % log_step]['vars']
        after_state['vars']['return value'] = step_trace_log[cur_step % log_step]['extra']
    else:
        after_state['vars'] = step_trace_log[cur_step % log_step]['vars']
        after_state['vars']['throw value'] = step_trace_log[cur_step % log_step]['extra']
    
    if cur_step % log_step == 0:
        before_state = {'vars': {}, 'object_table': {}}
    else:
        before_state = {
            'vars': step_trace_log[(cur_step - 1) % log_step]['vars'],
            'object_table': step_trace_log[(cur_step - 1) % log_step]['object_table']
        }
    
    return {'before_state': before_state, 'after_state': after_state}


def loadTraceLog(test_folder_name, from_step, to_step):
    step_trace_log_file = TESTS_ROOT + test_folder_name + f"/traces_all/_step_trace_from_{from_step}_to_{to_step}.log"
    step_trace_log = decodeTraceLog(read_text(step_trace_log_file))
    return step_trace_log


def saveCorrectCodeBlock(test_folder_name):
    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
    correc_transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/correct_transed_codeblocks.json"
    transed_code_blocks = json.loads(read_text(transed_code_blocks_file))
    write_text(correc_transed_code_blocks_file, json.dumps(transed_code_blocks, indent=4))
    return 0
    

def autoTrans(test_folder_name, auto_fill = False):
    ### 1. Init the test case
    if not os.path.exists(TESTS_ROOT + test_folder_name + "/checkpoint_files/control.json"):
        print("[ERROR] Not Initialized. You should first initialize the translation task.")
        return 1

    ### 2. Load the control file and trace info file. Const. Never Change!
    trace_info_file = TESTS_ROOT + test_folder_name + "/traces_all/_step_trace_info.json"
    trace_info = json.loads(read_text(trace_info_file))
    total_step = trace_info['total_step']
    log_step = trace_info['log_step']
    
    ### 3. Load the current step
    control_info_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/control.json"
    control_info = json.loads(read_text(control_info_file))
    cur_step = control_info['cur_step'] ### Increase Only!
    isTransed = control_info['is_transed']
    
    ### 4. Load the first step trace log file
    from_step = cur_step - cur_step % log_step
    to_step = cur_step - cur_step % log_step + log_step
    step_trace_log = loadTraceLog(test_folder_name, from_step, to_step)
    
    ### 5. Init the step check result
    step_check_result = stepCheck(test_folder_name)
    # assert step_check_result['step'] <= cur_step
    
    groundtruth_fragments_file = TESTS_ROOT + test_folder_name + f"/groundtruth_fragments.json"
    if os.path.exists(groundtruth_fragments_file):
        groundtruth_fragments = json.loads(read_text(groundtruth_fragments_file))
    else:
        groundtruth_fragments = {}
    trans_statistic_result_file = TESTS_ROOT + test_folder_name + "/result.json"
    human_fixed_blocks = []
    ### 6. Start the translation (Start from step 1)
    while True:
        print("[INFO] Current Step:", cur_step)
        
        ### 6.1. Check if the current step is the last
        if cur_step >= total_step:
            if auto_fill:
                fillNotCoveredBlocks(test_folder_name)
            print(f"[INFO] The current step {cur_step} is the last step. Translation Finished.")
            trans_result = {"total_step": total_step, "human_fixed_blocks": human_fixed_blocks}
            write_text(trans_statistic_result_file, json.dumps(trans_result, indent=4))
            return 0
        
        ### 6.2 Refresh the step trace log if needed.
        if cur_step >= to_step:
            from_step = cur_step - cur_step % log_step
            to_step = cur_step - cur_step % log_step + log_step
            step_trace_log = loadTraceLog(test_folder_name, from_step, to_step)
        
        ### 6.3. Translate the code block
        block_id = step_trace_log[cur_step % log_step]['from']
        if isTransed[block_id] == True: ### Case 1. The code block has been transed.
            print(f"[INFO] The code block {block_id} in current step {cur_step} has been transed. Skipped.", file=sys.stderr)
        else: ### Case 2. New code block.
            print(f"[INFO] Translate new code block {block_id}.", file=sys.stderr)
            ret = stepTrans(test_folder_name, step_trace_log, cur_step, log_step)
            assert ret == 0

            ### Patch the code blocks into the template.
            ret = patchJsCode(test_folder_name)
            assert ret == 0
        
            ### Update the control file
            isTransed[block_id] = True
            control_info['is_transed'] = isTransed
            write_text(control_info_file, json.dumps(control_info, indent=4))
            
            ### Step Check
            print("[INFO] Step Checking...")
            step_check_result = stepCheck(test_folder_name) ### Update the step check result.
            print(f"[INFO] Step Check Done.")
            if 'err' not in step_check_result:
                if auto_fill:
                    fillNotCoveredBlocks(test_folder_name)
                print(f"[INFO] Pass All the {step_check_result['step']} Steps. Translation Success.")
                trans_result = {"total_step": total_step, "human_fixed_blocks": human_fixed_blocks}
                write_text(trans_statistic_result_file, json.dumps(trans_result, indent=4))
                return 0
        
        ### 6.4 Refine&Fix loop
        retry = 0
        while True:
            ### 1. Check if the retry limit is reached.
            if retry >= RETRY_LIMIT: ### If reach the retry limit, ask for human help.
                print("[INFO] Reach the Retry Limit. Ask for human help.")
                if block_id in groundtruth_fragments: ### Case 1. Human Fixed File Exists.
                    human_fixed_blocks.append(block_id) ### Count this block as user_fixed.
                    print(f"[INFO] Human Fixed File for Block {block_id} Exists.")
                    transed_code_blocks_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/transed_codeblocks.json"
                    transed_code_blocks = json.loads(read_text(transed_code_blocks_file))
                    transed_code_blocks[block_id] = groundtruth_fragments[block_id]
                    write_text(transed_code_blocks_file, json.dumps(transed_code_blocks, indent=4))
                    ret = patchJsCode(test_folder_name)
                    assert ret == 0
                    step_check_result = stepCheck(test_folder_name) ### Update the step check result.
                    if 'err' not in step_check_result: ### Translation Finished.
                        if auto_fill:
                            fillNotCoveredBlocks(test_folder_name)
                        print(f"[INFO] Pass All the {step_check_result['step']} Steps. Translation Success.")
                        trans_result = {"total_step": total_step, "human_fixed_blocks": human_fixed_blocks}
                        write_text(trans_statistic_result_file, json.dumps(trans_result, indent=4))
                        return 0
                    assert 'step' in step_check_result ### Assume human is always right.
                    assert step_check_result['step'] > cur_step ### Assume human is always right.
                    print(f"[INFO] Step Check Succeed on All History Steps.")
                    new_step = updateStep(test_folder_name, step_check_result['step'])
                    print(f"[INFO] Move from the current step {cur_step} to the new step {new_step}.")
                    cur_step = new_step
                    break
                
                else: ### Case 2. Human Fixed File Not Exists.
                    print(f"[INFO] Human Fixed File for Block {block_id} Not Exists. Translation Ended.")
                    exit()
            
            ### 2. Check the current step.
            if retry == 0 and isTransed[block_id] == True:
                print(f"[INFO] The code block {block_id} in current step {cur_step} has been checked.")
                step_check_result_file = TESTS_ROOT + test_folder_name + "/traces_all/_step_check_result.json"
                step_check_result = json.loads(read_text(step_check_result_file))
            else:
                print("[INFO] Step Checking...")
                step_check_result = stepCheck(test_folder_name) ### Update the step check result.
                print(f"[INFO] Step Check Done.")

            
            if 'err' not in step_check_result: ### Case 1. Translation Finished.
                if auto_fill:
                    fillNotCoveredBlocks(test_folder_name)
                print(f"[INFO] Pass All the {step_check_result['step']} Steps. Translation Success.")
                trans_result = {"total_step": total_step, "human_fixed_blocks": human_fixed_blocks}
                write_text(trans_statistic_result_file, json.dumps(trans_result, indent=4))
                return 0
            elif step_check_result['err'] == "Tracing Failed": ### Case 2. Tracing Failed. Directly Load the Correct Translation.
                print("[INFO] Tracing Failed. Directly Load the Correct Translation from human")
                retry = RETRY_LIMIT + 1
                continue
            elif step_check_result['step'] > cur_step: ### Case 3. Move to the newest step (next step or future step).
                print(f"[INFO] Step Check Succeed on All History Steps.")
                new_step = updateStep(test_folder_name, step_check_result['step'])
                print(f"[INFO] Move from the current step {cur_step} to the new step {new_step}.")
                cur_step = new_step
                break
            else: ### Case 4. Failed on the history step. Refine the Spec.
                assert block_id not in human_fixed_blocks
                if RETRY_LIMIT == 1: ### If reach the retry limit, ask for human help.
                    retry = RETRY_LIMIT + 1
                    continue
                
                spec_file = TESTS_ROOT + test_folder_name + "/checkpoint_files/specifications.json"
                spec = json.loads(read_text(spec_file))
                if str(step_check_result['step']) in spec[block_id]:
                    
                    ### If the failed step already in the spec set, ask LLM to resynthesize the code fragment until satisfy the entire spec set.
                    print(f"[INFO] The translated code not satisfy the spec set of block {block_id} up to current step {cur_step}.")
                    print("[INFO] Step Fixing... Retry Count:", retry)
                    
                    ### Step Fix (LLM Resynthesis)
                    ret = stepFix(test_folder_name, block_id, spec[block_id])
                    assert ret == 0
                    
                    ### Patch the code blocks into the template.
                    ret = patchJsCode(test_folder_name)
                    assert ret == 0
                    retry += 1
                    
                else:
                    ### If the failed step not in the spec set, refine the spec set.
                    ### There are only finite many specs (steps) for one code fragment.
                    ### So the following part can only be executed finite many times for one block.
                    print(f"[INFO] Step Check Failed on the History Step {step_check_result['step']} which is not in the spec set of block {block_id}.")
                    print("[INFO] Refine the Spec.")
                    if from_step <= step_check_result['step'] < to_step:
                        assert block_id == step_trace_log[step_check_result['step'] % log_step]['from']
                        spec[block_id][step_check_result['step']] = combineSpec(step_trace_log, step_check_result['step'], log_step)
                    else:
                        history_from_step = step_check_result['step'] - step_check_result['step'] % log_step
                        history_to_step = step_check_result['step'] - step_check_result['step'] % log_step + log_step
                        history_step_trace_log = loadTraceLog(test_folder_name, history_from_step, history_to_step)
                        
                        assert block_id == history_step_trace_log[step_check_result['step'] % log_step]['from']
                        spec[block_id][step_check_result['step']] = combineSpec(history_step_trace_log, step_check_result['step'], log_step)
                        
                    write_text(spec_file, json.dumps(spec, indent=4))
                    retry = 0 ### Reset the retry count to 0.
    
    trans_result = {"total_step": total_step, "human_fixed_blocks": human_fixed_blocks}
    write_text(trans_statistic_result_file, json.dumps(trans_result, indent=4))
    if auto_fill:
        fillNotCoveredBlocks(test_folder_name)
    return 0


def parseOp(test_folder_name, op):
    if op in ["init", "I"]:
        return initTestCase(test_folder_name)
    if op in ["init_skip_trace", "ID"]:
        return initTestCase(test_folder_name, skip_trace=True)
    if op in ["refresh", "R"]:
        return refreshTransedCode(test_folder_name)
    elif op in ["step_trans", "T"]:
        return stepTransPrepare(test_folder_name)
    elif op in ["step_fix", "F"]:
        return stepFix(test_folder_name)
    elif op in ["fill_not_covered_blocks", "FILL"]:
        return fillNotCoveredBlocks(test_folder_name)
    elif op in ["step_check", "C"]:
        return stepCheck(test_folder_name)
    elif op in ["step_check_without_trace", "CC"]:
        return stepCheck(test_folder_name)
    elif op in ["patch", "P"]:
        return patchJsCode(test_folder_name)
    elif op in ["erase", "E"]:
        return eraseJsCode(test_folder_name)
    elif op in ["run_tracer_py", "TPY"]:
        return runTracerPy(test_folder_name)
    elif op in ["load_manually_fixed_code", "L"]:
        return load_manually_fixed_code(test_folder_name)
    elif op in ["save_correct_code_block", "SAVE"]:
        return saveCorrectCodeBlock(test_folder_name)
    elif op in ["auto", "A"]:
        return autoTrans(test_folder_name, True)
    elif op in ["auto_skip_non_cover", "AD"]:
        return autoTrans(test_folder_name)
    else:
        return "Invalid operation: " + op


if __name__ == "__main__":
    _SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    _REQUIRED_DIR = os.path.abspath(os.path.join(_SCRIPT_DIR, ".."))

    if os.getcwd() != _REQUIRED_DIR:
        print(f"Error: Script must be run in the root dir of this artifact, but it's running from {os.getcwd()}")
        sys.exit(1)  # Exit with an error

    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    if len(sys.argv) == 7:
        testcase_folder = sys.argv[1] ### Input folder
        print("[INFO] Testcase Folder:", testcase_folder)
        op = sys.argv[2] ### Operation
        if op not in ["I", "ID", "R", "A", "AD", "P", "L"]:
            print("[ERROR] Invalid operation. Please refer to the help info.", file=sys.stderr)
            exit(1)
        ENGINE = sys.argv[3] ### LLM engine
        if ENGINE not in ["gpt-4-turbo", "gpt-3.5-turbo"]:
            print("[ERROR] Invalid engine. Please refer to the help info.", file=sys.stderr)
            exit(1)
        
        if sys.argv[4] not in ["fast", "optimized"]:
            print("[ERROR] Invalid mode. Please refer to the help info.", file=sys.stderr)
            exit(1)
        FAST_MODE = True if sys.argv[4] == "fast" else False ### Fast mode or optimized mode
        
        RETRY_LIMIT = int(sys.argv[5]) ### If set this to 1, the human_fixed will be directly loaded when error occurs in code block.
        
        if sys.argv[6] not in ["True", "False"]:
            print("[ERROR] Invalid allow_spec. Please refer to the help info.", file=sys.stderr)
            exit(1)
        ALLOW_SPEC = True if sys.argv[6] == "True" else False ### If set to false, then I/O specification will not be provided during translation.
        
        if ALLOW_SPEC == False:
            assert RETRY_LIMIT == 1 ### If not allow spec, then the retry limit should be 1.
        
    else:
        help = sys.argv[1] ### Input folder
        if help == "--help":
            print("[INFO] Usage: python controller.py <testcase_folder> <op> <engine> <mode> <retry_limit> <allow_spec>", file=sys.stderr)
            print("       <testcase_folder>: The folder name of the test case.", file=sys.stderr)
            print("       <op>: The operation to be executed. Can be `I`, `ID`, `A`, `AD`, `R`, `P`, `L`.", file=sys.stderr)
            print("       <engine>: The LLM engine to be used. Can bee `gpt-4-turbo` and `gpt-3.5-turbo`.", file=sys.stderr)
            print("       <mode>: The mode to be used. Can be `fast` or `optimized`.", file=sys.stderr)
            print("       <retry_limit>: The retry limit for the step fix. Set to `3` in default.", file=sys.stderr)
            print("       <allow_spec>: If allow the I/O specification to be provided during translation. In general, just set it to `True`.", file=sys.stderr)
            print("       Example: python ./scripts/controller.py /test I gpt-4-turbo optimized 3 True", file=sys.stderr)
            exit(0)
        else:   
            ### Basically, the last two parameters are used for evaluation.
            print("[ERROR] Usage: python controller.py <testcase_folder> <op> <engine> <mode> <retry_limit> <allow_spec>", file=sys.stderr)
            print("[INFO] Usage: `python controller.py --help` to get help messages ", file=sys.stderr)
            exit(1)

    response = parseOp(testcase_folder, op)
    # print(response)
