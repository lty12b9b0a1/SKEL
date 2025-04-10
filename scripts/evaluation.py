import sys
import os
import json
import time
from utils.query_llm_cached import turbo_chat_completion

SCRIPT_DIR = os.path.abspath(os.path.dirname(os.path.realpath(__file__)))
REL = lambda *x: os.path.abspath(os.path.join(SCRIPT_DIR, *x))
TESTS_ROOT = REL("../benchmarks_new")
SCRIPTS_ROOT = REL("../scripts")
EVAL_RESULT_ROOT = REL("../eval_results")

def read_text(filename):
  with open(filename, 'r') as f: return f.read()

def write_text(filename, content):
  with open(filename, 'w') as f: f.write(content)

def append_text(filename, content):
  with open(filename, 'a') as f: f.write(content)

Baseline_Trans_Prompt = """You are a helpful assistant who translates Python code into JavaScript code. You should translate according to the following instructions:
- You should output the code directly without explanations and always in the same format.
- You should ALWAYS output best-effort translation, even if you are provided partial code, modules, or code with dependencies.
- You should keep the naming style unchanged for the function names and variables.
"""

Baseline_Input_Example = """
### The Python code to translate
```python
    i = ans = 0
    chars = set()
    for j, c in enumerate(s):
        while c in chars:
            chars.remove(s[i])
            i += 1
        chars.add(c)
        ans = max(ans, j - i + 1)
    _return_value = ans
    return _return_value
```

### The translated JavaScript code
"""

Baseline_Output_Example = """
```javascript
    i = 0;
    ans = 0;
    chars = new Set();
    for (var j = 0; j < s.length; j++) {
        c = s[j];
        while (chars.has(c)) {
            chars.delete(s[i]);
            i++;
        }
        chars.add(c);
        ans = Math.max(ans, j - i + 1);
    }
    j--;
    var _return_value = ans;
    return _return_value;
```
"""

def auto_retry_query(system, chat_history, user, engine="gpt-4-turbo"):
    try:
        res = turbo_chat_completion(system=system, chat_history=chat_history, user=user, engine=engine)
        if "error_msg" in res:
            raise Exception(res["error_msg"])
        return res

    except Exception as e:
        raise Exception(f"Error in auto_retry_query: {e}")
    
def trans(code, engine = "gpt-4-turbo"):
    system = Baseline_Trans_Prompt
    his_msg = [(Baseline_Input_Example, Baseline_Output_Example)]
    res_comment = "### The Python code to translate:\n"
    res_comment += "```python\n"
    res_comment += code + "\n"
    res_comment += "```\n"
    res_comment += "### The translated JavaScript code:\n"
    
    user = res_comment

    if 0:
        print(json.dumps(system))
        print("-------------------")
        print(json.dumps(his_msg))
        print("-------------------")
        print(json.dumps(user))
        exit()

    results = auto_retry_query(system=system, chat_history=his_msg, user=user, engine=engine)
    req_and_tar_code = results['completion']

    if req_and_tar_code.find("```javascript") >= 0:
        req_and_tar_code = req_and_tar_code[req_and_tar_code.find("```javascript") + len("```javascript"):]
        req_and_tar_code = req_and_tar_code[:-3]
    if req_and_tar_code[0] == "\n":
        req_and_tar_code = req_and_tar_code[1:]
    if req_and_tar_code[-1] == "\n":
        req_and_tar_code = req_and_tar_code[:-1]
        
    return req_and_tar_code

def trans_baseline(benchmark, engine):
    
    benchmark = "./evaluation_for_comparators/baseline_gpt4" + benchmark
    code = read_text(benchmark + "/source.py")
    transed_code = ""
    tmp_code = ""
    for line in code.split("\n"):
        if line.startswith("def ") or line.startswith("class "):
            print("[INFO] Translating Function: ", line)
            transed_code += trans(tmp_code, engine) + "\n"
            tmp_code = ""
        
        tmp_code += line + "\n"
    transed_code += trans(tmp_code, engine)

    write_text(benchmark + "/baseline_translated.js", transed_code)

def value_2_percentage_str(x, y):
    return str(round(x/y*100)) + '%'

def eval_runner(engine, retry_limit, allow_spec, benchmarks, eval_name):
    controller_path = SCRIPTS_ROOT + "/controller.py"

    for benchmark in benchmarks:
        if benchmark == "/py_evtx": ### Use fast mode for py_evtx
            continue
        
        test_folder = TESTS_ROOT + benchmark
        print(f"[INFO] Now Translating Benchmark: {benchmark}")
        ### Init the benchmark. This includes normalizing and tracing the source code.
        command = f"timeout 3600 python {controller_path} {benchmark} I {engine} optimized {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0
        
        # exit()
        
        ### Start the translation
        command = f"timeout 36000 python {controller_path} {benchmark} A {engine} optimized {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0
        
        ### Load Trans Results
        trans_result_file = test_folder + "/result.json"
        trans_result = json.loads(read_text(trans_result_file))
        total_frag, total_class = collect_block_numbers(benchmark)
        result_msg = {
            "_DEBUG_normalized": total_frag + total_class,
            "Total_fragments": total_frag,       
            "User_fixed_blocks": len(trans_result['human_fixed_blocks']),
            "Automation Ratio": value_2_percentage_str((total_frag - len(trans_result['human_fixed_blocks'])), total_frag),
        }

        print("[INFO] ########################################")
        print(f"[INFO] Finish Benchmark: {benchmark}")
        print(f"[INFO] Result: {result_msg}")
        print("[INFO] ########################################")

        msg = f"Evaluation Name: {eval_name}\n"
        msg += f"Finish Benchmark: {benchmark}\n"
        msg += f"Result: {result_msg}\n"
        msg += f"Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}\n"
        msg += f"########################################\n"
        append_text(f"./evaluation.log", msg)

        results = json.loads(read_text(EVAL_RESULT_ROOT + f"/{eval_name}-result.json"))
        results[benchmark] = result_msg
        del results["total"]
        results["total"] = {
            "_DEBUG_normalized_total": sum([results[i]["_DEBUG_normalized"] for i in results]),
            "Total_fragments": sum([results[i]["Total_fragments"] for i in results]),
            "User_fixed_blocks": sum([results[i]["User_fixed_blocks"] for i in results]),
        }
        results["total"]["Automation Ratio"] = value_2_percentage_str(
            (results["total"]["Total_fragments"] - results["total"]["User_fixed_blocks"]),
            results["total"]["Total_fragments"])
        write_text(EVAL_RESULT_ROOT + f"/{eval_name}-result.json", json.dumps(results, indent=4))

    if "/py_evtx" in benchmarks:
        ##### py_evtx
        # py_evtx is a large program with several test casese, and some of them takes a long time to trace and translate.
        # We split the unit tests into three parts: py_evtx_1, py_evtx_2, and py_evtx_3, and apply "fast mode".
        
        py_evtx_total = 0

        # ##### py_evtx_1
        benchmark = "/py_evtx_1"
        test_folder = TESTS_ROOT + benchmark
        # Init the benchmark without tracing the source code again since it takse several hours. The trace file is provided.
        command = f"timeout 3600 python {controller_path} {benchmark} ID {engine} fast {retry_limit} {allow_spec}" 
        ret = os.system(command)
        assert ret == 0
        
        # Refresh the template for translated code.
        command = f"timeout 3600 python {controller_path} {benchmark} R {engine} fast {retry_limit} {allow_spec}" 
        ret = os.system(command)
        assert ret == 0
        
        # Start the translation
        command = f"timeout 36000 python {controller_path} {benchmark} AD {engine} fast {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0

        trans_result_file = test_folder + "/result.json"
        trans_result = json.loads(read_text(trans_result_file))
        py_evtx_total += len(trans_result['human_fixed_blocks'])

        msg = f"Evaluation Name: {eval_name}\n"
        msg += f"Finish Benchmark: {benchmark}\n"
        msg += f"Result (Partial): {trans_result}\n"
        msg += f"Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}\n"
        msg += f"########################################\n"
        append_text(f"./evaluation.log", msg)

        ### py_evtx_2
        # First move the transed code blocks in py_evtx part 1 to the py_evtx_2 folder.
        py_evtx_1_transed_code_blocks_file = test_folder + "/checkpoint_files/transed_codeblocks.json"
        py_evtx_1_control_file = test_folder + "/checkpoint_files/control.json"
        py_evtx_1_transed_code_blocks = json.loads(read_text(py_evtx_1_transed_code_blocks_file))
        py_evtx_1_control = json.loads(read_text(py_evtx_1_control_file))
        
        # During this time, erase the translation for code block (block_368) which contain the test suits that launch the entire program.
        # The translator will synthezie the new translation for this block, wich will launch the corresponding test case for part 2 of py_evtx.
        test_block_id = 368
        py_evtx_1_control["is_transed"][str(test_block_id)] = False # set is_transed to false.
        py_evtx_1_control["cur_step"] = 1 # reset the step to 1 which is the beginning of the program.
        
        benchmark = "/py_evtx_2" # update to py_evtx_2
        test_folder = TESTS_ROOT + benchmark # update to py_evtx_2

        # Init the benchmark without tracing the source code again since it takse several hours. The trace file is provided.
        command = f"timeout 3600 python {controller_path} {benchmark} ID {engine} fast {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0
        
        # Copy from py_evtx_1
        transed_code_blocks_file = test_folder + "/checkpoint_files/transed_codeblocks.json"
        control_file = test_folder + "/checkpoint_files/control.json"
        write_text(transed_code_blocks_file, json.dumps(py_evtx_1_transed_code_blocks))
        write_text(control_file, json.dumps(py_evtx_1_control))

        # Patch the code blocks to the py_evtx_2
        command = f"timeout 3600 python {controller_path} {benchmark} P {engine} fast {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0

        # Start the translation
        command = f"timeout 36000 python {controller_path} {benchmark} AD {engine} fast {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0
        
        trans_result_file = test_folder + "/result.json"
        trans_result = json.loads(read_text(trans_result_file))
        py_evtx_total += len(trans_result['human_fixed_blocks'])

        msg = f"Evaluation Name: {eval_name}\n"
        msg += f"Finish Benchmark: {benchmark}\n"
        msg += f"Result (Partial): {trans_result}\n"
        msg += f"Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}\n"
        msg += f"########################################\n"
        append_text(f"./evaluation.log", msg)
            
        ### py_evtx_3 (the same with py_evtx_2)
        # First move the transed code blocks in py_evtx part 1 to the py_evtx_2 folder.
        py_evtx_2_transed_code_blocks_file = test_folder + "/checkpoint_files/transed_codeblocks.json"
        py_evtx_2_control_file = test_folder + "/checkpoint_files/control.json"
        py_evtx_2_transed_code_blocks = json.loads(read_text(py_evtx_2_transed_code_blocks_file))
        py_evtx_2_control = json.loads(read_text(py_evtx_2_control_file))
        
        # During this time, erase the translation for code block (block_368) which contain the test suits that launch the entire program.
        # The translator will synthezie the new translation for this block, wich will launch the corresponding test case for part 2 of py_evtx.
        test_block_id = 368
        py_evtx_2_control["is_transed"][str(test_block_id)] = False # set is_transed to false.
        py_evtx_2_control["cur_step"] = 1 # reset the step to 1 which is the beginning of the program.
        
        benchmark = "/py_evtx_3" # update to py_evtx_3
        test_folder = TESTS_ROOT + benchmark # update to py_evtx_2
        
        # Init the benchmark without tracing the source code again since it takse several hours. The trace file is provided.
        command = f"timeout 3600 python {controller_path} {benchmark} ID {engine} fast {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0

        # Copy from py_evtx_2
        transed_code_blocks_file = test_folder + "/checkpoint_files/transed_codeblocks.json"
        control_file = test_folder + "/checkpoint_files/control.json"
        write_text(transed_code_blocks_file, json.dumps(py_evtx_2_transed_code_blocks))
        write_text(control_file, json.dumps(py_evtx_2_control))

        # Patch the code blocks to the py_evtx_3
        command = f"timeout 3600 python {controller_path} {benchmark} P {engine} fast {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0
        
        # Start the translation
        command = f"timeout 36000 python {controller_path} {benchmark} A {engine} fast {retry_limit} {allow_spec}"
        ret = os.system(command)
        assert ret == 0

        trans_result_file = test_folder + "/result.json"
        trans_result = json.loads(read_text(trans_result_file))
        py_evtx_total += len(trans_result['human_fixed_blocks'])

        results = json.loads(read_text(EVAL_RESULT_ROOT + f"/{eval_name}-result.json"))
        total_frag, total_class = collect_block_numbers(benchmark)
        result_msg = {
            "_DEBUG_normalized": total_frag + total_class,
            "Total_fragments": total_frag,
            "User_fixed_blocks": py_evtx_total,
            "Automation Ratio": value_2_percentage_str((total_frag - py_evtx_total), total_frag),
        }

        msg = f"Evaluation Name: {eval_name}\n"
        msg += f"Finish Benchmark: py_evtx\n"
        msg += f"Result: {result_msg}\n"
        msg += f"Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}\n"
        msg += f"########################################\n"
        append_text(f"./evaluation.log", msg)

        results["py_evtx"] = result_msg
        del results["total"]
        results["total"] = {
            "_DEBUG_normalized_total": sum([results[i]["_DEBUG_normalized"] for i in results]),
            "Total_fragments": sum([results[i]["Total_fragments"] for i in results]),
            "User_fixed_blocks": sum([results[i]["User_fixed_blocks"] for i in results]),
        }
        results["total"]["Automation Ratio"] = value_2_percentage_str(
            (results["total"]["Total_fragments"] - results["total"]["User_fixed_blocks"]),
            results["total"]["Total_fragments"])
        write_text(EVAL_RESULT_ROOT + f"/{eval_name}-result.json", json.dumps(results, indent=4))
    
    ### The result will be saved in "./result.json" in the folder of each benchmark.


def get_class_number(code):
    return code.count("class ") + code.count("def ")

def collect_block_numbers(benchmark):
    if benchmark == "/py_evtx":
        benchmark = "/py_evtx_3" ### py_evtx_3 is the last part of py_evtx. It contains all the covered fragments
    test_folder = TESTS_ROOT + benchmark

    ### obtain all the file names under /test_fragments folder
    files = os.listdir(test_folder + "/test_fragments")
    test_fragments = set()
    for file in files:
        test_fragments.add(file.split(".")[0].split("_")[-1]) ### get the block id

    result_file = test_folder + "/checkpoint_files/control.json"
    if not os.path.exists(result_file):
        raise Exception(f"[ERROR] Please run at least one translation for the benchmark: {benchmark}")
    result = json.loads(read_text(result_file))

    covered_blocks = set()
    for i in result['is_transed']:
        if i not in test_fragments:
            if result['is_transed'][i]:
                covered_blocks.add(i)
    
    covered_classes = 0
    class_to_block_file = test_folder + "/stage1_output/class_name_to_block_id.json"
    class_to_block = json.loads(read_text(class_to_block_file))
    for class_name in class_to_block:
        for block_id in class_to_block[class_name]:
            if str(block_id) in covered_blocks:
                covered_classes += 1
                break
            

    return len(covered_blocks), covered_classes
    # results["total"] = total
    # write_text(EVAL_RESULT_ROOT + "/block_numbers.json", json.dumps(results, indent=4))


def overallEffectivenessGPT4(benchmarks):
    engine = "gpt-4-turbo"
    retry_limit = 3
    allow_spec = True
    if not os.path.exists(EVAL_RESULT_ROOT + "/SKEL-GPT4-result.json"):
        write_text(EVAL_RESULT_ROOT + "/SKEL-GPT4-result.json", json.dumps({"total": 0}, indent=4))
    eval_runner(engine, retry_limit, allow_spec, benchmarks, "SKEL-GPT4")
    # collect_SKEL_results("SKEL-GPT4")

def overallEffectivenessGPT35(benchmarks):
    engine = "gpt-3.5-turbo"
    retry_limit = 3
    allow_spec = True
    if not os.path.exists(EVAL_RESULT_ROOT + "/SKEL-GPT35-result.json"):
        write_text(EVAL_RESULT_ROOT + "/SKEL-GPT35-result.json", json.dumps({"total": 0}, indent=4))
    eval_runner(engine, retry_limit, allow_spec, benchmarks, "SKEL-GPT35")
    # collect_SKEL_results("SKEL-GPT35")

def ablationStudyBase(benchmarks):
    engine = "gpt-4-turbo"
    retry_limit = 1 ### No fix
    allow_spec = False ### No spec
    if not os.path.exists(EVAL_RESULT_ROOT + "/AblationBase-GPT4-result.json"):
        write_text(EVAL_RESULT_ROOT + "/AblationBase-GPT4-result.json", json.dumps({"total": 0}, indent=4))
    eval_runner(engine, retry_limit, allow_spec, benchmarks, "AblationBase-GPT4")
    # collect_SKEL_results("AblationBase-GPT4")

def ablationStudySpec(benchmarks):
    engine = "gpt-4-turbo"
    retry_limit = 1 ### No fix
    allow_spec = True ### Allow one spec
    if not os.path.exists(EVAL_RESULT_ROOT + "/AblationSpec-GPT4-result.json"):
        write_text(EVAL_RESULT_ROOT + "/AblationSpec-GPT4-result.json", json.dumps({"total": 0}, indent=4))
    eval_runner(engine, retry_limit, allow_spec, benchmarks, "AblationSpec-GPT4")
    # collect_SKEL_results("AblationSpec-GPT4")

def runTransBaseline(benchmarks):
    engine = "gpt-4-turbo"

    for benchmark in benchmarks:
        print(f"[INFO] Now Translating Benchmark: {benchmark}")
        trans_baseline(benchmark, engine)
        print(f"[INFO] Finish Translating Benchmark: {benchmark}")

def clean():
    benchmarks = [
        "/colorsys",
        "/heapq",
        "/html",
        "/mathgen",
        "/strsim",
        "/bst",
        "/rbt",
        "/toml",
        "/py_evtx_1",
        "/py_evtx_2",
        "/py_evtx_3",
        "/playground"
    ]
    for benchmark in benchmarks:
        test_folder = TESTS_ROOT + benchmark
        files = [
            "/result.json",
            "/translated.js",
            "/trans_info.json",
            "/source_normalized.py",
            "/source_normalized_inst.py",
            "/traces_all/trace_stdout.log",
            "/traces_all/trace_stderr.log",
            "/traces_all/_step_check_result.json",
            "baseline_translated.js",
            "baseline_translated_human_fixed.js",
        ]
        folder = [
            "/checkpoint_files/",
            "/stage1_output/",
            "/__pycache__/",
        ]

        if benchmark not in ["/py_evtx_1", "/py_evtx_2", "/py_evtx_3"]:
            # print(f"[INFO] Clean Benchmark: {benchmark}")
            folder_path = test_folder + "/traces_all/"
            if os.path.exists(folder_path):
                for file in os.listdir(folder_path):
                    os.remove(folder_path + file)
                os.rmdir(folder_path)

        
        for file in files:
            file_path = test_folder + "/" + file
            if os.path.exists(file_path):
                os.remove(file_path)
        
        for f in folder:
            folder_path = test_folder + f
            if os.path.exists(folder_path):
                for file in os.listdir(folder_path):
                    os.remove(folder_path + file)
                os.rmdir(folder_path)
    
    benchmarks = ["/colorsys","/heapq","/html","/mathgen","/strsim","/bst","/rbt","/toml","/py_evtx"]

    for benchmark in benchmarks:
        test_folder = "./evaluation_for_comparators/baseline_gpt4" + benchmark
        files = [
            "baseline_translated.js",
        ]
        for file in files:
            file_path = test_folder + "/" + file
            if os.path.exists(file_path):
                os.remove(file_path)
        
    return

def collect_coverage():
    print("[INFO] Collecting Coverage")
    benchmarks = ["/colorsys","/heapq","/html","/mathgen","/strsim","/bst","/rbt","/toml","/py_evtx"]
    results = {}
    for benchmark in benchmarks:

        print(f"[INFO] Collecting Coverage for Benchmark: {benchmark}")

        test_folder = TESTS_ROOT + benchmark
        if benchmark == "/py_evtx":
            test_folder = TESTS_ROOT + "/py_evtx_orginal"

        command = f"timeout 3600 coverage run {test_folder}/source.py 1>/dev/null 2>/dev/null"
        ret = os.system(command)
        assert ret == 0

        command = f"timeout 3600 coverage report 1>{test_folder}/coverage_report.txt 2>/dev/null"
        ret = os.system(command)
        assert ret == 0

        coverage_report = read_text(test_folder + "/coverage_report.txt")
        file_coverages = coverage_report.split("\n")[2:-3]
        total_stmts = 0
        total_miss = 0
        for file_coverage in file_coverages:
            file_name, stmts, miss, over_rate = file_coverage.split()
            if file_name.endswith("source.py") or file_name.endswith("tracer_skip.py"):
                total_stmts += int(stmts)
                total_miss += int(miss)
        
        results[benchmark[1:]] = value_2_percentage_str(total_stmts - total_miss, total_stmts)
        os.remove(test_folder + "/coverage_report.txt")

    os.remove(".coverage")
    write_text(EVAL_RESULT_ROOT + "/Coverage.json", json.dumps(results, indent=4))


def collect_block_numbers_all():
    benchmarks = [
        "/colorsys",
        "/heapq",
        "/html",
        "/mathgen",
        "/strsim",
        "/bst",
        "/rbt",
        "/toml",
        "/py_evtx"
    ]
    results = {}
    total = 0
    for benchmark in benchmarks:
        if benchmark == "/py_evtx":
            benchmark = "/py_evtx_3"
        

        test_folder = TESTS_ROOT + benchmark
        ### obtain all the file names under /human_provided folder
        files = os.listdir(test_folder + "/test_fragments")
        human_provided = set()
        for file in files:
            human_provided.add(file.split(".")[0].split("_")[-1]) ### get the block id
        result_file = test_folder + "/checkpoint_files/control.json"
        result = json.loads(read_text(result_file))
        covered_blocks = set()
        for i in result['is_transed']:
            if i not in human_provided:
                if result['is_transed'][i]:
                    covered_blocks.add(i)
            else:
                break
        

        covered_classes = 0
        class_to_block_file = test_folder + "/stage1_output/class_name_to_block_id.json"
        class_to_block = json.loads(read_text(class_to_block_file))
        for class_name in class_to_block:
            # covered_members = 0
            for block_id in class_to_block[class_name]:
                if str(block_id) in covered_blocks:
                    # covered_members += 1
                    # if covered_members >= 2: ### One more member function besides init
                    covered_classes += 1
                    break
              
        results[benchmark[1:]] = len(covered_blocks) + covered_classes
        
        total += results[benchmark[1:]]
    
    results["total"] = total
    write_text(EVAL_RESULT_ROOT + "/block_numbers.json", json.dumps(results, indent=4))


if __name__ == "__main__":
    
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    REQUIRED_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

    if os.getcwd() != REQUIRED_DIR:
        print(f"[EEEOR] Script must be run in the root dir of this artifact, but it's running from {os.getcwd()}")
        sys.exit(1)  # Exit with an error
    
    if len(sys.argv) != 2:
        print("[ERROR] Usage: python evaluation.py <evaluation_name>")
        print("[INFO] Please choose <evaluation_name> from: SKEL-GPT4, SKEL-GPT35, AblationBase, AblationSpec, Baseline, Coverage, Clean")
        sys.exit(1)
    
    evaluation_name = sys.argv[1]
    if evaluation_name not in ["SKEL-GPT4", "SKEL-GPT35", "AblationBase", "AblationSpec", "Baseline", "Clean", "Coverage", "--help"]:
        print("[ERROR] Invalid evaluation name. Please choose from: SKEL-GPT4, SKEL-GPT35, AblationBase, AblationSpec, Baseline, Coverage, Clean")
        sys.exit(1)

    if evaluation_name == "--help":
        print("[INFO] Usage: python evaluation.py <evaluation_name>")
        print("[INFO] Please choose <evaluation_name> from: SKEL-GPT4, SKEL-GPT35, AblationBase, AblationSpec, Baseline, Coverage, Clean")


    ### Uncomment the following to run the corresponding evaluation for our method.
    ### Note that it will take a long time to run all the 4 evaluations (3-5 hours on our device with Intel core i7-12700k).
    ### You don't need to have LLM keys. All the LLM queries is cached. Please downlaod them.
    ### The results are saved in the "./eval_results/" folder in the main dir.
    ### The number that follows the name of the benchmarks reflects the total number of human fix needed during the entire translation.
    
    ### The benchmarks that participate in the evaluation.
    benchmarks = [
        "/colorsys",
        "/heapq",
        "/html",
        "/mathgen",
        "/strsim",
        "/bst",
        "/rbt",
        "/toml",
        "/py_evtx" ### Use Fast Mode
    ]

    if evaluation_name in ["SKEL-GPT4", "SKEL-GPT35", "AblationBase", "AblationSpec"]:
        if "/py_evtx" in benchmarks:
            if not (os.path.exists(TESTS_ROOT + "/py_evtx_1/traces_all/_step_trace_info.json")
                    and os.path.exists(TESTS_ROOT + "/py_evtx_2/traces_all/_step_trace_info.json")
                    and os.path.exists(TESTS_ROOT + "/py_evtx_3/traces_all/_step_trace_info.json")):
                print("[ERROR] Trace log files for py_evtx not found!")
                print("[INFO] Please download the trace log for py_evtx first. Please refer to the Step 6 in the INSTALL.md")
                sys.exit(1)
        if not os.path.exists(EVAL_RESULT_ROOT):
            os.mkdir(EVAL_RESULT_ROOT)
        if not os.path.exists("./evaluation.log"):
            write_text("./evaluation.log", "")

    if evaluation_name == "SKEL-GPT4":
        overallEffectivenessGPT4(benchmarks)
    
    if evaluation_name == "SKEL-GPT35":
        overallEffectivenessGPT35(benchmarks)
    
    if evaluation_name == "AblationBase":
        ablationStudyBase(benchmarks)
    
    if evaluation_name == "AblationSpec":
        ablationStudySpec(benchmarks)

    ### The result of baseline will be saved in "baseline_translated.js" under the folder of each benchmark.
    ### The "baseline_translated_human_fixed.js" is code fixed by us. To compare, use IDE like VSCode to compare the differences between two files.
    if evaluation_name == "Baseline":
        runTransBaseline(benchmarks)

    if evaluation_name == "Coverage":
        collect_coverage()

    ### Clean the files generated during the evaluation.
    if evaluation_name == "Clean":
        clean()
    
