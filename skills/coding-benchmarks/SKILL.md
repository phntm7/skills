---
name: coding-benchmarks
description: >
  Use when comparing current DeepSWE or FrontierCode results or choosing a model
  and reasoning effort for coding; it provides normalized data and decision guidance.
---

# Coding Benchmarks

Last verified: 2026-09-03 (DeepSWE `generated_at` 2026-09-02; FrontierCode
publishes no board date).

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

## Model identity

Rows join across boards through the canonical `model_id`, but version-distinct
models are never aliased. Exact variant names present today: DeepSWE v1.1 has
`claude-fable-5` (no Fable 5.1, no MiMo 2.5) and bare `DeepSeek V4 Flash` /
`DeepSeek V4 Pro`; FrontierCode v1_1 has `Claude Fable 5.1` (no Fable 5, no
MiMo 2.5) and the dated variants `DeepSeek V4 Flash 0731` and `DeepSeek V4 Pro
0813`. Merge an alias only after the boards confirm both names are the same
model. A requested model absent from a board appears as an explicit
`absent on <board>` row (`missing_from_board` in JSON), never as a silent
merge or silent gap.

## Usage

For a model-selection question, use the combined command. Keep the model set
bounded so the agent receives only the rows it needs:

```bash
node <skill-dir>/scripts/compare_benchmarks.mjs --json \
  --models 'claude-opus-5,gpt-5.6-sol,grok-4.6,deepseek-v4-pro'
```

The comparison defaults to one best row per model from each board. Add `--all`
when comparing reasoning levels or checking an effort-specific claim; pass
`--effort` to pin levels — the filter is applied before FrontierCode chooses
its best row:

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
- A reasoning-level question — pass `--effort`; add `--all` when several
  levels must be compared.

Each script's `--help` is the flag source of truth. Caching is per board with
a 24h TTL; if a site is unreachable, the script falls back to the stale cache
with a warning on stderr, and the JSON exposes `fromCache`, `age_hours`,
`stale`, and `fetched_at`, so a caller that captures only stdout can still
detect stale data. Load
[references/json-output.md](references/json-output.md) for the row schema and
metric glossary before writing a parser or interpreting columns.

## Combining both boards

Pick by the question's shape: mergeability, harness behavior, and production
quality → FrontierCode; pass@k, retry tolerance, and single-harness cost →
DeepSWE. A generic model-choice answer is not complete until both boards are
in hand; if one fetch fails, report it and do not treat the other board as a
complete comparison. When the boards agree on the same model × effort, that is
the recommendation; when they disagree, follow the shape rule and state the
other board's top pick as a cross-check.

## Recommending a model

1. Check `errors`, `stale`, and the per-board unmatched lists. A missing row
   can mean that a model or effort is absent from that board, not that
   fetching failed.
2. Compare the same `model_id` and effort. Quote the model, reasoning level,
   board, and harness when recommending it.
3. Treat overlapping DeepSWE confidence intervals as tied. Prefer a cheaper
   row when quality is tied or nearly tied; `dominated_by` identifies rows
   that are strictly worse on DeepSWE quality and cost with separated
   intervals.
4. Use `main` for FrontierCode close calls because `extended` adds 50 easier
   tasks. Use steps and duration for interactive work, and cost and pass rate
   for batch or autonomous work.

These are agentic coding scores under specific harnesses. Do not present them
as evidence for non-coding abilities such as writing or vision.

## Done means

The answer reports freshness (`stale`/`fetched_at`) plus any fetch errors and
unmatched filters; names the selected model, effort, board, harness, and
metric or cost basis; ties the recommendation to the question's shape; and
cross-checks the other board's top pick.

## Sources

- DeepSWE: https://deepswe.datacurve.ai (endpoint:
  https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json)
- FrontierCode: https://cognition.com/frontiercode (endpoint:
  https://cognition.com/data/frontiercode-leaderboard/data.json)
