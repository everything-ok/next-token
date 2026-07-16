#!/usr/bin/env python3
"""Smoke-test the npm tarball in isolation without installing providers."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "package/package.json", "package/bin/install.js", "package/bin/lib/settings.js",
    "package/bin/lib/openclaw.js", "package/bin/lib/brand.js", "package/src/hooks/hui-activate.js",
    "package/skills/hui/SKILL.md", "package/agents/huicrew-investigator.md",
    "package/plugins/hui/.codex-plugin/plugin.json", "package/commands/hui.md",
    "package/dist/hui.skill", "package/README.md", "package/LICENSE",
)


def command(name: str) -> str:
    resolved = shutil.which(name)
    if resolved:
        return resolved
    if os.name == "nt":
        resolved = shutil.which(f"{name}.cmd")
        if resolved:
            return resolved
    raise RuntimeError(f"Required command not found: {name}")


def run(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    args = [command(args[0]), *args[1:]]
    result = subprocess.run(args, cwd=cwd, text=True, encoding="utf-8", capture_output=True)
    if result.returncode:
        raise RuntimeError(f"{' '.join(args)} failed:\n{result.stdout}\n{result.stderr}")
    return result


def main() -> int:
    packed = run(["npm", "pack", "--json"], ROOT)
    tarball = ROOT / json.loads(packed.stdout)[0]["filename"]
    try:
        with tempfile.TemporaryDirectory(prefix="hui-package-smoke-") as temp:
            target = Path(temp)
            with tarfile.open(tarball, "r:gz") as archive:
                names = set(archive.getnames())
                missing = [entry for entry in REQUIRED if entry not in names]
                if missing:
                    raise RuntimeError("tarball missing: " + ", ".join(missing))
                archive.extractall(target, filter="data")
            package = target / "package"
            for args in (
                ["node", "bin/install.js", "--help"],
                ["node", "bin/install.js", "--list"],
                ["node", "bin/install.js", "--dry-run", "--only", "codex", "--non-interactive"],
            ):
                result = run(args, package)
                if args[-1] == "--help" and ("HUI installer" not in result.stdout or "next-token" not in result.stdout):
                    raise RuntimeError("tarball help lacks HUI/npm identity")
    finally:
        tarball.unlink(missing_ok=True)
    print("Package smoke passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
