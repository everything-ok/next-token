# hui-stats

Observed local Claude Code session usage.

## What it does

Reads current Claude Code session log and reports values recorded there:

- reply turns
- output tokens
- cache-read input tokens

Output comes from `hui-mode-tracker` hook, which intercepts `/hui-stats` and returns local formatted data. Model does not compute numbers.

`/hui-stats` does not estimate token savings, cost, latency, accuracy, or a non-HUI baseline. Each run stores observed totals locally for `/hui-stats --all` and `/hui-stats --since 7d`.

## How to invoke

```
/hui-stats
/hui-stats --all
/hui-stats --since 7d
```

## Example output

```
本地会话用量
──────────────────────────────────
回复轮次：  47
──────────────────────────────────
输出 token：        3,891
缓存读取 token：    12,304
──────────────────────────────────
仅显示 Claude Code 本地会话日志中的观察值；不推算节省、成本或基线。
```

## See also

- [`SKILL.md`](./SKILL.md) — hook contract and mechanics
- [HUI README](../../README.md) — repository overview
