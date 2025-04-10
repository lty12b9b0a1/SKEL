#!/bin/bash

# Define required files
README_FILE="README.md"
ZIP_FILES=("py_evtx_1_trace_log.zip" "py_evtx_2_trace_log.zip" "py_evtx_3_trace_log.zip")
DEST_DIR="benchmarks_new"

# Check if README.md exists
if [ ! -f "$README_FILE" ]; then
    echo "Please run this script at the root directory of the artifact. Exit."
    exit 1
fi

# Check if all zip files exist
for zip_file in "${ZIP_FILES[@]}"; do
    if [ ! -f "$zip_file" ]; then
        echo "Please move these 3 zip files (py_evtx_{1/2/3}_trace_log.zip) downloaded from Zenodo to the current directory before running this script."
        echo "Not found: $zip_file. Exit."
        exit 1
    fi
done

# Unzip files into respective folders
for i in {1..3}; do
    ZIP_FILE="py_evtx_${i}_trace_log.zip"
    DEST_SUBDIR="$DEST_DIR/py_evtx_${i}"
    
    if [ ! -d "$DEST_SUBDIR" ]; then
        echo "The directory $DEST_SUBDIR doesn't exist. This should not happen unless the artifact structure was accidentally changed. Exit."
        exit 1
    fi
    echo "Unzipping $ZIP_FILE into $DEST_SUBDIR ..."
    unzip -q "$ZIP_FILE" -d "$DEST_SUBDIR"
    # find the unzipped `traces_all` dir and move it to DEST_SUBDIR
    TRACES_ALL_DIR=$(find "$DEST_SUBDIR" -type d -name "traces_all")
    if [ -d "$TRACES_ALL_DIR" ]; then
        mv "$TRACES_ALL_DIR" "$DEST_SUBDIR"
        rm -rf "$DEST_SUBDIR/benchmarks_new"
    fi
done

echo "All files successfully unzipped."
