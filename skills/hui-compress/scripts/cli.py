#!/usr/bin/env python3
"""
Hui Compress CLI

Usage:
    hui <filepath>
"""

import argparse
import sys

# Force UTF-8 on stdout/stderr before any code can print. Windows consoles
# default to cp1252 and crash on the ❌ glyphs in error/validation branches,
# masking the real error and leaving the user with a half-compressed file.
for _stream in (sys.stdout, sys.stderr):
    reconfigure = getattr(_stream, "reconfigure", None)
    if callable(reconfigure):
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

from pathlib import Path

from .compress import backup_dir_for, compress_file, compress_incremental
from .detect import detect_file_type, should_compress


def print_usage():
    print("Usage: hui [--base <baseline-file>] [--dry-run] <filepath>")


def parse_args():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("filepath", type=Path, nargs="?")
    parser.add_argument("--base", type=Path)
    parser.add_argument("--incremental", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.filepath or (args.incremental and not args.base):
        print_usage()
        sys.exit(1)
    if args.base and not args.incremental:
        args.incremental = True
    return args


def main():
    args = parse_args()
    filepath = args.filepath

    # Check file exists
    if not filepath.exists():
        print(f"❌ File not found: {filepath}")
        sys.exit(1)

    if not filepath.is_file():
        print(f"❌ Not a file: {filepath}")
        sys.exit(1)

    filepath = filepath.resolve()

    # Detect file type
    file_type = detect_file_type(filepath)

    print(f"Detected: {file_type}")

    # Check if compressible
    if not should_compress(filepath):
        print("Skipping: file is not natural language (code/config)")
        sys.exit(0)

    print("Starting hui compression...\n")

    try:
        if args.incremental:
            base = args.base.resolve()
            if not base.is_file():
                print(f"❌ Baseline file not found: {args.base}")
                sys.exit(1)
            success = compress_incremental(filepath, base, dry_run=args.dry_run)
        elif args.dry_run:
            print("Dry run: full-file compression would run; no model call or file write.")
            success = True
        else:
            success = compress_file(filepath)

        if success:
            print("\nCompression completed successfully")
            backup_path = backup_dir_for(filepath) / (filepath.stem + ".original.md")
            print(f"Compressed: {filepath}")
            print(f"Original:   {backup_path}")
            sys.exit(0)
        else:
            print("\n❌ Compression failed after retries")
            sys.exit(2)

    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(130)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
