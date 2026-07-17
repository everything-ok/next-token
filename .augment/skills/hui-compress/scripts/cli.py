#!/usr/bin/env python3
"""Hui compression command line interface."""

import argparse
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

from .compress import backup_path_for, compress_file, compress_incremental, preview_file, restore_file
from .detect import detect_file_type, should_compress


def parse_args():
    parser = argparse.ArgumentParser(prog="hui")
    parser.add_argument("filepath", type=Path)
    parser.add_argument("--base", type=Path, help="Explicit baseline for incremental compression")
    parser.add_argument("--incremental", action="store_true", help="Compress changed prose relative to --base")
    parser.add_argument("--dry-run", action="store_true", help="Show incremental scope without model calls or writes")
    parser.add_argument("--preview", action="store_true", help="Print validated compressed text without writing")
    parser.add_argument("--restore", action="store_true", help="Restore the matching backup atomically")
    parser.add_argument("--restore-incremental", action="store_true", help="Restore the incremental backup")
    args = parser.parse_args()
    if args.restore and args.preview:
        parser.error("--restore and --preview cannot be combined")
    if args.restore_incremental and not args.restore:
        parser.error("--restore-incremental requires --restore")
    if args.incremental and not args.base:
        parser.error("--incremental requires --base")
    if args.base:
        args.incremental = True
    if args.preview and (args.incremental or args.dry_run):
        parser.error("--preview is for full-file compression; use --dry-run with --incremental")
    return args


def main():
    args = parse_args()
    filepath = args.filepath.resolve()
    try:
        if args.restore:
            backup = restore_file(filepath, incremental=args.restore_incremental)
            print(f"Restored: {filepath}\nBackup:   {backup}")
            return 0
        if not filepath.is_file():
            print(f"File not found: {filepath}", file=sys.stderr)
            return 1
        print(f"Detected: {detect_file_type(filepath)}")
        if not should_compress(filepath):
            print("Skipping: file is not a supported natural-language file")
            return 0
        if args.preview:
            print(preview_file(filepath), end="")
            return 0
        if args.incremental:
            if not args.base.is_file():
                print(f"Baseline file not found: {args.base}", file=sys.stderr)
                return 1
            success = compress_incremental(filepath, args.base, dry_run=args.dry_run)
            backup = backup_path_for(filepath, incremental=True)
        else:
            success = compress_file(filepath)
            backup = backup_path_for(filepath)
        if success:
            print(f"Compressed: {filepath}\nBackup:     {backup}")
            return 0
        print("Compression did not modify the file.", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Interrupted by user", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
