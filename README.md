# HUI

HUI makes AI coding-agent replies shorter while preserving technical substance.

## Identity

| Layer | Value | Purpose |
|---|---|---|
| Product | **HUI** | Plugins, skills, `/hui`, hooks, statusline, global `hui` command |
| npm distribution | `next-token` | Registry package and `npx` installation entry |
| Repository | [`2454760302hui/next-token`](https://github.com/2454760302hui/next-token) | Source, releases, marketplace and skills source |

## Install

```bash
npx -y next-token -- --help
npx -y next-token -- --dry-run --all
```

After global installation, use brand command:

```bash
hui --help
```

`hui` is a package bin alias. Use `next-token` with `npx`; do not assume an npm package named `hui` exists.

See [INSTALL.md](INSTALL.md) for agent-specific installation, [TODO.md](TODO.md) for roadmap, and [LICENSE](LICENSE) for terms.
