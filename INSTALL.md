# Install HUI

HUI is product name. `next-token` is npm distribution. Repository source is [`HUI/next-token`](https://github.com/HUI/next-token).

| Layer | Value | Use |
|---|---|---|
| Product | **HUI** | Plugins, skills, `/hui`, global `hui` command |
| npm distribution | `next-token` | `npx -y next-token -- ...` |
| Repository | `HUI/next-token` | GitHub, marketplaces, skills source |

One installer supports listed AI coding agents. Installation and runtime capabilities depend on host integration and detection.

If just want it to work, run the one-liner. If want to know what gets touched, scroll down.

## npm install

```bash
# Run latest public package without global install
npx -y next-token -- --help

# Install HUI command globally
npm install -g next-token
hui --help

# Pin one immutable release
npx -y next-token@<version> -- --dry-run --all
```

`next-token@<version>` fetches hook assets from matching immutable Git tag `v<version>` and verifies downloaded hook files against committed SHA-256 manifest. `npx -y next-token` follows npm `latest` tag.

## One-liner

**macOS / Linux / WSL / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/HUI/next-token/main/install.sh | bash
```

**Windows (PowerShell 5.1+)**

```powershell
irm https://raw.githubusercontent.com/HUI/next-token/main/install.ps1 | iex
```

> Piping a script straight into a shell runs it sight-unseen. If you'd rather read it first, download then run: `curl -fsSL https://raw.githubusercontent.com/HUI/next-token/main/install.sh -o install.sh` (review it) `&& bash install.sh`. The installer downloads hook files from a pinned release tag and verifies them against a committed SHA-256 manifest before writing.

What it does:

- Auto-detects every supported agent installed on your machine (Claude Code, Cursor, Codex, etc.).
- For each one, runs that agent's native install path (plugin / extension / rule file / `npx skills add`).
- Wires Claude Code hooks and statusline badge on top. (`hui-shrink` MCP middleware is opt-in via `--with-mcp-shrink` — see flag table below.)
- Skips unsupported or undetected targets. Safe to re-run.

Want to preview before installing? Use `--dry-run`:

```bash
curl -fsSL https://raw.githubusercontent.com/HUI/next-token/main/install.sh | bash -s -- --dry-run
```

## Per-agent install

If you want to install for one agent (or want to know exactly what command runs under the hood), use the table below. Every row also works as `--only <id>` to the unified installer.

| Agent | Install command | Auto-activates? |
|---|---|:-:|
| **Claude Code** | `claude plugin marketplace add HUI/next-token && claude plugin install hui@hui` | Yes |
| **Gemini CLI** | `gemini extensions install https://github.com/HUI/next-token` | Yes |
| **opencode** | `node bin/install.js --only opencode` *(or `npx -y next-token -- --only opencode`)* | Yes (plugin + AGENTS.md) |
| **OpenClaw** | `npx -y next-token -- --only openclaw` | Yes (workspace skill + SOUL.md) |
| **Hermes Agent** | `npx -y next-token -- --only hermes` *(or `node bin/install.js --only hermes` from a clone)* | Yes (native skills, enabled on load) |
| **Codex CLI** | `npx skills add HUI/next-token -a codex` | Per-session: `/hui` |
| **Cursor** | `npx skills add HUI/next-token -a cursor` | Per-session by default; `--with-init` for an always-on rule file |
| **Windsurf** | `npx skills add HUI/next-token -a windsurf` | Per-session by default; `--with-init` for an always-on rule file |
| **Cline** | `npx skills add HUI/next-token -a cline` | Per-session by default; `--with-init` for an always-on rule file |
| **GitHub Copilot** *(soft probe)* | `npx -y next-token -- --only copilot --with-init` | Repo-wide instructions via `--with-init` |
| **Continue** | `npx skills add HUI/next-token -a continue` | No — say `/hui` |
| **Kilo Code** | `npx skills add HUI/next-token -a kilo` | No |
| **Roo Code** | `npx skills add HUI/next-token -a roo` | No |
| **Augment Code** | `npx skills add HUI/next-token -a augment` | No |
| **Aider Desk** | `npx skills add HUI/next-token -a aider-desk` | No |
| **Sourcegraph Amp** | `npx skills add HUI/next-token -a amp` | No |
| **IBM Bob** | `npx skills add HUI/next-token -a bob` | No |
| **Crush** | `npx skills add HUI/next-token -a crush` | No |
| **Devin (terminal)** | `npx skills add HUI/next-token -a devin` | No |
| **Droid (Factory)** | `npx skills add HUI/next-token -a droid` | No |
| **ForgeCode** | `npx skills add HUI/next-token -a forgecode` | No |
| **Block Goose** | `npx skills add HUI/next-token -a goose` | No |
| **iFlow CLI** | `npx skills add HUI/next-token -a iflow-cli` | No |
| **Kiro CLI** | `npx skills add HUI/next-token -a kiro-cli` | No |
| **Mistral Vibe** | `npx skills add HUI/next-token -a mistral-vibe` | No |
| **OpenHands** | `npx skills add HUI/next-token -a openhands` | No |
| **Qwen Code** | `npx skills add HUI/next-token -a qwen-code` | No |
| **Atlassian Rovo Dev** | `npx skills add HUI/next-token -a rovodev` | No |
| **Tabnine CLI** | `npx skills add HUI/next-token -a tabnine-cli` | No |
| **Trae** | `npx skills add HUI/next-token -a trae` | No |
| **Warp** | `npx skills add HUI/next-token -a warp` | No |
| **Replit Agent** | `npx skills add HUI/next-token -a replit` | No |
| **JetBrains Junie** *(soft probe)* | `npx skills add HUI/next-token -a junie` | No |
| **Qoder** *(soft probe)* | `npx skills add HUI/next-token -a qoder` | No |
| **Google Antigravity** *(soft probe)* | `npx skills add HUI/next-token -a antigravity` | No |

"Soft probe" = installer won't auto-detect these without `--only <id>` because there's no reliable always-on signal (Copilot subscription state is auth-gated; the others have no CLI / config-dir-only). Pass the flag when you want them.

For "auto-activates? No" agents, type `/hui` once per session (or use natural-language triggers like "talk like hui", "hui mode").

**Finding a profile slug for `npx skills add ... -a <profile>`?** Either read the table above, or print the live matrix from the installer:

```bash
# Either of these works (install.sh / install.ps1 are thin shims that
# forward all flags to bin/install.js):
bash install.sh --list             # macOS / Linux / WSL, from a local clone
pwsh install.ps1 --list            # Windows / PowerShell, from a local clone
node bin/install.js --list         # any platform, from a local clone
npx -y next-token -- --list   # no clone needed
```

Each row prints the agent id, profile slug (where applicable), and whether it was auto-detected on your machine. Full agent matrix (with detection rules) is also defined in `bin/install.js` under the `PROVIDERS` array.

## Manual install (no `curl | bash`)

If you'd rather see exactly what runs:

```bash
# Clone into explicit HUI directory
git clone https://github.com/HUI/next-token.git hui
cd hui

# Preview every command the installer would run
node bin/install.js --dry-run --all

# Inspect the agent matrix
node bin/install.js --list

# Install for everything detected
node bin/install.js --all
```

Useful flags:

| Flag | What |
|---|---|
| `--all` | Plugin + hooks + statusline + per-repo rule files in `$PWD`. (MCP shrink is opt-in — see `--with-mcp-shrink` below.) |
| `--minimal` | Plugin / extension only. No hooks, no MCP shrink, no per-repo rules. |
| `--only <id>` | One agent only. Repeatable: `--only claude --only cursor`. |
| `--dry-run` | Print every command. Write nothing. |
| `--with-init` | Drop always-on rule files into the current repo (`.cursor/`, `.windsurf/`, `.clinerules/`, `.github/copilot-instructions.md`, `.opencode/AGENTS.md`, `AGENTS.md`) and, if OpenClaw is on the box, append the bootstrap block to `~/.openclaw/workspace/SOUL.md`. |
| `--with-mcp-shrink="<upstream cmd>"` | Register `hui-shrink` MCP proxy wrapping the given upstream MCP server. **Off by default.** A value is required — hui-shrink is a proxy and exits immediately without one. Example: `--with-mcp-shrink="npx @modelcontextprotocol/server-filesystem /tmp"`. The value is split on whitespace; for paths-with-spaces, install via `node bin/install.js` from a clone or edit `~/.claude.json` after a stub install. |
| `--no-mcp-shrink` | Skip MCP-shrink registration. (Default.) |
| `--with-hooks` / `--no-hooks` | Force-on or force-off the Claude Code hook installer. (Default: on.) |
| `--skip-skills` | Don't run the npx-skills auto-detect fallback when nothing else matched. |
| `--config-dir <path>` | Claude Code config dir for hook files + `settings.json`. **Does NOT scope** `claude plugin install`, `gemini extensions install`, opencode (`XDG_CONFIG_HOME`), or openclaw (`OPENCLAW_WORKSPACE`) — those use their own paths. Default: `$CLAUDE_CONFIG_DIR` or `~/.claude`. `~` is expanded. |
| `--non-interactive` | Never prompt; use defaults. (Auto when stdin is not a TTY.) |
| `--no-color` | Disable ANSI colors. |
| `--list` | Print full agent matrix and exit. |
| `--force` | Re-run even if already installed. |
| `--uninstall` | Remove everything. See below. |

## HUI commands

- `/hui` and `/hui-global`: enable persistent full output compression for future replies in Claude Code. They do not rewrite prior messages, host context, or prompt cache.
- `/hui-session`: local read-only transcript summary. Add `--compact` to write a validated `*.hui-compact.jsonl` sibling copy. Original transcript remains untouched. Claude Code only.

Gemini CLI and OpenCode install portable prompt commands only. They do not expose `/hui-session` or `/hui-stats`; those require Claude Code local hook, transcript, and session-log contracts.

## Always-on rules

For agents without a hook system (Cursor, Windsurf, Cline, Copilot, and friends), the always-on path is a static rule file. Two ways:

```bash
# Drop rule files into the current repo
node bin/install.js --with-init

# Or pull the rule body straight in (manual)
curl -fsSL https://raw.githubusercontent.com/HUI/next-token/main/src/rules/hui-activate.md \
  > .cursor/rules/hui.mdc   # or .windsurf/rules/hui.md, .clinerules/hui.md, .github/copilot-instructions.md
```

`--with-init` writes the rule into every supported per-agent location it can detect (`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, `.github/copilot-instructions.md`, `.opencode/AGENTS.md`, `AGENTS.md`). It also installs the OpenClaw workspace bootstrap (skill folder + SOUL.md marker block) when `~/.openclaw/workspace/` exists. Single source: [`src/rules/hui-activate.md`](src/rules/hui-activate.md).

## Verify

After install, three quick checks:

**1. See what got installed.**

```bash
node bin/install.js --list
```

You should see ~30 rows. Detected agents are marked. Anything you wanted but isn't marked → not detected (likely the binary isn't on `PATH`).

**2. Talk to Claude Code.**

Open Claude Code, type `/hui`. Response should be terse fragments — "Got it. Hui mode on." or similar. Try a real question: "What is closures in JS?" — answer should drop articles and read like grunts.

**3. Check the flag file.**

```bash
cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.hui-active"
# expected output: full
```

If it's missing or empty, the SessionStart hook didn't fire. See troubleshooting below.

Statusline should show `[HUI]` (orange) at bottom of Claude Code while mode is active.

## Uninstall

```bash
npx -y next-token -- --uninstall
```

What it removes:

- Hui hook entries from `$CLAUDE_CONFIG_DIR/settings.json` (default `~/.claude/`; matched by the substring `hui`).
- Hook files in `$CLAUDE_CONFIG_DIR/hooks/` (`hui-activate.js`, `hui-mode-tracker.js`, `hui-stats.js`, `hui-config.js`, `hui-statusline.{sh,ps1}`, plus the dir's `package.json` marker).
- The Claude Code plugin and the Gemini CLI extension (if installed).
- The opencode native plugin (`~/.config/opencode/plugins/hui/`, the `plugin` and `mcp.hui-shrink` entries from `opencode.json`, our skill/agent/command files, the hui block from `AGENTS.md`, and the opencode flag file).
- The OpenClaw workspace skill folder and the marker-fenced block from `~/.openclaw/workspace/SOUL.md` (when present).
The installer maintains `$CLAUDE_CONFIG_DIR/hui-install-manifest.json` for standalone Claude hook files. Uninstall removes manifest-owned files only when their recorded SHA-256 digest still matches; user-modified files are preserved and reported.

What it does **not** remove:

- Skills installed via `npx skills add` — the `skills` CLI manages those. Run `npx skills remove hui` (or use your IDE's skill manager).
- Per-repo rule files written by `--with-init` (`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, `.github/copilot-instructions.md`, `.opencode/AGENTS.md`, `AGENTS.md`). Delete by hand if you want.

## Troubleshooting

**"Install script broke. What now?"**

Open your agent in this repo and say:

> "Read CLAUDE.md and INSTALL.md. Install hui for me."

Agent read repo. Agent run install. Hui make agent talk less — agent first job is install hui to talk less. Snake eat tail.

Still broken? [Open an issue](https://github.com/HUI/next-token/issues).

**"I ran the installer but Claude Code isn't talking hui."**

1. Run `node bin/install.js --list` — confirm `claude` is on the detected list. If not, `claude` isn't on `PATH`. Fix that first.
2. Open `$CLAUDE_CONFIG_DIR/settings.json` (default `~/.claude/settings.json`) and look for `"hooks"` containing `hui-activate.js` and `hui-mode-tracker.js`. If missing, re-run with `--force`.
3. Check `$CLAUDE_CONFIG_DIR/.hui-active` exists with content `full`. If not, the SessionStart hook silent-failed — check `$CLAUDE_CONFIG_DIR/hooks/` for the JS files and try `node $CLAUDE_CONFIG_DIR/hooks/hui-activate.js < /dev/null` to see if it errors.
4. Restart Claude Code. The SessionStart hook only fires on session start, not mid-session.

**"Hooks failing on Windows."**

- Use `install.ps1`, not `install.sh`. Git Bash works for the shell version, but the hook side wires PowerShell counterparts (`hui-statusline.ps1`).
- PowerShell 5.1 minimum. Check with `$PSVersionTable.PSVersion`.
- If `irm | iex` blocks on execution policy: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` for the install session, then re-run.
- Long-running issues: see `docs/install-windows.md` in the repo for manual fallback.

**"My `settings.json` got mangled."**

The installer uses a JSONC-tolerant parser (`bin/lib/settings.js`) so comments and trailing commas don't crash the merge. It also runs `validateHookFields()` before every write so a malformed hook can't poison the file. If something still went wrong:

1. Check for a backup at `$CLAUDE_CONFIG_DIR/settings.json.bak` (installer writes one before any merge).
2. If no backup, restore from your shell history or version control.
3. File an issue with the broken `settings.json` content (redacted) — that file passing validation but breaking Claude Code is a bug we want to fix.

**"I'm in a managed env where I can't install hooks."**

Use the rule-file-only path. Hooks are Claude Code-specific; everything else works via static rule files:

```bash
# Just install for one agent, no Claude hooks
node bin/install.js --only cursor

# Or write rule files into the current repo only (no global state)
node bin/install.js --with-init --only cursor --only windsurf
```

This drops `.cursor/rules/hui.mdc` (and friends) into your repo. No hooks, no global config, nothing outside the repo.

**"`npx skills add` errored on a profile slug."**

The profile slug must exist in [vercel-labs/skills](https://github.com/vercel-labs/skills). If a row in the table above 404s, the upstream profile was renamed or removed — open an issue, we'll update.

## Privacy

The installer doesn't phone home. It writes to:

- `$CLAUDE_CONFIG_DIR` (default `~/.claude/`) — hooks, flag file, `settings.json` merge.
- Each agent's own config location — Cursor's `.cursor/rules/`, Windsurf's `.windsurf/rules/`, opencode's `~/.config/opencode/`, etc.
- Your current working directory (only with `--with-init`) — repo-local rule files.
- `~/.openclaw/workspace/` (only with `--only openclaw` or `--with-init` when OpenClaw is detected) — the one `--with-init` side-effect outside the cwd.

No telemetry. No analytics. Run from a clone or via npx, the installer's own code makes no network calls — files are copied locally. One exception: run detached from any checkout (the rare curl-fallback path), it downloads the hook files from raw.githubusercontent.com pinned to an immutable release tag and verifies each against a SHA-256 manifest before wiring anything. Network requests also happen indirectly through the per-agent CLIs it shells out to — `claude plugin marketplace add`, `claude plugin install`, `gemini extensions install`, `npm view hui-shrink`, and `npx -y skills add`. Each fetches from its own registry (Anthropic / GitHub / npm). Source: [`bin/install.js`](bin/install.js). After install: zero network calls, ever — full statement in [SECURITY.md](./SECURITY.md#privacy--telemetry).

---

Stuck? Open an issue: <https://github.com/HUI/next-token/issues>
