# Security

## Snyk High Risk Rating

`hui-compress` can be rated high risk by static analysis because it invokes a model client and rewrites files. This document defines its boundaries.

## What triggers the rating

1. **Model invocation**: the skill calls the `claude` CLI through `subprocess.run()` when `ANTHROPIC_API_KEY` is unavailable. The subprocess uses a fixed argument list; user file content is passed on stdin, never interpolated into a shell command.

2. **File read/write**: the skill reads only the user-selected source file. Full and incremental compression write an out-of-tree backup under the platform data directory, then atomically replace the source only after deterministic validation. `--restore` atomically restores the matching backup.

## What the skill does not do

- Does not execute user file content as code.
- Does not use `shell=True` or string interpolation for subprocess execution.
- Does not scan arbitrary project files.
- Does not overwrite an existing backup.
- Does not modify a source or create a backup in `--preview` or `--dry-run` modes.
- Does not claim token, cost, latency, or accuracy outcomes.

## Data boundary

Compression sends mutable prose from the chosen file to Claude through the configured SDK or CLI. Sensitive file names and known private-path components are rejected before read. Review the selected path and generated preview before applying a rewrite.

## Safe workflow

```bash
python3 -m scripts --preview /absolute/path/to/notes.md
python3 -m scripts /absolute/path/to/notes.md
python3 -m scripts --restore /absolute/path/to/notes.md
```

`--dry-run --incremental --base <baseline>` reports eligible changed prose without a model call or write. `--preview` generates and validates a full-file candidate in memory. Backups are stored outside the source directory to avoid auto-loading backup text as active agent instructions.

## Limits

- Files larger than 500KB are rejected before a model call.
- Code/config extensions and unsupported files are skipped.
- Structure validation protects designated content, but users must still review semantic changes before relying on a rewritten document.

## Reporting a vulnerability

Open a GitHub issue labeled `security` with reproduction details that do not expose credentials or sensitive file content.
