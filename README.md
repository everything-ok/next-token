# HUI

HUI makes AI coding-agent replies shorter while preserving technical substance.

## Identity

| Layer | Value | Purpose |
|---|---|---|
| Product | **HUI** | Plugins, skills, `/hui`, hooks, statusline, global `hui` command |
| npm distribution | `next-token-hui` | Registry package and `npx` installation entry |
| Repository | [`everything-ok/next-token`](https://github.com/everything-ok/next-token) | Source, releases, marketplace and skills source |

## Install

After first npm release, install with:

```bash
# Run current public npm release without global install
npx -y next-token-hui -- --help
npx -y next-token-hui -- --dry-run --all

# Install command globally (gives you the `hui` terminal command)
npm install -g next-token-hui
hui --help

# Pin exact release for reproducible installation
npx -y next-token-hui@<version> -- --dry-run --all
```

> `npx -y next-token-hui` runs the installer but does **not** install the `hui` terminal command — `npx` is a one-shot runner. To type `hui` directly in your terminal, install globally with `npm install -g next-token-hui` first. This is separate from the Claude Code `/hui` slash command, which works inside a Claude Code session after install (no global install needed for that).

After global installation, use brand command:

```bash
hui --help
```

`hui` is a package bin alias. Use `next-token-hui` with `npx`; do not assume an npm package named `hui` exists.

## Project-rule conflict check

Before initializing HUI rules in an existing repository, scan the managed rule targets without changing files:

```bash
node src/tools/hui-init.js /path/to/repo --check-conflicts
node src/tools/hui-init.js /path/to/repo --check-conflicts --json
```

The scanner reports existing managed target files that do not contain HUI's installation sentinel. It exits `0` when no conflicts exist and `1` when conflicts are found, which makes it suitable for CI. Human and JSON reports are path-sorted; `--only <agent>` limits the scan. It never writes, appends, or overwrites files. Resolve a reported rule manually, or use `hui-init.js --force` only when replacing it is intentional.

See [INSTALL.md](INSTALL.md) for agent-specific installation, [TODO.md](TODO.md) for roadmap, and [LICENSE](LICENSE) for terms.

## Command support

Claude Code supports full HUI command lifecycle. `/hui` and `/hui-global` keep full compression active for future replies; they do not rewrite existing conversation history, context, or cache. `/hui-session --compact` creates validated sibling transcript copy and never modifies original Claude Code transcript.

Gemini and OpenCode receive portable prompt commands. Hook-dependent `/hui-session` and `/hui-stats` remain Claude Code only until host adapters expose verified local transcript and session-log contracts.
