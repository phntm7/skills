---
name: frontiercode-benchmark
description: >
  Fetch current FrontierCode 1.1 leaderboard data (cognition.com/frontiercode)
  to compare coding-agent mergeability — pass rate and rubric score, cost per
  rollout, output tokens, and agent harness — across models (Claude
  Fable/Opus/Sonnet, GPT-5.x, Grok, Gemini, Kimi, GLM, DeepSeek, Mistral,
  SWE-*) and reasoning-effort levels. Use when the user mentions FrontierCode,
  mergeability, Cognition's coding benchmark, or harness-specific SWE scores
  (claude-code, codex, grok-build, chisel, mini-swe-agent). For a generic
  "which model should I use?" question, also load deepswe-benchmark — the two
  boards are not interchangeable. Data is cached locally for 24h and
  auto-refreshed.
---

# FrontierCode Benchmark

Get up-to-date FrontierCode leaderboard data for model-selection decisions.
FrontierCode grades **mergeability**: would the maintainer actually merge this
PR? Tasks are authored by the repos' own open-source maintainers and graded
end-to-end (correctness, test quality, scope discipline, style) with unit
tests, rubrics, and verifiers. FrontierCode 1.1 is current; 1.0 is archived
and superseded — never use it.

Related skill: for single-harness pass@k results (mini-swe-agent), load
`deepswe-benchmark` instead. The two boards measure different things and are
not interchangeable.

## Usage

One command; prints a compact markdown leaderboard ranked by pass rate:

```bash
node <skill-dir>/scripts/frontiercode_leaderboard.mjs
```

`<skill-dir>` is this skill's base directory (the folder containing this
SKILL.md). Requires Node >= 18.

Flags:

- `--json` — compact JSON rows instead of markdown (for programmatic filtering
  with `jq`).
- `--fresh` — force a refetch, ignoring the 24h cache. Only use when the user
  explicitly wants the very latest numbers.
- `--version <id>` — benchmark revision (default `v1_1`; do not pass `v1`, it
  is archived and superseded).
- `--subset <main|extended>` — task subset (default `main`, 100 tasks;
  `extended` has 150).
- `--metric <pass|score>` — ranking metric (default `pass`; `score` ranks by
  the rubric score instead).
- `--all` — one row per model × effort level, instead of the default one row
  per model at its best effort.

Caching is automatic: raw data lives in
`${XDG_CACHE_HOME:-~/.cache}/frontiercode-bench/` and refreshes when older than
24h. If the site is unreachable, the script falls back to the stale cache with
a warning on stderr. The output header states whether data was cached or
fetched and which revision/subset it covers.

## Reading the table

- **Pass%** — fraction of trials that satisfy every blocker rubric criterion
  (all-or-nothing per trial). Primary quality metric. Pass% and Score% are
  means over 5 trials per effort level; the default view shows each model's
  best effort, `--all` expands every row.
- **Score%** — weighted aggregate of the rubric items; solutions that fail
  blocking criteria score 0. Correlates with Pass% but rewards partial
  quality.
- **$ Rollout, Tokens** — mean cost (USD) and mean output tokens per rollout.
  Cost reflects this benchmark's workload under each model's harness, not
  general API pricing — use it for relative comparison between rows, not
  absolute budgeting.
- **Flagged%** — share of runs detected consulting solution-bearing sources
  (e.g. the original PR); those runs are scored zero. Only reported in v1_1
  (the field does not exist in v1).
- **Harness** — the agent harness the run used (claude-code, codex,
  grok-build, chisel, cursor-cli, mini-swe-agent). Scores are tied to the
  harness; do not infer raw model ability from a single harness row.

## Recommending a model

- Compare within the question's constraints: best quality regardless of cost
  vs best value. A row a few points below the top at a fraction of the cost is
  usually the better default recommendation.
- Reasoning effort matters as much as model choice — the same model spans huge
  quality/cost ranges across low→max. Quote the effort level with the model,
  and check `--all` when the model has an effort dial.
- The `main` subset is the 100 hardest tasks and Cognition's headline board;
  `extended` adds 50 easier tasks, which inflates every model's numbers (e.g.
  Opus 5: 58.9% main vs 69.6% extended). Use `main` for close calls — it
  discriminates better at the top — and treat `extended` as a sanity check on
  rank order.
- These are mergeability-graded agentic coding scores under a specific
  harness; do not present them as evidence for non-coding abilities (writing,
  vision, etc.) or for how the model would behave in a different harness.
