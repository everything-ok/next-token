#!/usr/bin/env python3
import re
from collections import Counter
from pathlib import Path

URL_REGEX = re.compile(r"https?://[^\s)]+")
FENCE_OPEN_REGEX = re.compile(r"^(\s{0,3})(`{3,}|~{3,})(.*)$")
HEADING_REGEX = re.compile(r"^(#{1,6})\s+(.*)", re.MULTILINE)
BULLET_REGEX = re.compile(r"^(\s*)([-*+])\s+", re.MULTILINE)
ORDERED_LIST_REGEX = re.compile(r"^(\s*)\d+[.)]\s+", re.MULTILINE)
TABLE_ROW_REGEX = re.compile(r"^\s*\|?.*\|.*\|\s*$", re.MULTILINE)
MARKDOWN_LINK_REGEX = re.compile(r"!?\[[^\]]*\]\([^)]*\)")
ENV_VAR_REGEX = re.compile(r"(?<![\w$])\$?[A-Z][A-Z0-9_]{1,}")
PATH_REGEX = re.compile(r"(?:\./|\.\./|/|[A-Za-z]:\\)[\w\-/\\.]+|[\w\-.]+[/\\][\w\-/\\.]+")
FRONTMATTER_REGEX = re.compile(r"\A---\r?\n.*?\r?\n---\r?\n", re.DOTALL)


class ValidationResult:
    def __init__(self):
        self.is_valid = True
        self.errors = []
        self.warnings = []

    def add_error(self, msg):
        self.is_valid = False
        self.errors.append(msg)

    def add_warning(self, msg):
        self.warnings.append(msg)


def read_file(path: Path) -> str:
    return path.read_text(errors="ignore")


def extract_headings(text):
    return [(level, title.strip()) for level, title in HEADING_REGEX.findall(text)]


def extract_frontmatter(text):
    match = FRONTMATTER_REGEX.match(text)
    return match.group(0) if match else ""


def extract_code_blocks(text):
    """Extract closed fenced blocks exactly, including their fence lines."""
    blocks = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        match = FENCE_OPEN_REGEX.match(lines[i])
        if not match:
            i += 1
            continue
        fence_char, fence_len = match.group(2)[0], len(match.group(2))
        block = [lines[i]]
        i += 1
        while i < len(lines):
            close = FENCE_OPEN_REGEX.match(lines[i])
            block.append(lines[i])
            i += 1
            if (close and close.group(2)[0] == fence_char and
                    len(close.group(2)) >= fence_len and not close.group(3).strip()):
                blocks.append("\n".join(block))
                break
    return blocks


def text_outside_fences(text):
    """Blank fenced regions while retaining line positions for other extractors."""
    lines = text.splitlines(keepends=True)
    output, fence = [], None
    for line in lines:
        match = FENCE_OPEN_REGEX.match(line.rstrip("\r\n"))
        if fence is None and match:
            fence = (match.group(2)[0], len(match.group(2)))
            output.append("\n" if line.endswith("\n") else "")
        elif fence is not None:
            output.append("\n" if line.endswith("\n") else "")
            if (match and match.group(2)[0] == fence[0] and
                    len(match.group(2)) >= fence[1] and not match.group(3).strip()):
                fence = None
        else:
            output.append(line)
    return "".join(output)


def extract_urls(text):
    return Counter(URL_REGEX.findall(text_outside_fences(text)))


def extract_paths(text):
    return Counter(PATH_REGEX.findall(text_outside_fences(text)))


def extract_markdown_links(text):
    return Counter(MARKDOWN_LINK_REGEX.findall(text_outside_fences(text)))


def extract_env_vars(text):
    return Counter(ENV_VAR_REGEX.findall(text_outside_fences(text)))


def extract_inline_codes(text):
    text = text_outside_fences(text)
    # Backtick runs may contain a single backtick; match the same delimiter length.
    return re.findall(r"(?<!`)`([^`]+)`(?!`)", text)


def list_structure(text):
    outside = text_outside_fences(text)
    bullets = [(len(indent.expandtabs(4)), marker) for indent, marker in BULLET_REGEX.findall(outside)]
    ordered = [len(indent.expandtabs(4)) for indent in ORDERED_LIST_REGEX.findall(outside)]
    tables = [line.count("|") for line in outside.splitlines() if TABLE_ROW_REGEX.match(line)]
    return bullets, ordered, tables


def _require_equal(label, original, compressed, result):
    if original != compressed:
        result.add_error(f"{label} not preserved exactly")


def validate_headings(orig, comp, result):
    _require_equal("Headings", extract_headings(orig), extract_headings(comp), result)


def validate_code_blocks(orig, comp, result):
    _require_equal("Code blocks", extract_code_blocks(orig), extract_code_blocks(comp), result)


def validate_frontmatter(orig, comp, result):
    _require_equal("YAML frontmatter", extract_frontmatter(orig), extract_frontmatter(comp), result)


def validate_urls(orig, comp, result):
    _require_equal("URLs", extract_urls(orig), extract_urls(comp), result)


def validate_paths(orig, comp, result):
    _require_equal("File paths", extract_paths(orig), extract_paths(comp), result)


def validate_markdown_links(orig, comp, result):
    _require_equal("Markdown links", extract_markdown_links(orig), extract_markdown_links(comp), result)


def validate_env_vars(orig, comp, result):
    _require_equal("Environment variables", extract_env_vars(orig), extract_env_vars(comp), result)


def validate_inline_codes(orig, comp, result):
    original, compressed = Counter(extract_inline_codes(orig)), Counter(extract_inline_codes(comp))
    lost = {code: count - compressed[code] for code, count in original.items() if compressed[code] < count}
    added = {code: count - original[code] for code, count in compressed.items() if original[code] < count}
    if lost:
        result.add_error(f"Inline code lost: {lost}")
    if added:
        result.add_warning(f"Inline code added: {added}")


def validate_structure(orig, comp, result):
    original_bullets, original_ordered, original_tables = list_structure(orig)
    compressed_bullets, compressed_ordered, compressed_tables = list_structure(comp)
    _require_equal("Bullet hierarchy", original_bullets, compressed_bullets, result)
    _require_equal("Numbered-list hierarchy", original_ordered, compressed_ordered, result)
    _require_equal("Table column structure", original_tables, compressed_tables, result)


def validate_text(original: str, compressed: str) -> ValidationResult:
    result = ValidationResult()
    validate_frontmatter(original, compressed, result)
    validate_headings(original, compressed, result)
    validate_code_blocks(original, compressed, result)
    validate_urls(original, compressed, result)
    validate_markdown_links(original, compressed, result)
    validate_paths(original, compressed, result)
    validate_env_vars(original, compressed, result)
    validate_inline_codes(original, compressed, result)
    validate_structure(original, compressed, result)
    return result


def validate(original_path: Path, compressed_path: Path) -> ValidationResult:
    return validate_text(read_file(original_path), read_file(compressed_path))


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python validate.py <original> <compressed>")
        sys.exit(1)
    res = validate(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
    print(f"\nValid: {res.is_valid}")
    for label, items in (("Errors", res.errors), ("Warnings", res.warnings)):
        if items:
            print(f"\n{label}:")
            for item in items:
                print(f"  - {item}")
