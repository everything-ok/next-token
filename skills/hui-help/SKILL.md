---
name: hui-help
description: >
  Quick-reference card for all hui modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /hui-help,
  "hui help", "what hui commands", "how do I use hui".
---

# Hui Help

Display this reference card when invoked. One-shot — do NOT change mode, write flag files, or persist anything. Output in hui style.

## Modes

| Mode | Trigger | What change |
|------|---------|-------------|
| **Lite** | `/hui lite` | Drop filler. Keep sentence structure. |
| **Full** | `/hui` | Drop articles, filler, pleasantries, hedging. Fragments OK. Default. |
| **Ultra** | `/hui ultra` | Extreme compression. Bare fragments. Tables over prose. |
| **Wenyan-Lite** | `/hui wenyan-lite` | Classical Chinese style, light compression. |
| **Wenyan-Full** | `/hui wenyan` | Full 文言文. Maximum classical terseness. |
| **Wenyan-Ultra** | `/hui wenyan-ultra` | Extreme. Ancient scholar on a budget. |

Mode stick until changed or session end.

## Skills

| Skill | Trigger | What it do |
|-------|---------|-----------|
| **hui-commit** | `/hui-commit` | Terse commit messages. Conventional Commits. ≤50 char subject. |
| **hui-review** | `/hui-review` | One-line PR comments: `L42: bug: user null. Add guard.` |
| **hui-compress** | `/hui-compress <file>` | Compress .md files to hui prose. Saves ~46% input tokens. |
| **hui-help** | `/hui-help` | This card. |

## Deactivate

Say "stop hui" or "normal mode". Resume anytime with `/hui`.

## Language

Keep user's language by default. User write Portuguese → reply Portuguese hui. Compress the style, not the language. Technical terms, code, commands, commit types, and exact error strings stay verbatim unless user ask for translation.

## Configure Default Mode

Default mode = `full`. Change it:

**Environment variable** (highest priority):
```bash
export HUI_DEFAULT_MODE=ultra
```

**Config file** (`~/.config/hui/config.json`):
```json
{ "defaultMode": "lite" }
```

Set `"off"` to disable auto-activation on session start. User can still activate manually with `/hui`.

Resolution: env var > config file > `full`.

## Product and Distribution

**HUI** is product name: plugins, skills, `/hui`, hooks, statusline, and global `hui` command. **`next-token`** is npm distribution name. Install with `npx -y next-token -- ...`; do not assume npm package `hui` exists.

## More

Full docs: https://github.com/2454760302hui/next-token
