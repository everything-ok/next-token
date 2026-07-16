# Hui Hooks

These hooks are **bundled with the hui plugin** and activate automatically when the plugin is installed. No manual setup required.

If you installed hui standalone (without the plugin), the unified Node installer at `bin/install.js` wires them into your `settings.json` for you — run `node bin/install.js --only claude` from a clone, or `npx -y next-token -- --only claude` for the curl-pipe path.

## What's Included

### `hui-activate.js` — SessionStart hook

- Runs once when Claude Code starts
- Writes `full` to `$CLAUDE_CONFIG_DIR/.hui-active` (default `~/.claude/.hui-active`) via the symlink-safe `safeWriteFlag` helper
- Emits hui rules as hidden SessionStart context
- Detects missing statusline config and emits setup nudge (Claude will offer to help)

### `hui-mode-tracker.js` — UserPromptSubmit hook

- Fires on every user prompt, checks for `/hui` commands and natural-language activation/deactivation phrases ("talk like hui", "stop hui", "normal mode")
- Writes the active mode to the flag file when a hui command is detected; deletes it on deactivation
- Emits a small per-turn reinforcement reminder when the flag is set to a non-independent mode (`lite`/`full`/`ultra`/`wenyan*`)
- Supports: `lite`, `full`, `ultra`, `wenyan`, `wenyan-lite`, `wenyan-full`, `wenyan-ultra`, `commit`, `review`, `compress`

### `hui-statusline.sh` / `hui-statusline.ps1` — Statusline badge script

- Reads `$CLAUDE_CONFIG_DIR/.hui-active` (default `~/.claude/.hui-active`) and outputs a colored badge
- Shows `[HUI]`, `[HUI:ULTRA]`, `[HUI:WENYAN]`, etc.
- Appends the lifetime savings suffix `⛏ 12.4k` from `$CLAUDE_CONFIG_DIR/.hui-statusline-suffix` (written by `hui-stats.js` on each `/hui-stats` run; absent until the first run, so fresh installs render no fake number). Opt out with `HUI_STATUSLINE_SAVINGS=0`.

## Statusline Badge

The statusline badge shows which hui mode is active directly in your Claude Code status bar.

**Plugin users:** If you do not already have a `statusLine` configured, Claude will detect that on your first session after install and offer to set it up for you. Accept and you're done.

If you already have a custom statusline, hui does not overwrite it and Claude stays quiet. Add the badge snippet to your existing script instead.

**Standalone users:** the unified installer (`bin/install.js`, invoked by the `install.sh` / `install.ps1` shims at the repo root) wires the statusline automatically if you do not already have a custom statusline. If you do, the installer leaves it alone and prints the merge note.

**Manual setup:** If you need to configure it yourself, add one of these to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash /path/to/hui-statusline.sh"
  }
}
```

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -ExecutionPolicy Bypass -File C:\\path\\to\\hui-statusline.ps1"
  }
}
```

Replace the path with the actual script location (e.g. `~/.claude/hooks/` for standalone installs, or the plugin install directory for plugin installs).

**Custom statusline:** If you already have a statusline script, add this snippet to it:

```bash
hui_text=""
hui_flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.hui-active"
if [ -f "$hui_flag" ]; then
  hui_mode=$(cat "$hui_flag" 2>/dev/null)
  if [ "$hui_mode" = "full" ] || [ -z "$hui_mode" ]; then
    hui_text=$'\033[38;5;172m[HUI]\033[0m'
  else
    hui_suffix=$(echo "$hui_mode" | tr '[:lower:]' '[:upper:]')
    hui_text=$'\033[38;5;172m[HUI:'"${hui_suffix}"$']\033[0m'
  fi
fi
```

Badge examples:
- `/hui` → `[HUI]`
- `/hui ultra` → `[HUI:ULTRA]`
- `/hui wenyan` → `[HUI:WENYAN]`
- `/hui-commit` → `[HUI:COMMIT]`
- `/hui-review` → `[HUI:REVIEW]`

## How It Works

```
SessionStart hook ──writes "full"──▶ $CLAUDE_CONFIG_DIR/.hui-active ◀──writes mode── UserPromptSubmit hook
                                              │
                                           reads
                                              ▼
                                     Statusline script
                                    [HUI:ULTRA] │ ...
```

SessionStart stdout is injected as hidden system context — Claude sees it, users don't. The statusline runs as a separate process. The flag file is the bridge.

## Uninstall

If installed via plugin: disable the plugin — hooks deactivate automatically.

If installed via the standalone Node installer:
```bash
npx -y next-token -- --uninstall
# or, from a clone:
node bin/install.js --uninstall
```

Or manually:
1. Remove the hui hook files from `$CLAUDE_CONFIG_DIR/hooks/` (default `~/.claude/hooks/`): `hui-activate.js`, `hui-mode-tracker.js`, `hui-stats.js`, `hui-config.js`, and `hui-statusline.{sh,ps1}`.
2. Remove the SessionStart, UserPromptSubmit, and statusLine entries from `$CLAUDE_CONFIG_DIR/settings.json`.
3. Delete `$CLAUDE_CONFIG_DIR/.hui-active` (and `$CLAUDE_CONFIG_DIR/.hui-statusline-suffix` if you ran `/hui-stats`).
