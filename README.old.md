The repository includes the implementation and evaluation script of the paper "XXX."
This readme file contains four part. The first part is the environment setup. The second part is the evaluation section. The third part is for how to use Skel for real translation. The last part explain the code more detailed.

## 0 Environment

Install the environment. The environment for running the experiments and running the tool is the same:

- Python 3.10.12
  - tree-sitter 0.23.2
  - tree-sitter-javascript 0.23.1
  - tree-sitter-python 0.23.4
  - Transcrypt 3.9.1
  - OpenAI 1.7.2
  - tiktoken 0.5.2

- Nodejs v16.20.2
  - crc-32 1.2.2
  - numjs 0.16.1

## 1 Evaluation

Run the motivating example:
 ```
 python ./scripts/controller.py /motivating_example I gpt-4-turbo optimized 3 True
 python ./scripts/controller.py /motivating_example A gpt-4-turbo optimized 3 True
 ```


### 1.1 Evaluation Structure

There are **3** experiments in total in the evaluation section of the paper (the order is not the same as the paper):

- Overall effectiveness of skate with GPT-4/GPT-3.5. This experiment shows the overall performance of our tool, which is equipped with two LLM engines. This includes two sub-experiments:

  1. **EVAL 1**. The performance of skate with GPT-4

  2. **EVAL 2**. The performance of skate with GPT-3.5

- Ablation study. This experiment shows how much each component contributes to the final performance of our tool. This includes two sub-experiments:

  3. **EVAL 3**. The performance of skate base (without fix and I/O examples) with GPT-4

  4. **EVAL 4**. The performance of skate spec (with only one I/O example) with GPT-4

- Compare with two comparators: baseline and Transcrypt. This experiment shows the advantages of our tool compared with the traditional way of using LLM for translating long programs and another compiler-like translator. This includes two sub-experiments:

  5. **EVAL 5**. The performance of baseline

  6. **EVAL 6**. The performance of Transcrypt 

Thus, in total, there will be **6** sub-experiments. We will go through them one by one.

### 1.2 Special Notes

Before going into details for each experiment, there are some special notes.

- For evaluation, to allow reproducibility, we cached all the queries to online GPT models for our benchmark programs, thus all queries will hit our cache and no OpenAI keys or online payment is needed to reproduce our experiments. However, note that if you modify the input prompts to the LLMs, it will change the queries and miss the cache. Please download the cache from [here](https://drive.google.com/drive/folders/1dJnQ1L5xGt26ty5V3OeNDGXRwetINNi2?usp=sharing). Please open this link and download the `llm_cache.zip` file. Then, put this file in the root node of this repository, and unzip it. You will get a folder named `./_cacheV1-chatgptcomp/`. You can also unzip it somewhere else and then move it to the root node. Just make sure that the folder `./_cacheV1-chatgptcomp/` is in the root dir. This is necessary for the evaluation.

- For our method, the correctness guarantee of the translation is based on the equivalence of the traced behavior between the input source Python code and the translated JavaScript code. There are 9 benchmark programs in total in the experiments. The trace log will be regenerated each time for each experiment for 8 of them. For one benchmark program, "py_evtx", it costs too much time to trace it once. We split the **unit test** of this program into 3 sub-sections: "py_evtx_1", "py_evtx_2", "py_evtx_3" (we do not split the program itself. Instead, we only split the unit test into three part, in other words, the orginal execution is split into three part and check seperately. This will reduce the tracing time but keep the correctness of the overall translation). Each section only launches a part of unit test, and thus, the trace time for each section becomes shorter. For all three sections of "py_evtx", we directly provide the trace log instead of regenerating each time for each experiment. Please download the prepared trace logs from [here](https://drive.google.com/drive/folders/1dJnQ1L5xGt26ty5V3OeNDGXRwetINNi2?usp=sharing). Please open the link and download `py_evtx_1_trace_log.zip`, `py_evtx_2_trace_log.zip`, and `py_evtx_3_trace_log.zip`. Then, put them under the root dir of this repository and unzip the files. You will get folders named `./benchmarks_new/py_evtx_1/traces_all/`, `./benchmarks_new/py_evtx_2/traces_all/`, and `./benchmarks_new/py_evtx_3/traces_all/`. You can also unzip somewhere else and then move it to the corresponding folder. Just make sure that the folder `traces_all/` is put in the dir of the corresponding benchmark program. This is necessary for the evaluation.
### 1.3 The Input And the Output
Note: Everything is already prepared by us. This chapter just gives you a brief introduction to the input and the output of each benchmark program.
#### For EVAL1 - EVAL4:

The inputs are the same for **EVAL1** - **EVAL4** sub-experiments, including the following:

- `./benchmarks_new/benchmark_name/source.py`: This is the source Python program. It is the merged and refactored (mentioned in the paper) version of the original code base. We also removed some language features that are not supported by our tool (will be explained more carefully in `How to use for translation` and the `./not_support.txt` in the folder of each benchmark program).
- `./benchmarks_new/benchmark_name/not_support.txt`: This file lists all the language features that are not supported by our tool and all the corresponding modifications of the source program.
- `./benchmarks_new/benchmark_name/ignore.py`: This file includes all the codes that do not participate in the automatic translation process. They will not be counted for accuracy. Why have this? Three cases:
  1. The code is used to get the input for the unit test. They do not related to the main logic of the program.
  2. Some big constant lists, dicts can be directly copy-pasted from Py side to JS side, but cause trouble for LLMs.
  3. The shims mentioned in the paper. We implement the shim for `random`.
- `./benchmarks_new/benchmark_name/ignore.js`: If the source code has `ignore.py`, then it will have this corresponding `ignore.js` file which includes the translated version of the ignored code on the Python side. The translated JS code will call these ignored functions.
- `./benchmarks_new/benchmark_name/ignore_head.js`: If the source code has `ignore.py`, then there will also be a `ignore_head.js` file which will be attached at the beginning of the translated JS code. This file includes the import statements of the ignored code.
- `./benchmarks_new/benchmark_name/human_provided/`: This folder includes all translated fragments provided by humans. This includes all the code fragments that belong to the unit test. As mentioned in the paper, they will NOT be counted for the accuracy and total number of code fragments.
- `./benchmarks_new/benchmark_name/correct_transed_codeblocks.json`: This file is provided by humans. It records all the correct translations of the code fragments. When LLMs cannot correctly translate a fragment (failed on specifications), the tool will find the correct translation from this JSON file. During this time, the block id of that fragment will be recorded and shown in the `result.json` file after the translation of this benchmark program. This is necessary for evaluation to go on. Basically, this means humans assist and fix the code fragment.

The outputs are the same for **EVAL1** - **EVAL4** sub-experiments, including the following:

- `./benchmarks_new/benchmark_name/transed.js`: This is the translated JavaScript program.
- `./benchmarks_new/benchmark_name/result.json`: This file records the block_id for those code fragments that LLM cannot translate correctly (pass all the specifications in a limited number of retries), and thus, a totally correct translated fragment is applied. The number of the block_id appeared in this JSON file is the number **user_fix** in the paper for each benchmark program.

#### For EVAL5:

The input for **EVAL5** (the performance of baseline approach) sub-experiments is almost the same as **EVAL1** - **EVAL4**. The only difference is that now there are no `human_provided/` folder and  `correct_transed_codeblocks.json` file. But instead, we provide the fixed version of the translated code from baseline approach by humans, put in `./benchmarks_new/benchmark_name/baseline_transed_human_fixed.js` file.

The output of the **EVAL5** is `./benchmarks_new/benchmark_name/baseline_transed.js`, which is the translated code produced by baseline approach. So, to know how many **user_fix** are applied, you can use code IDE like vscode to compare these two files (`baseline_transed.js` and `baseline_transed_human_fixed.js`).

#### For EVAL6:

The files for **EVAL6** (the performance of Transcypt translation tool) are put in a seperated folder `./transcrypt/`. 

The input for **EVAL6** is the same as **EVAL5**. And similarly, the fixed version of the translated code from Transcrypt by human is put in `./transcrypt/benchmark_name/__target__/source_human_fixed.js`.

The output for **EVAL6** is `./transcrypt/benchmark_name/__target__/source.js`, which is the translated code provided by Transcrypt. Similarly, you can use code IDE like vscode to compare these two files to see where human fix is applied.



### 1.4 Details for Running the Experiments

The following sections will guide you in reproducing each experiment's results. If not mentioned, all the following commands should be executed in the root directory of this repository.

1. **EVAL1**. The evaluation scripts in put in `./scripts/evaluation.py`.
    1. Open the script `./scripts/evaluation.py`.
    2. Uncomment the following line in the main function.
        ```
        overallEffectivenessGPT4()
        ```
    3. Run the script.
        ```
        python ./scripts/evaluation.py
        ```
        Note that during the execution of the script, our tool will output a series of the translation information start with "[INFO]". During tracing the source/translated code, there will also be some outputs/errors from the source/translated code, like "All tests passed", "Assertion Failed", or even syntax errors (because of the incorrect fragment generated by LLMs) etc. This does not mean the tool has issues. They are just the normal output of the source/translated code, not from our tool.
        
    4. This script will then automatically run the following commands for the first 8 benchmark programs:
        ```
        python ./scripts/controller.py benchmark_name I GPT-4-turbo optimized 3 True
        python ./scripts/controller.py benchmark_name A GPT-4-turbo optimized 3 True
        ```

        For the last benchmark program, "py_evtx", as mentioned in special note, we split the unit test of this program into 3 parts. The evaluation script will automatically run the following commands for the first part:
        ```
        python ./scripts/controller.py py_evtx_1 ID GPT-4-turbo fast 3 True
        python ./scripts/controller.py py_evtx_1 A GPT-4-turbo fast 3 True
        ```
        Then, the script will copy the translation result of the first part to the second part, and run the following commands for the second part to continue the translation:
        ```
        python ./scripts/controller.py py_evtx_2 ID GPT-4-turbo fast 3 True
        python ./scripts/controller.py py_evtx_2 A GPT-4-turbo fast 3 True
        ```
        Then, similarly, the script will copy the translation result of the second part to the third part, and run the following commands for the third part to continue the translation:
        ```
        python ./scripts/controller.py py_evtx_3 ID GPT-4-turbo fast 3 True
        python ./scripts/controller.py py_evtx_3 A GPT-4-turbo fast 3 True
        ```
        Here, the command `I` means initializing the translation project and tracing the source code. `ID` means initializing the translation project without tracing the source code. As mentioned in the special note, the trace log of the source code for each part of "py_evtx" is provided by us. So we apply `ID` command for all the three parts of "py_evtx". The `fast` and `optimized` are the modes for tracing/checking. It will be explained in `3 Document for the Code`.

        If you want to know more about the meaning of the commands, please refer to `2 Use for Real Translation` section.

    5. Go through the results for each benchmark program. The translated JavaScript codes are put in `./benchmarks_new/benchmark_name/transed.js`. The evaluation result is put in `./benchmarks_new/benchmark_name/result.json`. The total number of `block_id` appeared in this JSON file is the number **user_fix** in the paper for each benchmark program. The result for `py_evtx` is put in three folders: `./benchmarks_new/py_evtx_1/`, `./benchmarks_new/py_evtx_2/`, and `./benchmarks_new/py_evtx_3/`. The total number of **user_fix** for `py_evtx` is the sum of the three parts.

2. **EVAL2**. Same with **EVAL1**, the evaluation scripts in put in `./scripts/evaluation.py`.
    1. Open the script `./scripts/evaluation.py`.
    2. Uncomment the following line in the main function.
        ```
        overallEffectivenessGPT35()
        ```
    3. Run the script.
        ```
        python ./scripts/evaluation.py
        ```
    4. The commands for all benchmark programs executed by the script are the same as **EVAL1**. The only difference is that now the engine is `GPT-3.5-turbo`.
    5. The results are put in the same place as **EVAL1**. The total number of `block_id` appeared in the `result.json` file is the number **user_fix** in the paper for each benchmark programs.

3. **EVAL3**. Same with **EVAL1**, the evaluation scripts in put in `./scripts/evaluation.py`.
    1. Open the script `./scripts/evaluation.py`.
    2. Uncomment the following line in the main function.
        ```
        ablationStudyBase()
        ```
    3. Run the script.
        ```
        python ./scripts/evaluation.py
        ```
    4. The commands for all benchmark programs executed by the script are the same as **EVAL1**. The only difference is that now the `retry_limit` is set to `1` to disable the retry mechanism. And `allow_spec` is set to `False` to disable the input/output specification for the LLM.
    5. The results are put in the same place as **EVAL1**. The total number of `block_id` appeared in the `result.json` file is the number **user_fix** in the paper for each benchmark programs.

4. **EVAL4**. Same with **EVAL3**, the evaluation scripts in put in `./scripts/evaluation.py`.
    1. Open the script `./scripts/evaluation.py`.
    2. Uncomment the following line in the main function.
        ```
        ablationStudySpec()
        ```
    3. Run the script.
        ```
        python ./scripts/evaluation.py
        ```
    4. The commands for all benchmark programs executed by the script are the same as **EVAL3**. The only difference is that `allow_spec` is set to `True`. This will allow one I/O example for each code fragment.
    5. The results are put in the same place as **EVAL1**. The total number of `block_id` appeared in the `result.json` file is the number **user_fix** in the paper for each benchmark programs.

5. **EVAL5**. Same with **EVAL1**, the evaluation scripts in put in `./scripts/evaluation.py`.
    1. Open the script `./scripts/evaluation.py`.
    2. Uncomment the following line in the main function.
        ```
        runTransBaseline()
        ```
    3. Run the script.
        ```
        python ./scripts/evaluation.py
        ```
    4. The script will automatically decompose the benchmark programs into sections mentioned in the paper and then ask the LLM to translate the code section by section. After the translation of all the sections, the script will merge the translated code into the final JavaScript code.
    5. The translation result is put in `./benchmarks_new/benchmark_name/baseline_transed.js`. As mentioned in `1.3 The Input And the Output`, the fixed version of the translated code by human is put in `./benchmarks_new/benchmark_name/baseline_transed_human_fixed.js`. You can use code IDE like vscode to compare these two files to see where human fix is applied.

6. **EVAL6**. For the last sub-experiment, you need to first install Transcrypt tool. The installation guide can be found in the official website of [Transcrypt](https://www.transcrypt.org/). All the files are put in a separate folder called `./transcrypt`. There is no automatic script for this; please go through the following steps to reproduce the results.
    1. Open the `./transcrypt/` folder.
    2. For each benchmark program, there is a folder named `benchmark_name`. Go into the folder.
    3. The input python code is put in `./source.py`.
    4. Run the following command to translate the code using Transcrypt.
        ```
        python -m transcrypt -b -m -n source.py
        ```
    5. The translated code is put in `./__target__/source.js`.
    6. As mentioned in `1.3 The Input And the Output`, the fixed version of the translated code by human is put in `./__target__/source_human_fixed.js`. You can use code IDE like vscode to compare these two files to see where human fix is applied.




## 2 Use for Real Translation

1. To use our tool for real translation, you need to first have LLM access. Put your own key in `./utils/query_llm_cached.py` script.

 ```
 os.environ["OPENAI_API_KEY"]="your_own_key"
 ```

2. The language features we support:

   - Single thread, deterministic programs. And the program logic should not be heavily built based on reflection. This means your code should not use `random`, `id()`, `eval()`, etc.
   - Basic Python syntax, operators, built-in APIs, etc.
   - Basic Python data types. Now we only support `int`, `float`, `str`, `list`, `dict`, `None`, `bool`, `function`, `type` (class).
   - Error handling. Your code can throw built-in errors. But just make sure that the entire source code ends with no error.
   - Normal function definition and call. For lambda function, you should follow the escaping rule to normalize it into normal function if necessary.
   - Class related features. Our normalization script will try to normalize all the class definitions into closures (functions). So, it may not support complex features. Our tool supports:
     1. Basic class definition and member functions.
     2. Class inheritance from one another user class. But it will not support multiple inheritance. And inheritance from built-in classes is not supported. And make sure that if your code contains inheritance, the `super().__init__()` is called in the constructor of the child class directly using the parameter of the `__init__` function in the child class.
     3. Operator overload. We only support the overload for `in` (`__contains__`) and `==` (`__eq__`) operator overloading.
   - For libraris, normally used library like `re`, `math`, etc., is allowed in your code. The only thing is that you need to make sure the objects with types from the library (like `datatime`, `regex`, etc., which are not supported by our tool) will not go across the boundary of code fagments. And a correct translation depends on whether LLMs are familiar with the library you use.

3. The language features have not been supported yet:

   - Multi-threading, async programming, and non-deterministic programs. And we also do not support the code that heavily relies on reflection.
   - Other datatypes or datatypes from third-party libraries. We only support the basic Python data types now.
   - Customized errors. Since we do not support inheritance from built-in classes, the customized errors, which are inherited from built-in errors, are not supported.
   - Decorators. And generators.
   - Complex class features. Like multiple inheritance, inheritance from built-in classes, static methods, properties, and operator overload for other operators.
   - Other unexpected features..

    Note that 'not supported' does not mean your code is strictly prohibited from using these features. For example, simple features like generator functions can still be included in your code. Additionally, you can use functions to handle complex data types that are not natively supported by our tool. It's just that our tool will not guarantee for the soundness for these cases. 

    Normalizing the Python feature is not an easy task; we can only make the best effort to support the most common features.

4. Organize the input.

   1. First, create a folder under `./benchmarks_new/` folder. Name your translation project.
   2. As mentioned in 1.1.6, the only necessary input is the source code put in `./benchmarks_new/your_project_name/source.py`.
   3. If you also want to have ignored files, please check the benchmark programs to learn how to orginze the `ignore.py`, `ignore.js`, `ignore_head.js`.
   4. And also, you can prepare `./human_provided/` folder and `./correct_transed_codeblocks.json` file to provide the human fixed code fragments.

5. Start the Translation.

    1. Translate through the interaction with `./scripts/controller.py` script. The command is:

        ```
        python ./scripts/controller.py /your_project_name <op> <engine> <mode> <retry_limit> <allow_spec>
        ```

      - `/your_project_name`: The name of your project. It does not include the path.
      - `<op>`: The operation you want to do. It can be:
        - `I`: Init the translation project. The tool will automatically conduct the dynamic analysis and normalize the source Python program into skeleton K + fragments.
        - `A`: Automatic translation procedure. Basically, this will run the algorithm mentioned in the paper. If translation is stopped because of the failure of the LLMs, running this command again will continue the translation from the failed step, not restart. If you want to restart everything, please use `I` command.
        - `P`: Patch all the translated code fragments saved in `./benchmarks_new/your_project_name/transed_codeblocks.json` into the translated code in `./benchmarks_new/your_project_name/transed.js`. In the automatic mode, this will be done automatically.
        - `L`: Load all the translated code fragments from `./benchmarks_new/your_project_name/transed.js` into the translated code fragments in `./benchmarks_new/your_project_name/transed_codeblocks.json`. This command is used for the case in which humans modify some code fragments in the translated code in `./benchmarks_new/your_project_name/transed.js`. If so, you should use this command to save the modified code fragments back to the code blocks file.
        - Other commands implmented in the `./scripts/controller.py` script. You can check the script for more details.
      - `<engine>`: The engine you want to use. It can be `GPT-4-turbo`, `GPT-3.5-turbo`, or other things.
      - `<mode>`: The mode you want to use. It can be `optimized` or `fast`. This specifies the precision of the tracing and the strictness of the checking. Please read our documentation for more details.
      - `<retry_limit>`: The retry limit for the LLMs. If the LLMs fail to translate a fragment, the tool will retry for `retry_limit` times. If all the retries fail, the tool will ask for correct fragments from human.
      - `<allow_spec>`: The flag is used for evaluation. In general, just set it to `True`.

   2. If you are using `A` automatic mode, you may encounter cases where LLM cannot translate a fragment correctly, and the translation stops. You have two ways to fix:

      - You can directly modify the code in `./benchmarks_new/your_project_name/transed.js`, then use `L` command to save the modified code fragments back to the codeblocks file. Then, you just need to use `A` command to continue the translation.
      - You can provide the correct translation of the fragment in `./benchmarks_new/your_project_name/correct_transed_codeblocks.json`. The tool will find the correct translation in this json file if LLM fails to translate the fragment.

6. An simple exmpale. An example input source Python code is put in `./benchmarks_new/test/source.py` file. It shows several supported features and how you should organize your code. And on the other hand, `./benchmarks_new/test/counter_example_source.py` shows a series of unsupported features and the wrong way you organize the structure of your code. To run the translation for the `test` project, you can use the following command:

 ```
 python ./scripts/controller.py /test I gpt-4-turbo optimized 3 True
 python ./scripts/controller.py /test A gpt-4-turbo optimized 3 True
 ```

## 3 Document for the Code

1. Explanation of all the files participated in the translation for one program.
    
   The first group is all the input files:

    - `./benchmarks_new/benchmark_name/source.py`: This is the source Python program. It is the merged and refactored (mentioned in the paper) version of the original code base. We also removed some language features that are not supported by our tool (will be explained more carefully in `How to use for translation` and the `./not_support.txt` in the folder of each benchmark program).
    - `./benchmarks_new/benchmark_name/not_support.txt`: This file lists all the language features that are not supported by our tool and all the corresponding modifications of the source program.
    - `./benchmarks_new/benchmark_name/ignore.py`: This file includes all the codes that do not participate in the translation process. They will not be counted for accuracy. Why have this? Three cases:
      1. The code is used to get the input for the unit test. They do not related to the main logic of the program.
      2. Some big constant lists, dicts can be directly copy-pasted from Py side to JS side, but cause trouble for LLMs.
      3. The shims mentioned in the paper. We implement the shim for `random`.
    - `./benchmarks_new/benchmark_name/ignore.js`: If the source code has `ignore.py`, then it will have this corresponding `ignore.js` file which includes the translated version of the ignored code in Python side.
    - `./benchmarks_new/benchmark_name/ignore_head.js`: If the source code has `ignore.py`, then there will also be a `ignore_head.js` file which will be attached in the translated code. This file includes the import statements of the ignored code.
    - `./benchmarks_new/benchmark_name/human_provided/`: This folder includes all translated fragments that provided by human. This includes all the code fragments that belong to unit test. As mentioned in the paper, they will NOT be counted in the accuracy and total number of code fragments.
    - `./benchmarks_new/benchmark_name/correct_transed_codeblocks.json`: This file is provided by human. It records all the correct translations of the code fragments. When a fragment cannot be correctly translated by LLMs (failed on specifications), the tool will use the correct translation in this json file. During this time, the block id of that fragment will be recorded and shown in the `result.json` file after the translation of this benchmark program. This is necessary for evaluation to go on. Basically, this means human assist and fix the code fragment.
    
   The second group is all the output files:

    - `./benchmarks_new/benchmark_name/transed.js`: This is the translated JavaScript program.
    - `./benchmarks_new/benchmark_name/result.json`: This file records the evaluation result of the translated code. As mentioned in `correct_transed_codeblocks.json`, it includes all the code fragments that fixed by humans during the entire translation for this benchmark program.

    The third group is all the intermediate files:

    - `./benchmarks_new/benchmark_name/source_inst.py`: The instrumented version of the source code. It will be used to conduct dynamic analysis. The analysis result will be used for normalization
    - `./benchmarks_new/benchmark_name/dynamic_analysis_result.json`: The dynamic analysis result of the instrumented source code. This result will be used for normalization.
    - `./benchmarks_new/benchmark_name/source_normalized.py`: The normalized version of the source program. It is the skeleton K plus all the fragments mentioned in the paper.
    - `./benchmarks_new/benchmark_name/skeleton_syn.js`: The corresponding skeleton K' for the JS code. It is the skeleton K while all the fragments are left empty.
    - `./benchmarks_new/benchmark_name/source_codeblocks.json`: The content of all the code fragments in the source code.
    - `./benchmarks_new/benchmark_name/transed_codeblocks.json`: The content of all the translated code fragments in the translated code. Initially, all the fragments are empty.
    - `./benchmarks_new/benchmark_name/block_id_to_func_name.json`: The record the mapping from the fragment Id to the function name in the source code. It will be used to hint the LLM. Like, if you write "next step is calling to block 19", LLM will be confused, but with this mapping, we can have more accurate hint like "next step is calling to function `abc` (the function name of fragment 19)".
    - `./benchmarks_new/benchmark_name/obs_vars.json`: The obserable variables of each fragment. They will be used for obserable effect analysis as mentioned in the paper.
    - `./benchmarks_new/benchmark_name/source_normalized_inst.json`: The instrumented version of the normalized source code. It will be used for observable effect analysis as mentioned in the paper: every leaving and entry point of the function will be traced.
    - `./benchmarks_new/benchmark_name/traces_all/`: This folder includes the trace result of the instrumented normalized source code. For long programs, it can have a series of trace files named like `_step_trace_from_x_to_y.log`, `_step_trace_from_y_to_z.log`, ...
    - `./benchmarks_new/benchmark_name/traces_all/_step_trace_info.json`: The info of the trace result. In includes the total number of steps, the number of step per saved per trace file, and how much step is skipped.
    - `./benchmarks_new/benchmark_name/control.json`: The control file for skate tool. It records the current step number, and which fragment is translated and which is not. It will be used for the translation process.
    - `./benchmarks_new/benchmark_name/specifications.json`: The specifiations for each fragment. It is append-only during the entire translation for the benchmark program.
    - `./benchmarks_new/benchmark_name/trans_info.json`: The description of the translation task. Include the fragment id to translate, the I/O examples, the engine, and the action (translate new fragment or fix old fragment).
    - `./benchmarks_new/benchmark_name/transed_result_file.txt`: The translation result of one fragment output by the LLM.
    - `./benchmarks_new/benchmark_name/transed_inst.js`: The instrumented version of the translated code. It will be used for step checking. The tool will compare every entry and leaving point of the code fragments with the traced result of the source code.
    - `./benchmarks_new/benchmark_name/traces_all/_step_check_result.json`: The step check result. It records the farthest step until which the translated code has the equivalent behavior on observable effects with the source code. If the newest step is not the final step, it will also include the reason why something is mismatched in this newest step.

2. Explanation of the code structure.

  - `./scripts/controller.py`: The main script for our tool. Based on the input command, it will call other scripts to conduct the command.
  - `./scripts/normalize.py`: The script for normalization. It will normalize the source code into skeleton K plus all the fragments mentioned in the paper. This script will execute the following scripts to conduct the normalization.
    - `./scripts/normalize_instrument.py`: The script with instrument the original source code with the trace code. It will generate the `source_inst.py` file in the benchmark program folder.
    - `./benchmarks_new/benchmark_name/source_inst.py`: The script will then run the instrumented source code to get the analysis result. The result will be saved in `dynamic_analysis_result.json`.
    - `./scripts/normalize_rewrite.py`: Based on the dynamic analysis result, this script will rewrite the source code into the normalized version. The normalized version will be saved in `source_normalized.py`. This script will also conduct the observable variable analysis and save in the `obs_vars.json` file.
  - `./scripts/step_record.py`: The script for tracing the source code. It will execute the following scripts:
    - `./scripts/step_record_instrument.py`: The script will instrument the normalized source code with the instrumentation head, and save the instrumented code in `source_normalized_inst.py`.
    - `./benchmarks_new/benchmark_name/source_normalized_inst.py`: The script will run the instrumented code to get the trace result. The trace result will be saved in the `traces_all/` folder.
  - `./scripts/step_check.py`: The script for checking the translated code. It will execute the following scripts:
    - `./scripts/step_check_instrument.py`: The script will instrument the translated code with the instrumentation head, and save the instrumented code in `transed_inst.js`.
    - `./benchmarks_new/benchmark_name/transed_inst.js`: The script will run the instrumented code to get the checking result. The checking result will be saved in the `traces_all/_step_check_result.json` folder.
  - `./scripts/step_trans.py`: This script is used for querying LLMs and get the translation of the code fragments.
  - `./scripts/instrumentation/`: This folder includes all the instrumentation head for tracing the source code and checking the translated code. Based on the tracing/checking mode, the tool will choose the corresponding instrumentation head to attach to the code.
    - `./scripts/instrumentation/optimized_mode_checker_code.py`: The instrumentation head for the source code for optimized mode tracing.
    - `./scripts/instrumentation/fast_mode_checker_code.py`: The instrumentation head for the source code for fast mode tracing.
    - `./scripts/instrumentation/optimized_mode_checker_code.js`: The instrumentation head for the translated code for optimized mode tracing.
    - `./scripts/instrumentation/fast_mode_checker_code.js`: The instrumentation head for the translated code for fast mode tracing.

3. Explanation of tracing/checking the source/translated code.

   Tracing and checking is one significant part of our tool. The overall process is:
    1. In the initialize procedure, the tool will trace the source python program to get the trace log. This only happens once during the entire translation procedure. The tracing log will used for checking the correctness of the translated code, and input/output specifications for prompting the LLMs.
    2. During the translation, as long as a new fragment is translated/fixed, the tool will check the translated fragment by instrument the entire translated code and then run it to get the trace log. The trace log will be compared with the source code trace log to see whether the translated code has the same behavior with the source code.

   We can find that step 2 will be conducted many times during the translation. Ideally, the instrument will be conducted directly inside the interpreter to achieve the best efficiency. Due to engineering efforts, we instrument the Python/JavaScript code at the source code level. This causes the tracing/checking process to be slow. 

   To speed up the translation, we made the following optimization and simplification:
      1. Instead of saving the trace log for the translated code at each time as what we did for the source code, and then doing the comparison, the tool will directly compare the trace log of the source code in the runtime with the translated code. This saves time and space by skipping re-creating all the objects.
      2. Relax the tracing/checking. Ideally, to reach the soundness guarantee, the tracing will trace all the observable effects and all the data objects that go across the boundary of the code fragments. To speed up the translation and save the engineering effort, we made the following simplification:
          - (Optimized mode) For observable objects, we assume that all the objects can be recursively accessed. Thus, the tracing will start from the observable variables of the code fragment and then recursively trace all the objects that can be accessed from the observable variables.
          - (Fast mode) Besides the simplification in the optimized mode, the fast mode will also ignore the reference binding between objects (object table). And since no object table is maintained, the fast mode will only record a finite depth (set to 2 by default) for the object tree. This will save the space and time for the tracing/checking.
          