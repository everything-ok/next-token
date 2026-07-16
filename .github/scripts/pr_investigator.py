#!/usr/bin/env python3
"""Produce deterministic PR impact report without network or secrets."""
from __future__ import annotations
import argparse
from pathlib import Path

RULES = (
    ("bin/", "Installer", "node --test tests/installer/*.test.mjs"),
    ("src/hooks/", "Hooks", "node tests/test_huicrew_model_overrides.js"),
    ("agents/", "Huicrew agents", "python scripts/sync_assets.py --check"),
    ("skills/", "Skills", "python scripts/sync_assets.py --check"),
    ("skills/hui-compress/", "Compression", "python -m unittest tests/test_compress_safety.py"),
    ("evals/", "Evaluations", "python evals/fidelity.py"),
)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="*")
    args = parser.parse_args()
    hits = []
    for prefix, area, test in RULES:
        if any(path.startswith(prefix) for path in args.files):
            hits.append((area, test))
    print("## Huicrew investigator report")
    print("\n### Changed files")
    for path in args.files or ["No changed files supplied."]:
        print(f"- `{path}`")
    print("\n### Impact")
    if not hits:
        print("- No mapped high-risk surface.")
    for area, test in hits:
        print(f"- {area}: run `{test}`")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
