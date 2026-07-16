# huicrew

Decision guide. When to delegate to hui subagents instead of doing the work inline.

## What it does

Tells the main thread when to spawn a hui-style subagent versus the vanilla equivalent. The win: subagent tool-results inject back into main context verbatim, and hui output is roughly 1/3 the size of vanilla prose. Across 20 delegations in one session, that is the difference between context exhaustion and finishing the task.

Three subagents:

| Subagent | Job | Use when |
|----------|-----|----------|
| `huicrew-investigator` | Locate code (read-only) | "Where is X defined / what calls Y / list uses of Z" |
| `huicrew-builder` | Surgical edit, 1-2 files | Scope is obvious, ≤2 files. Refuses 3+ file scope. |
| `huicrew-reviewer` | Diff/file review | One-line findings with severity emoji |

Use vanilla `Explore` or `Code Reviewer` when you want prose, architecture commentary, or rationale. Use main thread directly for one-line answers and 3+ file refactors.

This skill is a decision guide, not a slash command. It activates when the conversation mentions delegation.

## How to invoke

Triggers on phrases like "delegate to subagent", "use huicrew", "spawn investigator", "save context", "compressed agent output".

## Example chaining

Locate → fix → verify (most common):

1. `huicrew-investigator` returns site list (`path:line — symbol — note`)
2. Main thread picks 1-2 sites, hands paths to `huicrew-builder`
3. `huicrew-reviewer` audits the resulting diff

Parallel scout: spawn 2-3 `huicrew-investigator` calls in one message with different angles (defs, callers, tests). Aggregate in main.

## Model overrides

By default, `huicrew-reviewer` and `huicrew-investigator` pin `model: haiku` in their frontmatter; `huicrew-builder` has no `model:` line (uses the API session default). Set env vars in your shell before launching Claude Code to override per-agent:

| Env var | Agent |
|---|---|
| `HUICREW_REVIEWER_MODEL` | `huicrew-reviewer` |
| `HUICREW_BUILDER_MODEL` | `huicrew-builder` |
| `HUICREW_INVESTIGATOR_MODEL` | `huicrew-investigator` |

Example — run reviewer on sonnet, keep others on default:

```sh
export HUICREW_REVIEWER_MODEL=sonnet
```

Use the same model name strings you'd use in any Claude Code agent frontmatter (e.g. `haiku`, `sonnet`, `opus`).

Overrides patch only the `model:` line in the installed agent's frontmatter; the prompt body is untouched and keeps receiving upstream updates. Plugin installs only — standalone hook installs have no local agent files to patch. Unset or blank = no change. The patch persists in the installed file until the plugin is updated or reinstalled.

## See also

- [`SKILL.md`](./SKILL.md) — full decision matrix and output contracts
- [`agents/huicrew-investigator.md`](../../agents/huicrew-investigator.md)
- [`agents/huicrew-builder.md`](../../agents/huicrew-builder.md)
- [`agents/huicrew-reviewer.md`](../../agents/huicrew-reviewer.md)
- [Hui README](../../README.md) — repo overview
