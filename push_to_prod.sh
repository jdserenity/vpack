#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="/Users/jd/Library/CloudStorage/ProtonDrive-jd@levier.cc-folder/coding/vpack"
TARGET_PARENT="$(dirname "$TARGET_DIR")"
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TMP_DIR="${TARGET_PARENT}/.vpack_push_tmp_$$"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -d "$TARGET_PARENT" ]]; then
  echo "Target parent directory not found: $TARGET_PARENT" >&2
  exit 1
fi

if [[ "$SOURCE_DIR" == "$TARGET_DIR" ]]; then
  echo "Source and target are the same directory. Nothing to push." >&2
  exit 1
fi

rm -rf "$TMP_DIR"
cp -R "$SOURCE_DIR" "$TMP_DIR"
rm -rf "$TARGET_DIR"
mv "$TMP_DIR" "$TARGET_DIR"

echo "Pushed $SOURCE_DIR -> $TARGET_DIR"
