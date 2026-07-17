# hui-help

Quick-reference card. One shot, no mode change.

## What it does

Prints a cheat sheet of all hui modes, sibling skills, deactivation triggers, and how to set the default mode via env var or config file. One-shot display — does not flip the active mode, write flag files, or persist anything. Use when you forget the slash commands.

## How to invoke

```
/hui-help
```

Also triggers on "hui help", "what hui commands", "how do I use hui".

## Example output

```
Modes:
  /hui              full (default)
  /hui lite         lighter
  /hui ultra        extreme
  /hui wenyan       classical Chinese

Skills:
  /hui-commit       terse Conventional Commits
  /hui-review       one-line PR comments
  /hui demo         本地文本示例
  /hui-stats        observed local session usage

Deactivate:
  "stop hui" or "normal mode"
```

## See also

- [`SKILL.md`](./SKILL.md) — full reference card
- [Hui README](../../README.md) — repo overview
