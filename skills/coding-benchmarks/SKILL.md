---
name: coding-benchmarks
description: >
  Use when comparing current DeepSWE or FrontierCode results or choosing a model
  and reasoning effort for coding; it provides normalized data and decision guidance.
---

# Coding Benchmarks

Checked: 2026-10-27. Both live fetches succeeded without cache fallback:
DeepSWE v1.1 returned 70 model × effort rows (`generated_at`
2026-09-22T06:27:15.860279+00:00); FrontierCode v1_1 returned 141 rows
and publishes no board date. A fresh fetch can still contain dated results.

Fetch leaderboard data for model-selection decisions from two agentic
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

Rows join across boards through canonical `model_id`. Preserve version
identity: Opus 5.5 is distinct from Opus 5, Fable 5.1 from Fable 5, GPT-6.1
Sol from GPT-6 Sol and GPT-5.6 Sol, and DeepSeek V4.1 Flash from V4 Flash
or its dated variants. Normalize punctuation only for confirmed identities.

Current candidates (2026-10-27) include Claude Opus 5.5, Fable 5.1,
Sonnet 5.5, Haiku 5.5; GPT-6.1 Sol / Terra, GPT-6 Luna, GPT-6 Astra; GLM-5.3 /
GLM-5.3-Flash; DeepSeek V4.1 Flash; MiMo 2.6 Pro / Flash; and Muse Spark.
This is a candidate roster, not a claim that every model is on either board.
Do not substitute a historical row for an absent current model. In particular,
versioned Muse Spark rows do not establish identity with an unversioned API
model without provider confirmation.

A requested model absent from a board appears as an explicit
`absent on <board>` row (`missing_from_board` in JSON). Check exact returned
IDs: broad family patterns can also select older generations. Scripts have
no fixed model roster by default; omitting `--models` returns all board models,
including historical ones.

## Usage

For a model-selection question, use the combined command. Keep the model set
bounded so the agent receives only the rows it needs:

```bash
node <skill-dir>/scripts/compare_benchmarks.mjs --json \
  --models 'claude-opus-5-5,gpt-6.1-sol,gpt-6-luna,deepseek-v4.1-flash'
```

The comparison defaults to one best row per model from each board. Add `--all`
when comparing reasoning levels or checking an effort-specific claim; pass
`--effort` to pin levels — the filter is applied before FrontierCode chooses
its best row:

```bash
node <skill-dir>/scripts/compare_benchmarks.mjs --json --all \
  --models 'claude-opus-5-5,gpt-6.1-sol' --effort 'high,xhigh'
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
complete comparison. Agreement on model × effort strengthens the evidence,
but still check availability, cost, latency, task fit, and local model policy. When the boards
disagree, follow the shape rule and state the other board's top pick as a
cross-check.

## Recommending a model

If `~/.agents/model-policy.md` exists, read it before choosing a model or
reviewer for its current roles, cross-family review, and shared quota limits.
If absent, use the host policy and available benchmark evidence; its absence
is not a blocker. Operating policy is separate from leaderboard results. Compare
available current candidates first; benchmark effort labels are measured
settings, not portable defaults across families or model generations. Use
local evals for candidates missing from a board.

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
