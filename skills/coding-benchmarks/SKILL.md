---
name: coding-benchmarks
description: >
  Fetch current agentic coding-benchmark leaderboards — DeepSWE v1.1
  (deepswe.datacurve.ai: pass@1/pass@4, cost, output tokens, agent steps,
  duration, peak context under mini-swe-agent) and FrontierCode 1.1
  (cognition.com/frontiercode: mergeability pass rate, rubric score, cost,
  tokens, agent harness) — to compare coding-agent performance of LLMs across
  models (Claude Fable/Opus/Sonnet, GPT-5.x, Grok, Gemini, Kimi, GLM,
  DeepSeek, Mistral, SWE-*, ...) and reasoning-effort levels. Use when the
  user mentions DeepSWE, FrontierCode, mergeability, Cognition's benchmark,
  harness-specific SWE scores, or wants to decide which model or reasoning
  effort to use for a coding task.
---

# Coding Benchmarks

Up-to-date leaderboard data for model-selection decisions from two agentic
coding benchmarks that measure different things:

- **DeepSWE v1.1** — pass@1/pass@4 under a single harness (mini-swe-agent),
  113 tasks, plus cost, steps, duration, and context usage. Site:
  deepswe.datacurve.ai.
- **FrontierCode 1.1** — **mergeability**: would the maintainer actually merge
  this PR? Tasks authored by the repos' own open-source maintainers, graded
  end-to-end (correctness, test quality, scope discipline, style) with unit
  tests, rubrics, and verifiers, under each model's own agent harness. Site:
  cognition.com/frontiercode.

The boards are **not interchangeable**: DeepSWE measures pass rate under one
harness; FrontierCode measures mergeable quality under each model's own
harness. A named-board request is a filter inside one workflow, not a
different job.

## Usage

Two commands, one per board — both accept `--json`, `--fresh`, and
`--version`; FrontierCode adds `--subset`, `--metric`, `--all`:

```bash
node <skill-dir>/scripts/deepswe_leaderboard.mjs
node <skill-dir>/scripts/frontiercode_leaderboard.mjs
```

- Generic "which model for this coding task?" — run **both** and synthesize
  across boards.
- User names a board (DeepSWE, FrontierCode, mergeability, pass@k, ...) — run
  only that one.

### Combining both boards

A generic model-choice answer is not complete until both tables are in hand
(if one fetch fails, say so):

- Both boards agree on the same model × effort → that is the recommendation.
- They disagree → do **not** average the boards. Pick by the question's
  shape: mergeability / harness / production quality → FrontierCode wins;
  pass@k / retry tolerance / single-harness cost → DeepSWE wins. State the
  other board's top pick as a cross-check.

Flags (both scripts):

- `--json` — compact JSON rows instead of markdown (for `jq` filtering).
- `--fresh` — force refetch, ignoring the 24h cache.
- `--version <id>` — benchmark revision (deepswe: default `v1.1`, never `v1`;
  frontiercode: default `v1_1`, never `v1`).
- FrontierCode only: `--subset <main|extended>` (default `main`),
  `--metric <pass|score>` (default `pass`), `--all` (every model × effort row
  instead of best effort per model).

Caching is per board: raw JSON lives in
`${XDG_CACHE_HOME:-~/.cache}/{deepswe-bench,frontiercode-bench}/` and
refreshes when older than 24h. If a site is unreachable, the script falls
back to the stale cache with a warning on stderr. The output header states
whether data was cached or fetched.

## Reading the table

### DeepSWE (`deepswe_leaderboard.mjs`)

- **Pass@1%** — attempt-level pass rate (primary quality metric). **±** is the
  95% run-to-run confidence half-interval: models whose intervals overlap are
  tied.
- **Pass@4%** — tasks solved by at least one of 4 attempts; high pass@4 with
  modest pass@1 means the model benefits from retries.
- **$/task, Out-tok, Steps, Min** — means per attempt. Cost reflects this
  benchmark's workload under mini-swe-agent, not general API pricing — use for
  relative comparison between rows, not absolute budgeting.
- **Ctx** — median peak context tokens; high values flag models that may hit
  context-window limits on long tasks.

### FrontierCode (`frontiercode_leaderboard.mjs`)

- **Pass%** — fraction of trials satisfying every blocker rubric criterion
  (all-or-nothing per trial). Primary quality metric. Pass% and Score% are
  means over 5 trials per effort; the default view shows each model's best
  effort, `--all` expands every row.
- **Score%** — weighted aggregate of the rubric items; solutions that fail
  blocking criteria score 0. Correlates with Pass% but rewards partial
  quality.
- **$/rollout, Tokens** — means per rollout. Relative comparison only, not
  absolute budgeting.
- **Flagged%** — share of runs detected consulting solution-bearing sources
  (e.g. the original PR); those runs are scored zero. Only reported in v1_1
  (the field does not exist in v1).
- **Harness** — the agent harness the run used (claude-code, codex,
  grok-build, chisel, cursor-cli, mini-swe-agent). Scores are tied to the
  harness; do not infer raw model ability from a single harness row.

## Recommending a model

- Compare within the question's constraints: best quality regardless of cost
  vs best value. A row a few points below the top — or CI-overlapping, on
  DeepSWE — at a fraction of the cost is usually the better default
  recommendation.
- Reasoning effort matters as much as model choice — the same model spans huge
  quality/cost ranges across low→max. Quote the effort level with the model.
- Steps and duration matter for interactive use; cost and pass rate matter for
  batch/autonomous use.
- Board-specific caveats: on FrontierCode, use `main` (the 100 hardest tasks,
  Cognition's headline board) for close calls — `extended` adds 50 easier
  tasks and inflates scores; on DeepSWE, treat CI-overlapping rows as tied.
- These are agentic coding scores under specific harnesses; do not present
  them as evidence for non-coding abilities (writing, vision, etc.).
