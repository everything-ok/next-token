# hui-compress

Rewrite supported natural-language files into concise HUI-style prose.

## What it does

```
/hui-compress CLAUDE.md
```

```
CLAUDE.md          ← rewritten copy
CLAUDE.original.md ← human-readable backup
```

Original content remains in `.original.md`. Edit backup, then run skill again when needed.

`hui-compress` is a text transformation tool. It does not promise token, cost, latency, or accuracy results.

## Safety and validation

The tool only accepts supported natural-language files. It preserves and validates:

- Code blocks and inline code
- URLs, links, file paths, and commands
- Technical terms, library names, and API names
- Headings, dates, version numbers, and numeric values
- Table structure

Workflow:

```
/hui-compress CLAUDE.md
        ↓
detect file type
        ↓
rewrite natural-language content
        ↓
validate headings, code blocks, URLs, paths, and bullets
        ↓
patch validated issues only; retry up to two times
        ↓
write rewritten file and original backup
```

## Supported files

| Type | Supported? |
|------|------------|
| `.md`, `.txt`, `.rst`, `.typ`, `.typst`, `.tex` | Yes |
| Extensionless natural language | Yes |
| `.py`, `.js`, `.ts`, `.json`, `.yaml` | No — code/config |
| `*.original.md` | No — backup |

## Usage

```
/hui-compress <filepath>
```

Examples:

```
/hui-compress CLAUDE.md
/hui-compress docs/preferences.md
/hui-compress todos.md
```

## Security

The skill performs file I/O and invokes local tooling to rewrite and validate requested files. See [SECURITY.md](./SECURITY.md) for boundaries and safeguards.

## Install

Compress ships with HUI. Install once, then use `/hui-compress`.

Requires Python 3.10+.

## Part of HUI

- **hui** — concise technical communication modes
- **hui-compress** — validated local natural-language file rewriting
