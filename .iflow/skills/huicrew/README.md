# huicrew

Decision guide for concise subagent roles.

## What it does

Huicrew defines three narrow roles for code location, small edits, and review findings. Each requests terse structured output so the main thread can quickly consume file locations, edit receipts, or ranked findings.

Huicrew does not measure or guarantee token, context, cost, latency, or quality outcomes. Host-specific agent names and tool contracts depend on the installed integration.

| Subagent | Job | Use when |
|---|---|---|
| `huicrew-investigator` | Locate code, read-only | Definitions, callers, references, directory maps |
| `huicrew-builder` | Surgical edit, 1–2 files | Scope is obvious and bounded |
| `huicrew-reviewer` | Diff/file review | Need concise severity-ranked findings |

## How to invoke

Use phrases such as:

```text
use huicrew
spawn investigator
find all uses of X
review this diff
```

## Typical flow

1. Investigator locates candidate sites.
2. Builder edits one or two selected files.
3. Reviewer checks resulting diff.

Use a host exploration or code-review workflow when detailed rationale, broad architecture work, or more than two files are required.

## Model overrides

Plugin installs can override per-agent frontmatter models before launching Claude Code:

| Environment variable | Agent |
|---|---|
| `HUICREW_REVIEWER_MODEL` | `huicrew-reviewer` |
| `HUICREW_BUILDER_MODEL` | `huicrew-builder` |
| `HUICREW_INVESTIGATOR_MODEL` | `huicrew-investigator` |

```sh
export HUICREW_REVIEWER_MODEL=sonnet
```

Overrides alter only the installed agent's `model:` line. Unset or blank values make no change.

## See also

- [`SKILL.md`](./SKILL.md) — full decision guide and output contracts
- [`agents/huicrew-investigator.md`](../../agents/huicrew-investigator.md)
- [`agents/huicrew-builder.md`](../../agents/huicrew-builder.md)
- [`agents/huicrew-reviewer.md`](../../agents/huicrew-reviewer.md)
