# HUI limitations

HUI is a writing-style toolkit. It asks coding agents to use concise technical prose and provides local file-rewriting utilities with backups and structural validation.

## What HUI does not measure

HUI does not publish or calculate user-facing claims about token savings, pricing, latency, accuracy, model reasoning, or provider quotas. `/hui-stats` reports only token counts observed in local Claude Code session logs.

Provider accounting and response behavior vary by model, plan, prompt, tools, and context. Compare provider-reported usage for a specific workload if measurement is needed.

## Local file rewriting

`/hui-compress` transforms supported natural-language files. It preserves a `.original.md` backup and validates protected structure such as code blocks, URLs, paths, headings, and tables. Review generated file content before relying on it.

## Clarity and safety

HUI returns to normal prose for security warnings, irreversible confirmations, ambiguous multi-step instructions, and clarification requests. Code, commits, and PR descriptions remain normal.
