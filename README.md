# SKEL: Program Translator via Skeleton Generation
Paper: **Program Skeletons for Automated Program Translation** in PLDI 2025

# License
The main part of the code is under MIT license. Some dependencies and datasets are under other licenses. See [DEPENDENCY.md](./DEPENDENCY.md) for details.

## Introduction

`SKEL` is a tool for (mostly) automated program translation from Python to JavaScript. It requires a Python program with whole-program tests as input and produces a complete JavaScript translation that has the equivalent behavior on provided tests.

`SKEL` works in two stages. 
- The first stage analyzes the Python program and produces a JavaScript "skeleton" with program trace as the semantic requirements. This stage is deterministic and does not involve data-driven approaches like LLM.
- In the second stage, the execution-order translation (`EOT`) algorithm loops the translation, checking, and refining of each fragment step-by-step following the execution order. When the `EOT` algorithm terminates, the translation is correct-on-tests.

## Getting Started Guide

### Setup: Install `SKEL`

We provide a docker image to set up the environment with `SKEL` installed. After starting the container, please follow the instructions to unzip necessary trace logs. Please refer to [INSTALL.md](./INSTALL.md).

### Quick Start with an example

A quick start of `SKEL` using an example can be found in the first section of [HOW_TO_USE.md](./HOW_TO_USE.md#1-quick-start-with-an-example).

## Evaluation Overview

`SKEL` is evaluated in three aspects:
- Part A: overall effectiveness (table 2 in paper)
- Part B: comparison with baseline translators (table 3 in paper)
- Part C: ablation study (table 4 in paper)

### Benchmarks

Our collected benchmarks are at `./benchmarks_new`. Each benchmark has at least the following files. Additional optional files are explained in the ["Details of Implementation"](./impl_details.md#involved-files-during-running-skel).
- `source.py`: we merge multiple files of each Python program into one file and syntactically refactor it so that each function is less than 100 LoC. It contains unit tests for the source Python program. We started with existing tests and added more to increase the coverage at our best effort.
- `test_fragments/`: translated test functions for the target JavaScript program.
- (Optional) `tracer_skip.py`: most of them affect the tracing or result in large file size, e.g., large arrays or long strings, which can be easily syntactically translated. This file also contains the API shim mentioned in the paper.
- (Optional) `tracer_skip.js`: the translated JavaScript code of `tracer_skip.py`.

There are 9 benchmarks in total. Each benchmark corresponds to a sub-directory. One exception is the longest program `py-evtx`. Because the tracing time for all of its tests in one go is too long, we split its **tests** into 3 parts (`py_evtx_{1/2/3}` sub-directories) and trace them separately for practicality consideration. This does not mean we split the main program. `SKEL` is still running on the full program for all three parts.

### Part A: Overall Effectiveness

This part aims to evaluate how `SKEL` performs on automated real-world program translation. That is, how many code fragments (i.e., functions) need human interventions (i.e., `#UserFix`) when the EOT loop in `SKEL` terminates. We evaluate `SKEL` when it's equipped with 2 different code synthesizers (i.e., `GPT-3.5-turbo` and `GPT-4-turbo`). We'll use `GPT-3.5` and `GPT-4` to refer to the two models in the following sections.

We report the number and percentage of `#UserFix` and `#Auto` in Table 2. `#Auto` is the number of functions that are translated automatically by `SKEL` without any human intervention. It's equal to `#Functions - #UserFix`.

### Part B: Comparison with Baselines

This part compares `SKEL` with 2 baselines (`Transcrypt` and `GPT-4`) and reports the number of `#UserFix` in Table 3. `SKEL` is equipped with 2 different code synthesizers as in Part A.

### Part C: Ablation Study

This part aims to evaluate how much these two design choices in `SKEL` contribute to its level of automation:
1. Providing semantic requirements to the code synthesizer.
2. The `check-and-refine` strategy to check, refine, and fix the translation.

We evaluate these variants of `SKEL`:
- `SKEL-base`: the version without the 2 design choices above.
- `SKEL-spec`: the version with semantic requirements provided to the code synthesizer.
- `SKEL-spec-chkrfn`: the version with both semantic requirements and `check-and-refine` strategy. This is the full `SKEL`.

We report the number of `#UserFix` in Table 4.

## Step-by-step Instructions

This section provides step-by-step instructions to reproduce the evaluation results: part A (table 2), part B (table 3), and part C (table 4). It covers the necessary commands and file explanations to check the results. 

If you're interested in the details of the implementation and other generated files, please see the ["Details of Implementation"](./impl_details.md) file. The experiments involving LLMs reuse our provided query caches. Please see the later section ["Reproducibility with respect to LLM queries"](#reproducibility-with-respect-to-llm-queries) for more details.  

> **IMPORTANT NOTE: The current results in this artifact have slight changes from the results in the paper due to the reimplementation for better performance. The final results are listed in the sections below.** Since the paper submission, our artifact was in active improvement to reduce excessive memory overhead on long programs. We also replaced our previous Python source normalizer with a more robust implementation. The numbers fluctuate due to changes in SKEL as well as the non-determinism of LLMs but largely remain similar.


### Part A: Overall Effectiveness (table 2)

Inside the container, run the following commands in `/workspace` directory. These commands invoke `SKEL` equipped with `GPT-4` or `GPT-3.5` code synthesizers on each benchmark respectively. The estimated execution time is listed below. 

Note that, by default, the evaluation command will invoke `SKEL` on all the included benchmarks. If you want to run benchmarks partially or skip some benchmarks, you can first comment out lines (i.e., program names) of the `benchmarks` variable variable (around line 606) in `./scripts/evaluation.py` script and then run the following commands one by one. 

```shell
cd /workspace
```
```shell
python ./scripts/evaluation.py SKEL-GPT4
# Estimated execution time: 30 mins to 1 hour
```

```shell
python ./scripts/evaluation.py SKEL-GPT35
# Estimated execution time: 30 mins to 1 hour
```

During the execution, it's expected to see `[INFO]` loggings from our system and intermediate execution results of these benchmarks' tests, e.g., "All tests passed", "Assertion Failed", or some syntax errors. These are normal during the execution of `SKEL`. During the translation, if `SKEL` fails to translate one code fragment correctly (i.e., reach retry limit), it will try to obtain the correct translation from the `./benchmarks_new/{benchmark_name}/groundtruth_fragments.json` file. This simulates a real human intervention. Each time `SKEL` accesses this groundtruth, the total number of `#UserFix` is incremented by 1 automatically.

 The translated JavaScript code will be saved in `./benchmarks_new/{benchmark_name}/translated.js`. The number of `#UserFix` will be saved in `./eval_results/SKEL-GPT4-result.json` and `./eval_results/SKEL-GPT35-result.json` respectively. Only the results of evaluated benchmarks are saved; unevaluated ones will not be shown in the json file. The append-only file `./evaluation.log` also records what benchmarks have been evaluated.

It's expected to see the following results from these two json files. We use "function", "fragment", or "block" to refer to the code fragments in the paper.

| Benchmark | Fragments | SKEL with GPT-4 | | SKEL with GPT-3.5 | |
| --- | --- | --- | --- | --- | --- |
| | | #UserFix | #Auto(%) | #UserFix | #Auto(%) |
| colorsys | 9 | 0 | 100% | 2 | 78% |
| heapq | 24 | 3 | 88% | 5 | 79% |
| html | 42 | 2 | 95% | 11 | 74% |
| mathgen | 82 | 4 | 95% | 20 | 76% |
| strsim | 50 | 0 | 100% | 0 | 100% |
| bst (bst-rec) | 21 | 0 | 100% | 1 | 95% |
| rbt (red-black-tree) | 27 | 0 | 100% | 1 | 96% |
| toml | 47 | 10 | 79% | 14 | 70% |
| py-evtx | 164 | 4 | 98% | 18 | 89% |
| Total | 466 | 23 | 95% | 72 | 85% |

Note that the total number of fragments slightly differs between the table and the submitted paper. The new count is obtained through an automated script and is more precise (excluding normalized class wrappers).

> From the table, we can see the support for the first claim in the paper (lines 855-857): SKEL equipped with GPT-4 automatically translates 95% of functions correctly. The effectiveness of `SKEL` improves when a stronger synthesizer is used (improved from 89% to 95%).

### Part B: Comparison with Baselines (table 3)

The results of `SKEL` are already collected in Part A. Here in Part B, we will explain how to obtain the translations of baselines `GPT-4` and `Transcrypt` and how we manually counted their `#UserFix`, as they don't support automatic counting like in `SKEL`.

#### Get the translations of GPT-4

Inside the container, run the following command in `/workspace` directory. Similar to Part A, you can choose which benchmarks to run. The translated JavaScript code will be saved in `./benchmarks_new/{benchmark_name}/basedline_trans.js`. 

```shell
cd /workspace
python ./scripts/evaluation.py Baseline
# Estimated execution time: less than 5 min
```

#### Get the translations of Transcrypt

Inside the container, run the following command to invoke `Transcrypt` on each benchmark. The translated JavaScript code will be saved in `./transcrypt/{benchmark_name}/__target__/source.js`.

```shell
cd /workspace
python ./scripts/transcrypt.py run
# Estimated execution time: less than 5 min
```

#### Count the `#UserFix` of GPT-4 and Transcrypt

After obtain the translation result, we (authors) first checked the correctness of the translations and made a best-effort attempt to fix the code. If a fix is inside a function, we count this function in `#UserFix`. We stop after spending 1-2 hours for each benchmark to obtain a lower-bound of `#UserFix`, if the translation is still incorrect after fixing `k` functions. Note that Transcrypt might fail on some benchmarks due to the unsupported features. In such case, we count it as `NA`.

Our fixed versions are in `./evaluation_for_comparators/baseline_gpt4/{benchmark_name}/baseline_translated_human_fixed.js` for `GPT-4` and `./evaluation_for_comparators/transcrypt/human_fixed/{benchmark_name}/source_human_fixed.js` for `Transcrypt`. You can use IDE like vscode to compare the original and fixed translations to see the fixes we made. The counted `#UserFix` is the table below.

| Benchmark        | #UserFix (GPT-4) | #UserFix (Transcrypt) |
|------------------|------------------|--------------------|
| colorsys         | 3                | 0                  |
| heapq            | 6                | 5+                  |
| html             | 10+                | NA                  |
| mathgen          | 27                | NA                  |
| strsim           | 7                | NA                  |
| bst (bst-rec)          | 2                | 0                  |
| rbt (red-black-tree)   | 5                | 1                  |
| toml             | 15+                | NA                  |
| py_evtx          | 15+              | NA                  |
| Total            | 90+               | NA                  |


The numbers are the same as the results of the paper, except that the `#UserFix` of the `Transcrypt` column on benchmark `red-black-tree` changed from "5+" to "1". During the initial evaluation for submission, we followed error messages to fix each translation but couldn't resolve this. However, upon re-running the evaluation, we spent more time on the translated code and found a more effective single-location fix.

> By comparing this table with the one in Part A, we can see the support for the second claim in the paper (lines 893-894): translations by `SKEL` have fewer `#UserFix` compared with other translators. Step-by-step checks make it easy to tell where to fix when user intervenes.

### Part C: Ablation Study (table 4)

The table 4 shows the effectiveness of these variants of `SKEL`: `SKEL-base`, `SKEL-spec`, and `SKEL-spec-chkrfn`. Since the `SKEL-spec-chkrfn` is the full `SKEL` and its results are already reported in Part A, here we will only evaluate `SKEL-base` and `SKEL-spec` here.

Inside the container, run the following command in `/workspace` directory to invoke `SKEL` on each benchmark. Similar to Part A, you can choose which benchmarks to run. The translated JavaScript code will be saved in `./benchmarks_new/{benchmark_name}/translated.js`. 

```shell
cd /workspace
```

```shell
python ./scripts/evaluation.py AblationBase
# Estimated execution time: 30 mins to 1 hour
```

```shell
python ./scripts/evaluation.py AblationSpec
# Estimated execution time: 30 mins to 1 hour
```

The number of `#UserFix` will be saved in `./eval_results/AblationBase-GPT4-result.json` and `./eval_results/AblationSpec-GPT4-result.json` respectively. It's expected to see the following results from these two files.

| Benchmark | Fragments | SKEL-base | SKEL-spec |
| --- | --- | --- | --- |
| | | **#UserFix** | **#UserFix** |
| colorsys | 9 | 3 | 3 |
| heapq | 24 | 9 | 4 |
| html | 42 | 15 | 13 |
| mathgen | 82 | 18 | 13 |
| strsim | 50 | 2 | 0 |
| bst (bst-rec) | 21 | 0 | 0 |
| rbt (red-black-tree) | 27 | 4 | 2 |
| toml | 47 | 12 | 13 |
| py-evtx | 164 | 26 | 13 |
| Total | 466 | 89 | 61 |


### Get the statistics of the benchmarks (table 1)

The table 1 lists the LoC, the depth of call graph, Coverage, and the average lines of code per function. We collect the coverage information automatically, while manually counting the remaining statistics.

- To get the coverage information

Inside the container, run the following command in `/workspace` directory.
    ```shell
    cd /workspace
    python ./scripts/evaluation.py Coverage
    ```
    Then, the coverage information will be saved in `./eval_results/Coverage.json`.


- How we count the LoC: we use the `cloc` tool to count the total lines of each benchmark (i.e., the single Python file), then subtract the lines belonging to unit tests..
- How we count the depth of call graph: we use [python call graph tool](https://github.com/Lewiscowles1986/py-call-graph) to generate the call graph of each benchmark. Then, we manully count the depth of the call graph.
- How we count the average lines of code per function: we first count the total lines of code in each benchmark (i.e., a single Python file) belonging to functions, and then divide the result by the number of functions in the benchmark.

### Reproducibility with Respect to LLM Queries

We provide cached LLM responses for our experiments because the repeated queries to LLMs incur unnecessary costs and may introduce different results due to unpredictable reasons. These LLM caches come with this artifact and are used by default in the reproduction scripts. If any changes are made to the Python benchmarks, new LLM quries will be sent to OpenAI and its API key needs to be set (explained in ["LLM Access"](./HOW_TO_USE.md#2-llm-access)).

## Use `SKEL` on Your Own Programs

Please see [HOW_TO_USE.md](./HOW_TO_USE.md).

## Repo Structure

SKEL's core logic is mainly implemented in Python and partially in JavaScript for instrumenting JavaScript code.

- `docker-env`: Resource for building the docker image.
- `scripts`: Scripts for running `SKEL` and reproducing the evaluation results.
- `benchmarks_new`: The benchmarks used in the evaluation and the translation by `SKEL`.
- `eval_results`: The aggregated results of the evaluation.
- `evaluation_for_comparators`: The translation by baselines `Transcrypt` and `GPT-4`.
- `LLM_caches`: The cached LLM responses to reproduce our evaluation results.
