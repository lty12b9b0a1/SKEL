#!/bin/bash

echo "Only run it on the kisp server because of the Python env."

# Stop if meet errors
set -e

# Define the target directory
TARGET_DIR="artifact_for_review"

# Define arrays of directories and files to keep
KEPT_DIRS=(
    "scripts"
    "docker-env"
    "benchmarks_new"
    "evaluation_for_comparators"
    "LLM_cache"
    "pictures"
)

KEPT_FILES=(
    "unzip_logs.sh"
    "README.md"
    "INSTALL.md"
    "HOW_TO_USE.md"
    "impl_details.md"
)

SUBDIRS_TO_RM=(
    "traces_all"
    "__target__"
    "__pycache__"
)

# Check if README.md exists
if [ ! -f "README.md" ]; then
    echo "Please run this script at the root directory of the artifact. Exit."
    exit 1
fi

# Create the target directory
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
echo "Target directory $TARGET_DIR has been newly created."

# Run the Python script to clean up the benchmarks
python ./scripts/evaluation.py Clean
python ./scripts/transcrypt.py clean

# Copy the specified directories
for dir in "${KEPT_DIRS[@]}"; do
    cp -r "$dir" "$TARGET_DIR/"
    echo "Directory $dir has been copied to $TARGET_DIR/"
done

# Copy the specified files
for file in "${KEPT_FILES[@]}"; do
    cp "$file" "$TARGET_DIR/"
    echo "File $file has been copied to $TARGET_DIR/"
done

# Remove unwanted subdirectories
for subdir in "${SUBDIRS_TO_RM[@]}"; do
    find "$TARGET_DIR" -type d -name "$subdir" -exec rm -rf {} +
    echo "Subdirectory $subdir has been removed from $TARGET_DIR/"
done

echo "Artifact for review has been prepared in $TARGET_DIR"

# zip the target directory to "skel-py2js-artifact.zip" silently
rm -f "skel-py2js-artifact.zip"
zip -r "skel-py2js-artifact.zip" "$TARGET_DIR" > /dev/null 2>&1
echo "Artifact for review has been zipped to skel-py2js-artifact.zip"
