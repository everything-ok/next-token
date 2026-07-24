#!/usr/bin/env python3
"""Synchronize generated HUI skill mirrors from canonical sources.

Use --check in CI to fail when committed mirrors drift. Every managed mirror is
built from ``skills/`` and ``agents/``; stale managed files are detected too.
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = ROOT.parent
SKILL_NAMES = ("hui", "hui-commit", "hui-compress", "hui-constraints", "hui-help", "hui-review", "hui-stats", "huicrew")
HOST_MIRRORS = (".agents", ".augment", ".iflow", ".kiro", ".qwen")


def display_path(path: Path) -> Path:
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path.relative_to(WORKSPACE_ROOT)


def atomic_write(target: Path, content: bytes) -> None:
    """Replace one generated asset without exposing a partial target file."""
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix=f".{target.name}.", delete=False) as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
        temporary = Path(handle.name)
    try:
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def source_files(source: Path) -> dict[Path, bytes]:
    return {
        path.relative_to(source): path.read_bytes()
        for path in sorted(source.rglob("*"))
        if path.is_file() and "__pycache__" not in path.parts
    }


def sync_tree(source: Path, target: Path, check: bool) -> bool:
    """Mirror source exactly, including detection/removal of stale managed files."""
    changed = False
    expected = source_files(source)
    for relative, content in expected.items():
        destination = target / relative
        if destination.exists() and destination.read_bytes() == content:
            continue
        if check:
            print(f"drift: {display_path(destination)}")
        else:
            atomic_write(destination, content)
            print(f"sync: {display_path(destination)}")
        changed = True

    return changed


def copy_file(source: Path, target: Path, check: bool) -> bool:
    expected = source.read_bytes()
    if target.exists() and target.read_bytes() == expected:
        return False
    if check:
        print(f"drift: {display_path(target)}")
    else:
        atomic_write(target, expected)
        print(f"sync: {display_path(target)}")
    return True


def build_skill_zip(check: bool) -> bool:
    target = ROOT / "dist" / "hui.skill"
    with tempfile.TemporaryDirectory(dir=target.parent if target.parent.exists() else None) as tmp:
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
    else:
        atomic_write(target, expected)
        print("sync: dist/hui.skill")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument(
        "--workspace-mirror",
        action="store_true",
        help="also sync the monorepo-level ../.agents mirror (default off; only meaningful inside a monorepo checkout)",
    )
    args = parser.parse_args()
    changed = False

    for skill in SKILL_NAMES:
        changed |= sync_tree(ROOT / "skills" / skill, ROOT / "plugins" / "hui" / "skills" / skill, args.check)
    for agent in sorted((ROOT / "agents").glob("huicrew-*.md")):
        changed |= copy_file(agent, ROOT / "plugins" / "hui" / "agents" / agent.name, args.check)

    for host in HOST_MIRRORS:
        for skill in SKILL_NAMES:
            changed |= sync_tree(ROOT / "skills" / skill, ROOT / host / "skills" / skill, args.check)

    # The workspace-level ../.agents mirror only exists inside the HUI monorepo
    # checkout. When next-token is cloned standalone (e.g. release CI), the
    # parent directory has no .agents mirror, so syncing it there would always
    # report drift. Only run it when explicitly requested.
    if args.workspace_mirror:
        for skill in SKILL_NAMES:
            changed |= sync_tree(ROOT / "skills" / skill, WORKSPACE_ROOT / ".agents" / "skills" / skill, args.check)

    changed |= build_skill_zip(args.check)
    if args.check and changed:
        print("Generated mirrors drift. Run: python scripts/sync_assets.py")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
