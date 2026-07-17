#!/usr/bin/env python3
"""Compression orchestration with validated, atomic replacement and backups."""

import difflib
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List

from .detect import should_compress
from .validate import validate, validate_text

MAX_FILE_SIZE = 500_000
MAX_RETRIES = 2
OUTER_FENCE_REGEX = re.compile(r"\A\s*(`{3,}|~{3,})[^\n]*\n(.*)\n\1\s*\Z", re.DOTALL)
FRONTMATTER_REGEX = re.compile(r"\A(---\r?\n.*?\r?\n---\r?\n)(.*)", re.DOTALL)
SENSITIVE_BASENAME_REGEX = re.compile(
    r"(?ix)^(\.env(\..+)?|\.netrc|credentials(\..+)?|secrets?(\..+)?|passwords?(\..+)?|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|authorized_keys|known_hosts|.*\.(pem|key|p12|pfx|crt|cer|jks|keystore|asc|gpg))$"
)
SENSITIVE_PATH_COMPONENTS = frozenset({".ssh", ".aws", ".gnupg", ".kube", ".docker"})
SENSITIVE_NAME_TOKENS = ("secret", "credential", "password", "passwd", "apikey", "accesskey", "token", "privatekey")


def status(message: str) -> None:
    try:
        print(message)
    except UnicodeEncodeError:
        print(message.encode("ascii", "replace").decode("ascii"))


def backup_dir_for(filepath: Path) -> Path:
    """Return a stable out-of-tree backup directory unique to the source path."""
    if os.name == "nt" or sys.platform == "win32":
        data_dir = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        data_dir = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    source_id = hashlib.sha256(str(filepath.parent).encode("utf-8")).hexdigest()[:16]
    return data_dir / "hui-compress" / "backups" / f"{filepath.parent.name}-{source_id}"


def backup_path_for(filepath: Path, incremental: bool = False) -> Path:
    suffix = ".incremental.original.md" if incremental else ".original.md"
    return backup_dir_for(filepath) / f"{filepath.stem}{suffix}"


def is_sensitive_path(filepath: Path) -> bool:
    if SENSITIVE_BASENAME_REGEX.match(filepath.name):
        return True
    if {part.lower() for part in filepath.parts} & SENSITIVE_PATH_COMPONENTS:
        return True
    normalized = re.sub(r"[_\-\s.]", "", filepath.name.lower())
    return any(token in normalized for token in SENSITIVE_NAME_TOKENS)


def atomic_write(path: Path, content: str, *, overwrite: bool = True) -> None:
    """Write content to a sibling temp file then atomically publish it.

    An exclusive publish is used for backups, so concurrent compression cannot
    silently replace a recovery copy.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, text=True)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if overwrite:
            os.replace(temp_path, path)
        else:
            try:
                os.link(temp_path, path)
            except FileExistsError:
                raise RuntimeError(f"Refusing to overwrite existing backup: {path}")
            finally:
                temp_path.unlink(missing_ok=True)
        if path.read_text(encoding="utf-8") != content:
            raise RuntimeError(f"Atomic write verification failed: {path}")
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise


def write_backup(path: Path, original: str) -> None:
    atomic_write(path, original, overwrite=False)


def split_frontmatter(text: str):
    match = FRONTMATTER_REGEX.match(text)
    return (match.group(1), match.group(2)) if match else ("", text)


def strip_llm_wrapper(text: str) -> str:
    match = OUTER_FENCE_REGEX.match(text)
    return match.group(2) if match else text


def call_claude(prompt: str) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model=os.environ.get("HUI_MODEL", "claude-opus-4-8"),
                max_tokens=8192,
                thinking={"type": "adaptive"},
                output_config={"effort": "high"},
                messages=[{"role": "user", "content": prompt}],
            )
            return strip_llm_wrapper("".join(block.text for block in message.content if block.type == "text").strip())
        except ImportError:
            pass
    result = subprocess.run(
        [shutil.which("claude") or "claude", "--print"], input=prompt,
        text=True, capture_output=True, check=True, encoding="utf-8", errors="replace",
    )
    return strip_llm_wrapper(result.stdout.strip())


def build_compress_prompt(original: str) -> str:
    return f"""Compress this markdown into hui format.

STRICT RULES:
- Do NOT modify anything inside fenced code blocks or inline backticks.
- Preserve ALL URLs, markdown links, file paths, environment variables, headings,
  lists, tables, and numbered-list structure exactly.
- Return ONLY compressed markdown. Do not add an outer markdown fence.

Only compress natural language.

TEXT:
{original}
"""


def build_fix_prompt(original: str, compressed: str, errors: List[str]) -> str:
    errors_text = "\n".join(f"- {error}" for error in errors)
    return f"""Fix only these validation errors in compressed markdown; do not recompress or rephrase other text.

ERRORS:
{errors_text}

ORIGINAL:
{original}

COMPRESSED:
{compressed}

Return only corrected markdown.
"""


def _check_input(filepath: Path) -> str:
    if not filepath.exists() or not filepath.is_file():
        raise FileNotFoundError(f"File not found: {filepath}")
    if filepath.stat().st_size > MAX_FILE_SIZE:
        raise ValueError(f"File too large to compress safely (max 500KB): {filepath}")
    if is_sensitive_path(filepath):
        raise ValueError("Refusing sensitive path; compression sends prose to an external model")
    if not should_compress(filepath):
        raise ValueError("File is not a supported natural-language file")
    text = filepath.read_text(encoding="utf-8", errors="ignore")
    return text


def _valid_candidate(original: str, candidate: str) -> tuple[bool, str]:
    if not candidate or not candidate.strip():
        return False, "model returned empty output"
    if candidate.strip() == original.strip():
        return False, "model returned unchanged output"
    result = validate_text(original, candidate)
    if not result.is_valid:
        return False, "; ".join(result.errors)
    return True, ""


def preview_file(filepath: Path) -> str:
    """Generate and validate a full-file preview without modifying disk."""
    filepath = filepath.resolve()
    original = _check_input(filepath)
    frontmatter, body = split_frontmatter(original)
    if not body.strip():
        raise ValueError("Refusing to compress frontmatter-only file")
    candidate = frontmatter + call_claude(build_compress_prompt(body))
    valid, reason = _valid_candidate(original, candidate)
    if not valid:
        raise RuntimeError(f"Preview rejected: {reason}")
    return candidate


def compress_file(filepath: Path) -> bool:
    filepath = filepath.resolve()
    original = _check_input(filepath)
    backup_path = backup_path_for(filepath)
    if not original.strip():
        status("Refusing to compress: file is empty or whitespace-only.")
        return False
    if backup_path.exists():
        status(f"Backup already exists: {backup_path}")
        return False
    frontmatter, body = split_frontmatter(original)
    if not body.strip():
        status("Refusing to compress: body is empty after frontmatter removal.")
        return False
    candidate = frontmatter + call_claude(build_compress_prompt(body))
    for attempt in range(MAX_RETRIES):
        valid, reason = _valid_candidate(original, candidate)
        if valid:
            try:
                write_backup(backup_path, original)
                atomic_write(filepath, candidate)
                return True
            except Exception:
                backup_path.unlink(missing_ok=True)
                raise
        if attempt == MAX_RETRIES - 1:
            status(f"Compression rejected: {reason}")
            return False
        candidate = call_claude(build_fix_prompt(original, candidate, [reason]))
    return False


def is_protected_markdown_line(line: str) -> bool:
    stripped = line.lstrip()
    return (not line.strip() or line.startswith(("#", "```", "~~~", "    ", "\t", "<")) or
            stripped.startswith((">", "|", "-", "*", "+")) or
            re.match(r"\d+[.)]\s", stripped) is not None or "|" in line)


def changed_prose_blocks(base: str, current: str) -> list[tuple[int, int, str]]:
    current_lines, base_lines = current.splitlines(keepends=True), base.splitlines(keepends=True)
    offsets = [0]
    for line in current_lines:
        offsets.append(offsets[-1] + len(line))
    blocks = []
    for _, _, _, start, end in difflib.SequenceMatcher(a=base_lines, b=current_lines, autojunk=False).get_opcodes():
        if start == end:
            continue
        while start > 0 and not is_protected_markdown_line(current_lines[start - 1]):
            start -= 1
        while end < len(current_lines) and not is_protected_markdown_line(current_lines[end]):
            end += 1
        lines = current_lines[start:end]
        if lines and all(not is_protected_markdown_line(line) for line in lines):
            candidate = (offsets[start], offsets[end], "".join(lines))
            if candidate not in blocks:
                blocks.append(candidate)
    return blocks


def compress_incremental(filepath: Path, base_path: Path, dry_run: bool = False) -> bool:
    filepath, base_path = filepath.resolve(), base_path.resolve()
    current, base = _check_input(filepath), _check_input(base_path)
    blocks = changed_prose_blocks(base, current)
    if not blocks:
        print("No changed prose blocks; nothing to compress.")
        return True
    print(f"Changed prose blocks: {len(blocks)}")
    if dry_run:
        return True
    updated = current
    for start, end, block in reversed(blocks):
        compressed = call_claude(build_compress_prompt(block))
        if not compressed or not compressed.strip() or compressed.strip() == block.strip():
            raise RuntimeError("Incremental compression returned empty or unchanged block")
        updated = updated[:start] + compressed + updated[end:]
    valid, reason = _valid_candidate(current, updated)
    if not valid:
        raise RuntimeError(f"Incremental compression rejected: {reason}")
    backup_path = backup_path_for(filepath, incremental=True)
    write_backup(backup_path, current)
    try:
        atomic_write(filepath, updated)
    except Exception:
        backup_path.unlink(missing_ok=True)
        raise
    return True


def restore_file(filepath: Path, incremental: bool = False) -> Path:
    filepath = filepath.resolve()
    backup_path = backup_path_for(filepath, incremental=incremental)
    if not backup_path.is_file():
        raise FileNotFoundError(f"Backup not found: {backup_path}")
    original = backup_path.read_text(encoding="utf-8")
    if not original.strip():
        raise RuntimeError(f"Refusing to restore empty backup: {backup_path}")
    atomic_write(filepath, original)
    return backup_path
