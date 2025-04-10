#! /usr/bin/env python3
# A Python script to run Transcrypt for each source.py in program in `evaluation_for_comparators/baseline_transcrypt`.
# cmd to run: python -m transcrypt -b -m -n source.py

import os
import sys
import shutil
import subprocess
SCRIPT_DIR = os.path.abspath(os.path.dirname(os.path.realpath(__file__)))
REL = lambda *x: os.path.abspath(os.path.join(SCRIPT_DIR, *x))

ws_dir = REL("../evaluation_for_comparators/baseline_transcrypt")

def run_transcrypt(ws_dir):
  for subdir_name in os.listdir(ws_dir):
      if subdir_name == "human_fixed":
          continue
      subdir_path = os.path.join(ws_dir, subdir_name)
      if os.path.isdir(subdir_path):
          py_file = os.path.join(subdir_path, "source.py")
          assert os.path.exists(py_file), f"source.py does not exist in {subdir_path}. This should not happen unless the directory structure was accidentally changed."
          print(f"Running Transcrypt on {subdir_name}")
          # os.system(f"python -m transcrypt -b -m -n {py_file}")
          # change this to use subprocess and save the stdout and stderr to a file; get the return code in a variable
          result = subprocess.run(["python", "-m", "transcrypt", "-b", "-m", "-n", py_file], capture_output=True, text=True)
          if result.returncode != 0:
              print(f"Transcrypt failed to run on {subdir_name}. Return code: {result.returncode}")
          else:
            dest_file = os.path.join(subdir_path, "__target__", "source.js")
            print(f"Transcrypt succeeded to run on {subdir_name}. The output is saved to {dest_file}")
          # save the stdout and stderr to a file
          with open(os.path.join(subdir_path, "__target__", "transcrypt.log"), "w") as f:
              f.write(result.stdout)
              f.write(result.stderr)
          print(f"Transcrypt's stdout and stderr saved to {os.path.join(subdir_path, '__target__', 'transcrypt.log')}")
          print("\n\n")

def clean_transcrypt_output(ws_dir):
  #  remove "__target__" folder in each subdir
  for subdir_name in os.listdir(ws_dir):
      if subdir_name == "human_fixed":
          continue
      subdir_path = os.path.join(ws_dir, subdir_name)
      if os.path.isdir(subdir_path):
          target_dir = os.path.join(subdir_path, "__target__")
          if os.path.exists(target_dir):
              shutil.rmtree(target_dir)
              print(f"Removed {target_dir}")

if __name__ == "__main__":
  # take the first argument as the ws_dir
  # only accept argument "run" or "clean"
  help_msg = """Usage: python transcrypt.py <run|clean>
    The former runs Transcrypt on all the source.py files on all benchmark programs, and the latter cleans the generated transcrypt files.
    Example: python transcrypt.py run"""
  
  # check the current dir
  cur_dir = os.getcwd()
  readme = os.path.join(cur_dir, "README.md")
  if not os.path.exists(readme):
      print("Please run this script in the root directory of the repository.")
      sys.exit(1)

  if len(sys.argv) != 2:
      print(help_msg)
      sys.exit(1)
  if sys.argv[1] == "run":
      run_transcrypt(ws_dir)
  elif sys.argv[1] == "clean":
      clean_transcrypt_output(ws_dir)
  else:
      print(help_msg)
      sys.exit(1)