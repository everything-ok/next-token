"""
Read eval snapshots and report real token compression per skill against the
*terse control arm* — how much the skill adds on top of a plain "Answer
concisely." instruction.

Reports median, min, max and stdev across prompts, not just the mean, so the
reader can see whether a number is solid or noisy.

Supports:
  - single-model snapshot: evals/snapshots/results.json
  - multi-model snapshot:  evals/snapshots/results-by-model.json (from llm_run.py
    with HUI_EVAL_MODELS=m1,m2,...). Produces a per-model table plus a
    cross-model summary.
  - fidelity pass-rate merge: if evals/snapshots/fidelity.json exists (from
    fidelity.py), each skill row gains a fidelity column. Hard-gate pass rate
    is shown next to compression so "shorter" never silently means "wrong".

Tokenizer note: tiktoken o200k_base is OpenAI's tokenizer and is only an
approximation of Claude's BPE. Ratios are meaningful for comparing skills
against each other; absolute numbers are approximate.

Run:
  uv run --with tiktoken python evals/measure.py
  uv run --with tiktoken python evals/measure.py --json   # machine output
"""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

import tiktoken

ENCODING = tiktoken.get_encoding("o200k_base")
EVALS = Path(__file__).parent
SNAPSHOT = EVALS / "snapshots" / "results.json"
MULTI_SNAPSHOT = EVALS / "snapshots" / "results-by-model.json"
FIDELITY = EVALS / "snapshots" / "fidelity.json"


def count(text: str) -> int:
    return len(ENCODING.encode(text))


def stats(savings: list[float]) -> tuple[float, float, float, float, float]:
    return (
        statistics.median(savings),
        statistics.mean(savings),
        min(savings),
        max(savings),
        statistics.stdev(savings) if len(savings) > 1 else 0.0,
    )


def fmt_pct(x: float) -> str:
    sign = "−" if x < 0 else "+"
    return f"{sign}{abs(x) * 100:.0f}%"


def load_fidelity() -> dict:
    """Map (model_key, skill) -> pass_rate. model_key None = single snapshot."""
    if not FIDELITY.exists():
        return {}
    data = json.loads(FIDELITY.read_text(encoding="utf-8"))
    out: dict[tuple, float] = {}
    if "models" in data:  # multi-model fidelity (future)
        for model, payload in data["models"].items():
            for skill, info in payload.get("arms", {}).items():
                out[(model, skill)] = info.get("pass_rate")
    else:
        for skill, info in data.get("arms", {}).items():
            out[(None, skill)] = info.get("pass_rate")
    return out


def skill_rows(arms: dict, terse_tokens: list[int]) -> list[dict]:
    rows = []
    for skill, outputs in arms.items():
        if skill in ("__baseline__", "__terse__"):
            continue
        skill_tokens = [count(o) for o in outputs]
        savings = [1 - (s / t) if t else 0.0 for s, t in zip(skill_tokens, terse_tokens)]
        med, mean, lo, hi, sd = stats(savings)
        rows.append({
            "skill": skill,
            "median": med, "mean": mean, "min": lo, "max": hi, "stdev": sd,
            "skill_tokens": sum(skill_tokens), "terse_tokens": sum(terse_tokens),
        })
    rows.sort(key=lambda r: -r["median"])
    return rows


def print_table(meta: dict, rows: list[dict], fidelity: dict, model_key=None) -> None:
    baseline_tokens = meta.get("_baseline_tokens")
    terse_tokens = meta.get("_terse_tokens")
    print(f"_Generated: {meta.get('generated_at', '?')}_")
    print(f"_Model: {meta.get('model', '?')} · CLI: {meta.get('claude_cli_version', '?')}_")
    print("_Tokenizer: tiktoken o200k_base (approximation of Claude's BPE)_")
    print(f"_n = {meta.get('n_prompts', '?')} prompts, single run per arm_")
    print()
    if baseline_tokens is not None and terse_tokens is not None:
        print("**Reference arms (no skill):**")
        print(f"- baseline (no system prompt): {baseline_tokens} tokens total")
        print(f"- terse control (`Answer concisely.`): {terse_tokens} tokens total "
              f"({fmt_pct(1 - terse_tokens / baseline_tokens) if baseline_tokens else 'n/a'} vs baseline)")
        print()
    print("**Skills, measured as additional reduction on top of the terse control:**")
    print()
    header = "| Skill | Median | Mean | Min | Max | Stdev | Tokens (skill / terse) | Fidelity |"
    print(header)
    print("|-------|--------|------|-----|-----|-------|-------------------------|----------|")
    for r in rows:
        fr = fidelity.get((model_key, r["skill"]))
        fid = f"{fr * 100:.0f}%" if isinstance(fr, (int, float)) else "—"
        print(f"| **{r['skill']}** | {fmt_pct(r['median'])} | {fmt_pct(r['mean'])} | "
              f"{fmt_pct(r['min'])} | {fmt_pct(r['max'])} | {r['stdev'] * 100:.0f}% | "
              f"{r['skill_tokens']} / {r['terse_tokens']} | {fid} |")
    print()
    print("_Savings = `1 - skill_tokens / terse_tokens` per prompt._")
    print("_Fidelity = hard-gate pass rate (literals + no self-announcement); — if fidelity.py not run._")


def measure_single(fidelity: dict, as_json: bool) -> None:
    if not SNAPSHOT.exists():
        print(f"No snapshot at {SNAPSHOT}. Run `python evals/llm_run.py` first.")
        return
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    arms = data["arms"]
    meta = dict(data.get("metadata", {}))
    terse_tokens = [count(o) for o in arms["__terse__"]]
    meta["_baseline_tokens"] = sum(count(o) for o in arms["__baseline__"])
    meta["_terse_tokens"] = sum(terse_tokens)
    rows = skill_rows(arms, terse_tokens)
    if as_json:
        for r in rows:
            r["fidelity"] = fidelity.get((None, r["skill"]))
        print(json.dumps({"model": meta.get("model"), "metadata": meta, "skills": rows}, ensure_ascii=False, indent=2))
    else:
        print_table(meta, rows, fidelity)


def measure_multi(fidelity: dict, as_json: bool) -> None:
    if not MULTI_SNAPSHOT.exists():
        if as_json:
            print(json.dumps({"models": {}}))
        else:
            print(f"No multi-model snapshot at {MULTI_SNAPSHOT}. "
                  "Run `HUI_EVAL_MODELS=m1,m2 python evals/llm_run.py` first.")
        return
    data = json.loads(MULTI_SNAPSHOT.read_text(encoding="utf-8"))
    models = data.get("models", {})
    all_rows = {}
    summary = []
    for model_key, payload in models.items():
        arms = payload["arms"]
        meta = dict(payload.get("metadata", {}))
        terse_tokens = [count(o) for o in arms["__terse__"]]
        meta["_baseline_tokens"] = sum(count(o) for o in arms["__baseline__"])
        meta["_terse_tokens"] = sum(terse_tokens)
        rows = skill_rows(arms, terse_tokens)
        all_rows[model_key] = {"metadata": meta, "skills": rows}
        for r in rows:
            summary.append({
                "model": model_key, "skill": r["skill"],
                "median": r["median"], "mean": r["mean"],
                "fidelity": fidelity.get((model_key, r["skill"])),
            })
    if as_json:
        print(json.dumps({"models": all_rows, "summary": summary}, ensure_ascii=False, indent=2))
        return
    for model_key, payload in all_rows.items():
        print(f"\n## Model: {model_key}\n")
        print_table(payload["metadata"], payload["skills"], fidelity, model_key)
    if len(all_rows) > 1:
        print("\n## Cross-model summary (median compression / fidelity)\n")
        print("| Model | Skill | Median | Fidelity |")
        print("|-------|-------|--------|----------|")
        for s in sorted(summary, key=lambda x: (x["skill"], x["model"])):
            fid = f"{s['fidelity'] * 100:.0f}%" if isinstance(s["fidelity"], (int, float)) else "—"
            print(f"| {s['model']} | {s['skill']} | {fmt_pct(s['median'])} | {fid} |")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()
    fidelity = load_fidelity()
    if MULTI_SNAPSHOT.exists():
        measure_multi(fidelity, args.json)
    else:
        measure_single(fidelity, args.json)


if __name__ == "__main__":
    main()
