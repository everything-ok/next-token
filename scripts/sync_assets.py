#!/usr/bin/env python3
"""Synchronize generated HUI skill mirrors from canonical sources.

Use --check in CI to fail when committed mirrors drift.
"""
from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = ROOT.parent
SKILL_NAMES = ("hui", "hui-commit", "hui-compress", "hui-help", "hui-review", "hui-stats", "huicrew")
HOST_MIRRORS = (".agents", ".augment", ".iflow", ".kiro")


def display_path(path: Path) -> Path:
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path.relative_to(WORKSPACE_ROOT)


def copy_file(source: Path, target: Path, check: bool) -> bool:
    expected = source.read_bytes()
    if target.exists() and target.read_bytes() == expected:
        return False
    if check:
        print(f"drift: {display_path(target)}")
        return True
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(expected)
    print(f"sync: {display_path(target)}")
    return True


def sync_tree(source: Path, target: Path, check: bool) -> bool:
    changed = False
    for path in sorted(source.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts:
            continue
        changed |= copy_file(path, target / path.relative_to(source), check)
    return changed


def build_skill_zip(check: bool) -> bool:
    target = ROOT / "dist" / "hui.skill"
    with tempfile.TemporaryDirectory() as tmp:
        candidate = Path(tmp) / "hui.skill"
        with zipfile.ZipFile(candidate, "w", zipfile.ZIP_DEFLATED) as archive:
            source = ROOT / "skills" / "hui"
            for path in sorted(source.rglob("*")):
                if path.is_file() and "__pycache__" not in path.parts:
                    info = zipfile.ZipInfo(path.relative_to(ROOT / "skills").as_posix())
                    info.date_time = (1980, 1, 1, 0, 0, 0)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    archive.writestr(info, path.read_bytes())
        expected = candidate.read_bytes()
    if target.exists() and target.read_bytes() == expected:
        return False
    if check:
        print("drift: dist/hui.skill")
        return True
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(expected)
    print("sync: dist/hui.skill")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    changed = False

    # Codex plugin gets all canonical skills plus Huicrew agent definitions.
    for skill in SKILL_NAMES:
        changed |= sync_tree(ROOT / "skills" / skill, ROOT / "plugins" / "hui" / "skills" / skill, args.check)
    for agent in sorted((ROOT / "agents").glob("huicrew-*.md")):
        changed |= copy_file(agent, ROOT / "plugins" / "hui" / "agents" / agent.name, args.check)

    # Agent-host mirrors contain skills only. Keep them byte-identical to source.
    for host in HOST_MIRRORS:
        for skill in SKILL_NAMES:
            changed |= sync_tree(ROOT / "skills" / skill, ROOT / host / "skills" / skill, args.check)

    # Root workspace .agents is another published skill host, outside hui-main.
    for skill in SKILL_NAMES:
        changed |= sync_tree(ROOT / "skills" / skill, WORKSPACE_ROOT / ".agents" / "skills" / skill, args.check)

    changed |= build_skill_zip(args.check)
    if args.check and changed:
        print("Generated mirrors drift. Run: python scripts/sync_assets.py")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
