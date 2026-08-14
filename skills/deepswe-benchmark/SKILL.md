---
name: deepswe-benchmark
description: >
  Fetch current DeepSWE v1.1 benchmark leaderboard data (deepswe.datacurve.ai)
  to compare coding-agent performance of LLMs — pass@1/pass@4 rates, cost per
  task, output tokens, agent steps, duration, and peak context — across models
  (Claude Opus/Fable/Sonnet, GPT-5.x, Gemini, Kimi, GLM, Grok, ...) and
  reasoning-effort levels. Use when deciding which model or reasoning effort to
  use for a coding task, comparing model quality vs cost, checking latest
  agentic coding benchmark scores, or when the user mentions DeepSWE. For
  mergeability/harness-specific questions (Cognition's FrontierCode), also
  load frontiercode-benchmark — the two boards are not interchangeable. Data
  is cached locally for 24h and auto-refreshed.
---

# DeepSWE Benchmark

Get up-to-date DeepSWE v1.1 leaderboard data for model-selection decisions.
DeepSWE is an agentic software-engineering benchmark (113 tasks, mini-swe-agent
harness) covering frontier models at multiple reasoning-effort levels. Only
v1.1 is current; v1 is frozen and outdated — never use it.

## Usage

One command; prints a compact markdown leaderboard ranked by pass@1:

```bash
node <skill-dir>/scripts/deepswe_leaderboard.mjs
```

`<skill-dir>` is this skill's base directory (the folder containing this
SKILL.md). Requires Node >= 18.

Flags:

- `--json` — compact JSON rows instead of markdown (for programmatic filtering
  with `jq`).
- `--fresh` — force a refetch, ignoring the 24h cache. Only use when the user
  explicitly wants the very latest numbers.
- `--version <id>` — another benchmark version (default `v1.1`; do not pass
  `v1`, it is outdated).

Caching is automatic: raw data lives in
`${XDG_CACHE_HOME:-~/.cache}/deepswe-bench/` and refreshes when older than
24h. If the site is unreachable, the script falls back to the stale cache with
a warning on stderr. The output header states whether data was cached or
fetched and when it was generated.

## Reading the table

- **Pass@1%** — attempt-level pass rate (primary quality metric). **±** is the
  95% run-to-run confidence half-interval: treat models whose intervals
  overlap as tied.
- **Pass@4%** — tasks solved by at least one of 4 attempts; high pass@4 with
  modest pass@1 means the model benefits from retries.
- **$/task, Out-tok, Steps, Min** — mean cost (USD), output tokens, agent
  steps, and wall-clock minutes per attempt. Cost reflects this benchmark's
  workload under mini-swe-agent, not general API pricing — use it for relative
  comparison between rows, not absolute budgeting.
- **Ctx** — median peak context tokens; high values flag models that may hit
  context-window limits on long tasks.

## Recommending a model

- Compare within the question's constraints: best quality regardless of cost
  vs best value. A row a few CI-overlapped points below the top at a fraction
  of the cost is usually the better default recommendation.
- Reasoning effort matters as much as model choice — the same model spans huge
  quality/cost ranges across low→max. Quote the effort level with the model.
- Steps and duration matter for interactive use; cost and pass@1 matter for
  batch/autonomous use.
- These are agentic-coding scores; do not present them as evidence for
  non-coding abilities (writing, vision, etc.).
