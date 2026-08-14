---
name: coding-benchmarks
description: >
  Fetch and compare current agentic coding-benchmark leaderboards — DeepSWE v1.1
  (deepswe.datacurve.ai: pass@1/pass@4, cost, output tokens, agent steps,
  duration, peak context under mini-swe-agent) and FrontierCode 1.1
  (cognition.com/frontiercode: mergeability pass rate, rubric score, cost,
  tokens, agent harness) — with bounded model filters, reasoning-effort rows,
  canonical cross-board IDs, and JSON output for agents. Use when the user
  mentions DeepSWE, FrontierCode, mergeability, Cognition's benchmark,
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

For a model-selection question, use the combined command. Keep the model set
bounded so the agent receives only the rows it needs:

```bash
node <skill-dir>/scripts/compare_benchmarks.mjs --json \
  --models 'claude-opus-5,gpt-5.6-sol,grok-4.6,deepseek-v4-pro'
```

The comparison defaults to one best row per model from each board. Add
`--all` when comparing reasoning levels or checking an effort-specific claim:

```bash
node <skill-dir>/scripts/compare_benchmarks.mjs --json --all \
  --models 'claude-opus-5,gpt-5.6-sol' --effort 'high,xhigh'
```

Run the board scripts directly when the user names one board, or when the
comparison wrapper is unavailable:

```bash
node <skill-dir>/scripts/deepswe_leaderboard.mjs
node <skill-dir>/scripts/frontiercode_leaderboard.mjs
```

- Generic "which model for this coding task?" — run the comparison command and
  synthesize across both boards.
- A board-specific question (DeepSWE, FrontierCode, mergeability, pass@k, ...)
  — run only that board.
- A reasoning-level question — pass `--effort`; add `--all` when several levels
  must be compared. The filter is applied before FrontierCode chooses its best
  row.

### Combining both boards

A generic model-choice answer is not complete until both boards are in hand. If
one fetch fails, report the failed board and do not treat the other board as a
complete comparison:

- Both boards agree on the same model × effort → that is the recommendation.
- They disagree → do **not** average the boards. Pick by the question's
  shape: mergeability / harness / production quality → FrontierCode wins;
  pass@k / retry tolerance / single-harness cost → DeepSWE wins. State the
  other board's top pick as a cross-check.

Flags (both scripts):

- `--json` — compact, percentage-scaled JSON rows. See
  [references/json-output.md](references/json-output.md) for the exact schema.
- `--fresh` — force refetch, ignoring the 24h cache.
- `--version <id>` — benchmark revision (deepswe: default `v1.1`, never `v1`;
  frontiercode: default `v1_1`, never `v1`).
- `--models <patterns>` — comma-separated canonical IDs, board names, family
  tokens, or globs such as `grok,deepseek,glm` or `claude-*`. Matching checks
  both boards' naming styles; unmatched patterns appear in JSON and stderr.
- `--effort <patterns>` — comma-separated effort levels or globs such as
  `high,xhigh`; unmatched levels appear in JSON and stderr.
- FrontierCode only: `--subset <main|extended>` (default `main`),
  `--metric <pass|score>` (default `pass`), `--all` (every model × effort row
  instead of best effort per model).

The combined command accepts `--models`, `--effort`, `--fresh`, `--all`,
`--subset`, and `--metric`; use `--deepswe-version` and
`--frontiercode-version` when overriding revisions.

Caching is per board: raw JSON lives in
`${XDG_CACHE_HOME:-~/.cache}/{deepswe-bench,frontiercode-bench}/` and
refreshes when older than 24h. If a site is unreachable, the script falls
back to the stale cache with a warning on stderr. JSON also exposes
`fromCache`, `age_hours`, `stale`, and `fetched_at`, so a caller that captures
only stdout can still detect stale data. FrontierCode has no board date in its
payload; its `fetched_at` is the local fetch/cache-write time.

## JSON output

Every row includes `model_id`, a canonical cross-board join key, alongside
`model`, the board's original slug or display name. Each board-script JSON
object includes `fromCache`, `age_hours`, `stale`, and `fetched_at`; the
combined output repeats those fields under `boards`. Inspect `stale` before
calling the numbers current. `row_mode` is `all` for DeepSWE, `best-effort`
for the default FrontierCode view, and `all` after `--all`. Filter diagnostics
live in `requested_models`, `unmatched_models`, `requested_efforts`, and
`unmatched_efforts`, so a typo cannot silently produce an empty comparison.

DeepSWE rows use `pass1_pct`, `ci_pct`, `pass4_pct`, `cost_usd`, `out_tokens`,
`steps`, `duration_min`, and `peak_ctx_tokens`. FrontierCode rows use
`pass_pct`, `score_pct`, `cost_usd`, `tokens`, `flagged_pct`, and `harness`.
Percentages are already scaled to percentage points. Load
[references/json-output.md](references/json-output.md) before writing a parser
or using the combined comparison schema.

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
  reasoning effort, `--all` expands every model × effort row. Use `--effort`
  to pin a level before best-effort selection.
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

Use the comparison output as an executable first pass:

1. Check `errors`, `stale`, and the per-board unmatched lists. A missing row
   can mean that a model or effort is absent from that board, not that fetching
   failed.
2. Compare the same `model_id` and effort. Quote the model, reasoning level,
   board, and harness when recommending it.
3. Treat overlapping DeepSWE confidence intervals as tied. Prefer a cheaper
   row when quality is tied or nearly tied; `dominated_by` identifies rows that
   are strictly worse on DeepSWE quality and cost with separated intervals.
4. Do not average the boards. FrontierCode wins questions about mergeability,
   harness behavior, and production quality; DeepSWE wins questions about
   pass@k, retry tolerance, and single-harness cost.
5. Use `main` for FrontierCode close calls because `extended` adds 50 easier
   tasks. Use steps and duration for interactive work, and cost and pass rate
   for batch or autonomous work.

These are agentic coding scores under specific harnesses. Do not present them
as evidence for non-coding abilities such as writing or vision.
