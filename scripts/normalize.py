import os
import sys

if __name__ == "__main__":
    print("[INFO] Executing:", " ".join(sys.argv), file=sys.stderr)
    if len(sys.argv) < 2:
        source_path = "./benchmarks_new/test"
    else:
        source_path = sys.argv[1]

    normalize_instrument_path = "./scripts/normalize_instrument.py"
    normalize_rewrite_path = "./scripts/normalize_rewrite.py"

    ### Instrument
    command = f"timeout 600 python {normalize_instrument_path} {source_path}"
    ret = os.system(command)
    assert ret == 0

    ### Run the instrumented code
    print("[INFO] Analyzing the Source Code for Normalization Rewrite...", file=sys.stderr)
    command = f"timeout 1200 python {source_path}/source_inst.py 1>{source_path}/traces_all/trace_stdout.log 2>{source_path}/traces_all/trace_stderr.log"
    ret = os.system(command)
    assert ret == 0 ### Assume the orginal source code end with no error.

    os.remove(f"{source_path}/source_inst.py")

    ### Rewrite
    print("[INFO] Rewriting the Source Code...", file=sys.stderr)
    command = f"timeout 600 python {normalize_rewrite_path} {source_path}"
    ret = os.system(command)
    assert ret == 0

    ### Check if the rewritten code is correct
    print("[INFO] Rewriting Finished. Checking the Normalized Code...", file=sys.stderr)
    command = f"timeout 1200 python {source_path}/source_normalized.py 1>{source_path}/traces_all/trace_stdout.log 2>{source_path}/traces_all/trace_stderr.log"
    ret = os.system(command)
    assert ret == 0
    print("[INFO] Checking Finished.", file=sys.stderr)
    # print("Success")
