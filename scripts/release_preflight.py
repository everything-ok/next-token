#!/usr/bin/env python3
"""Offline release integrity checks for HUI."""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOKS = ROOT / "src" / "hooks"
INSTALLER = ROOT / "bin" / "install.js"


def _normalize_lf(data: bytes) -> bytes:
    """Normalize CRLF/CR to LF so the checksum is stable across CRLF and LF
    checkouts (the committed manifest stores LF digests)."""
    if b"\r" not in data:
        return data
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def main() -> int:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    installer = INSTALLER.read_text(encoding="utf-8")
    expected_ref = f"v{package['version']}"
    if "const PACKAGE_VERSION = require('../package.json').version;" not in installer:
        raise RuntimeError("Installer must load PACKAGE_VERSION from package.json")
    if "const PINNED_REF = process.env.HUI_REF || `v${PACKAGE_VERSION}`;" not in installer:
        raise RuntimeError("Installer must derive PINNED_REF from PACKAGE_VERSION")
    release_tag = os.environ.get("RELEASE_TAG")
    if release_tag and release_tag != expected_ref:
        raise RuntimeError(f"Release tag {release_tag} must equal package release tag {expected_ref}")

    manifest: dict[str, str] = {}
    for line in (HOOKS / "checksums.sha256").read_text(encoding="utf-8").splitlines():
        if line.strip():
            digest, name = line.split(maxsplit=1)
            manifest[name] = digest
    hook_files = re.search(r"const HOOK_FILES = \[(.*?)\];", installer, re.S)
    if not hook_files:
        raise RuntimeError("Could not locate HOOK_FILES")
    required = re.findall(r"'([^']+)'", hook_files.group(1))
    missing = sorted(set(required) - set(manifest))
    if missing:
        raise RuntimeError("Checksum manifest missing: " + ", ".join(missing))
    for name in required:
        actual = hashlib.sha256(_normalize_lf((HOOKS / name).read_bytes())).hexdigest()
        if manifest[name] != actual:
            raise RuntimeError(f"Checksum mismatch: {name}")
    print(f"Release preflight passed for {package['name']} {package['version']} ({expected_ref})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
