---
name: frontiercode-benchmark
description: >
  Fetch current FrontierCode leaderboard data (cognition.com/frontiercode) to
  compare coding-agent performance of LLMs — mergeability pass rate and rubric
  score, cost per task, output tokens, and agent harness — across models
  (Claude Fable/Opus/Sonnet, GPT-5.x, Grok, Gemini, Kimi, GLM, DeepSeek,
  Mistral, SWE-*) and reasoning-effort levels. Use when deciding which model or
  reasoning effort to use for a coding task, comparing model quality vs cost,
  checking latest agentic coding benchmark scores, or when the user mentions
  FrontierCode. Data is cached locally for 24h and auto-refreshed.
---

# FrontierCode Benchmark

Get up-to-date FrontierCode leaderboard data for model-selection decisions.
FrontierCode is the first agentic coding benchmark that grades **mergeability**:
would the maintainer actually merge this PR? Tasks are crafted by the repos'
own open-source maintainers and graded end-to-end (correctness, test quality,
scope discipline, style) with unit tests, rubrics, and verifiers. FrontierCode
1.1 is current; 1.0 is archived and superseded — never use it.

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
  (all-or-nothing per trial). Primary quality metric. A model's best effort
  across its effort levels is shown by default; `--all` expands every row.
- **Score%** — weighted aggregate of the rubric items; solutions that fail
  blocking criteria score 0. Correlates with Pass% but rewards partial
  quality.
- **$ Rollout, Tokens** — mean cost (USD) and mean output tokens per rollout.
  Cost reflects this benchmark's workload under each model's harness, not
  general API pricing — use it for relative comparison between rows, not
  absolute budgeting.
- **Flagged%** — share of runs detected consulting solution-bearing sources
  (e.g. the original PR); those runs are scored zero. Only nonzero in v1_1.
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
- The `extended` subset (150 tasks) is a more robust ranking signal than the
  main 100; prefer it when comparing closely-tied models.
- These are mergeability-graded agentic coding scores under a specific
  harness; do not present them as evidence for non-coding abilities (writing,
  vision, etc.) or for how the model would behave in a different harness.
