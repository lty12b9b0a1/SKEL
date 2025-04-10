
## Install `SKEL`

We recommend using our docker image, which has installed all the dependencies of `SKEL` and the compared baselines. If you want to install `SKEL` manually, please use this README as a reference.

### Step 1: Check basic requirements

On the host system, check the following requirements:
- `x86-64` architecture (The docker image may not work on other architectures. And the trace logs generated in real time may be different to ours, causing problems in reproduction. )
- `Docker` (`Docker 24.0.6+` recommended. Lower versions are not tested)
- (Recommended) `Linux` (For the bash scripts, it is expected to work on any Linux distros, although we only tested on `Ubuntu 22.04`). 

Here are the recommended hardware requirements:
- Mem: 16GB
- Disk: the tool and the whole evaluation will occupy about 14GB of disk space in total.
- CPU: for the CPU, higher single-thread performance is better. In our case with CPU Intel® Core™ i7-12700K, it takes 10~15 minutes to go through the translation for the longest program in our benchmark once.

We have tested the evaluation on 4 different machines, including MacOS and Linux. The total time cost ranges from 2-5 hours.

### Step 2: Pull the docker image

On the host system, run the following commands to pull the docker image. 
```shell
# Pull the docker image
docker pull 12b9b0a1/py2js_env:eval
# Tag the image with a new name
docker tag 12b9b0a1/py2js_env:eval skelpy2js
```

For Mac users (including ARM-based M1/M2/M3), it's strongly recommended to pull the image directly (should be able to run in Docker Desktop even though the image is for x86-64). Building it locally on ARM may result in slightly different program behaviors.

#### *Additional Option: Build the docker image from the Dockerfile*

Instead of pulling the image, another option is to build the image from the Dockerfile. At the root directory of this artifact, run:
```shell
cd docker-env
docker build -t skelpy2js .
```

### Step 3: Start the Container

Then run the following command to start the container. It is expected to run once.

```shell
# Start the docker container
cd docker-env
./docker_run.sh
```

### Step 4: Shell into the running container

Run the following command to shell into the running container. This command can be run multiple times.
```shell
cd docker-env
./docker_shell.sh
# You'll see `root@xxxx:/workspace#` in the terminal, meaning you are inside the container.
```

### Step 5: Run a sanity check

**Inside the container**, run the following commands. If you see the usage / help message, it means `SKEL` and the compared baselines are working.
```shell
# Run a sanity check of SKEL
# This should print out a help message from SKEL, without any errors.
python ./scripts/controller.py --help

# ===== Example output start =====
# [INFO] Executing: ./scripts/controller.py --help
# [INFO] Usage: python controller.py <testcase_folder> <op> <engine> <mode> <retry_limit> <allow_spec>
#        <testcase_folder>: The folder name of the test case.
#        ...
#        Example: python ./scripts/controller.py /test I gpt-4-turbo optimized 3 True
# ===== Example output end =====


# Run a sanity check of Transcrypt
# This should print out a help message from Transcrypt, without any errors.
transcrypt --help

# ===== Example output start ===== 
# Transcrypt (TM) Python to JavaScript Small Sane Subset Transpiler Version 3.9.0
# Copyright (C) Geatec Engineering. License: Apache 2.0

# usage: transcrypt ...
#   ...
#   -*, --star            Like it? Grow it! Go to GitHub and then click [* Star]

# Ready
# ===== Example output end =====
```

### Step 6: Unzip the trace logs of `py-evtx`

`SKEL` leverages the dynamic trace logs to collect semantic requirements and check the translation correctness.  The generation of trace logs is deterministic and reproducible, but the memory usage needed can be large and the tracing time may be hours, especially for the longest benchmark `py-evtx` (1.7k+ LoC). So we provide the trace logs of `py-evtx` so that `SKEL` can use it rather than tracing the Python program again (10+ hours). 

Here are the steps to unzip the trace logs of `py-evtx`.

1. **On the host system**, move the these 3 zip files `py_evtx_{1/2/3}_trace_log.zip` downloaded from Zenodo to the root directory of this artifact.

2. **On the host system**, run this script `./unzip_logs.sh` to unzip the files and automatically put them in suitable sub-directories. The extracted files are around 10GB. We also provide an option to skip evaluating this benchmark as mentioned in [README.md](./README.md#part-a-overall-effectiveness-table-2).

