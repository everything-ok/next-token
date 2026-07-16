#!/usr/bin/env python3
"""Deterministic fidelity gates for committed eval snapshots.

Checks literals that must survive compression and flags response self-announcements
such as "HUI MODE ACTIVE". No provider call or credential is required.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

EVALS = Path(__file__).parent
DEFAULT_SNAPSHOT = EVALS / "snapshots" / "results.json"
SELF_REFERENCE = re.compile(r"\bhui\s+(?:mode|style)\s+(?:active|on|enabled)\b", re.I)


def literals(prompt: str) -> list[str]:
    """Extract literal code, URLs, paths and numbers a response must not alter."""
    pattern = re.compile(r"`(?P<code>[^`]+)`|(?P<url>https?://[^\s)]+)|(?P<path>[A-Za-z]:[\\/][^\s]+|/[\w./-]+)|(?P<number>\b\d+(?:\.\d+)?\b)")
    return [next(value for value in match.groupdict().values() if value) for match in pattern.finditer(prompt)]


def evaluate(prompt: str, output: str) -> dict:
    required = literals(prompt)
    missing = [value for value in required if value not in output]
    return {
        "verdict": "pass" if not missing and not SELF_REFERENCE.search(output) else "fail",
        "missing_literals": missing,
        "self_reference": bool(SELF_REFERENCE.search(output)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--output", type=Path, default=EVALS / "snapshots" / "fidelity.json")
    args = parser.parse_args()
    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    report = {"source": args.snapshot.name, "arms": {}}
    for arm, outputs in data["arms"].items():
        if arm.startswith("__"):
            continue
        checks = [evaluate(prompt, output) for prompt, output in zip(data["prompts"], outputs)]
        report["arms"][arm] = {
            "pass_rate": sum(item["verdict"] == "pass" for item in checks) / len(checks) if checks else 0,
            "checks": checks,
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
