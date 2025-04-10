import os
import sys
import json

def write_text(filename, content):
    with open(filename, 'w') as f: f.write(content)

if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    if len(sys.argv) == 3:
        folder = sys.argv[1]
        mode = sys.argv[2]
    else:
        print("[ERROR] Invalid Arguments.", file=sys.stderr)
        exit(1)
    
    step_check_instrument_path = "./scripts/step_check_instrument.py"
    
    ### Instrument
    command = f"timeout 600 python {step_check_instrument_path} {folder} {mode}"
    ret = os.system(command)
    assert ret == 0
    
    ### mkdir for the trace files
    trace_folder = folder + '/traces_all'
    os.makedirs(trace_folder, exist_ok=True)
    
    ### Run the instrumented code. This can be quite slow.
    print("[INFO] Tracing the Transed Code... This may take tens of minutes (depends on the device).", file=sys.stderr)
    command = f"NODE_PATH=/usr/lib/node_modules timeout 36000 node {folder}/transed_inst.js 1>{folder}/traces_all/trace_stdout.log 2>{folder}/traces_all/trace_stderr.log" ### During running the transed code, it's possible end with error.
    ret = os.system(command)
    os.remove(folder + '/transed_inst.js')
    if ret != 0:
        step_check_result_path = trace_folder + "/_step_check_result.json"
        write_text(step_check_result_path, json.dumps({"err": "Tracing Failed"})) ### If tracing failed, directly load the correct translation.
        print("[INFO] Tracing Failed. Check the logs.", ret, file=sys.stderr)
    else:    
        print("[INFO] Tracing Done.", file=sys.stderr)
    