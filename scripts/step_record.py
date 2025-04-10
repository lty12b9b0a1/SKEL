import os
import sys
import json

if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    if len(sys.argv) == 3:
        folder = sys.argv[1]
        mode = sys.argv[2]
    else:
        print("[ERROR] Invalid Arguments.", file=sys.stderr)
        exit(1)
    
    step_record_instrument_path = "./scripts/step_record_instrument.py"
    
    ### Instrument
    command = f"timeout 600 python {step_record_instrument_path} {folder} {mode}"
    ret = os.system(command)
    assert ret == 0
    
    ### mkdir for the trace files
    trace_folder = folder + '/traces_all'
    os.makedirs(trace_folder, exist_ok=True)
    
    ### Run the instrumented code. This can be quite slow.
    print("[INFO] Tracing the Source Code... This may take tens of minutes (depends on the device).", file=sys.stderr)
    command = f"timeout 36000 python {folder}/source_normalized_inst.py 1>{folder}/traces_all/trace_stdout.log 2>{folder}/traces_all/trace_stderr.log"
    ret = os.system(command)
    assert ret == 0
    os.remove(f"{folder}/source_normalized_inst.py")
    print("[INFO] Tracing Done.", file=sys.stderr)
    