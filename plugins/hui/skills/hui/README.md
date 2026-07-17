# hui

Concise technical communication mode.

## What it does

HUI removes conversational filler, pleasantries, and hedging while preserving technical terms, code blocks, error strings, and symbols. Mode persists for session until changed or stopped. It is a writing-style preference, not a token, cost, latency, or accuracy measurement tool.

Six intensity levels:

| Level | What change |
|-------|-------------|
| `lite` | Drop filler/hedging. Sentences stay full. Professional but tight. |
| `full` | Default. Drop articles, fragments OK, short synonyms. |
| `ultra` | Bare fragments when meaning stays clear. |
| `wenyan-lite` | Classical Chinese register, light compression. |
| `wenyan-full` | Full 文言文 style. |
| `wenyan-ultra` | Extreme classical terseness. |

Auto-clarity rule: HUI returns to normal prose for security warnings, irreversible-action confirmations, multi-step sequences where fragments could mislead, and repeated clarification requests. Resumes after clear part.

## How to invoke

```
/hui              # full mode (default)
/hui lite         # lighter mode
/hui ultra        # terse mode
/hui wenyan       # classical Chinese mode
/hui demo         # fixed local text example
stop hui          # back to normal prose
```

`/hui demo` shows a fixed **本地文本示例**. It does not call a model or change local mode, session, or usage state.

## Example output

Question: "Why does my React component re-render?"

Normal prose:
> Your component re-renders because you create a new object reference each render. Wrapping it in `useMemo` will fix the issue.

HUI (full):
> New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`.

HUI (ultra):
> Inline object prop, new ref, re-render. `useMemo`.

## See also

- [`SKILL.md`](./SKILL.md) — full LLM-facing instructions
- [HUI README](../../README.md) — repository overview and installation
