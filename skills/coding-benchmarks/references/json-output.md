# JSON output

The two board scripts emit compact, percentage-scaled rows. The scripts keep
their board-specific metrics, but share filter, cache, and model-identity
metadata so an agent can parse them without probing the payload.

## Common metadata

Both scripts include these top-level fields:

| Field | Meaning |
| --- | --- |
| `version` | Benchmark revision selected by `--version`. |
| `fromCache` | `true` when the result came from the local cache, including stale fallback. |
| `age_hours` | Age of the cached/fetched payload in hours, rounded to one decimal. Fresh fetches are `0`. |
| `stale` | `true` only when a failed refresh caused a stale cache fallback. Do not describe stale data as current. |
| `fetched_at` | Local fetch or cache-write time. It is not a board publication date. |
| `row_mode` | DeepSWE is always `all`; FrontierCode is `best-effort` by default and `all` with `--all`. |
| `requested_models` / `requested_efforts` | The comma-separated filter patterns supplied by the caller, or `[]`. |
| `unmatched_models` / `unmatched_efforts` | Patterns that matched no available model or effort after filtering. They are also reported on stderr. |
| `rows` | Sorted compact result rows. |

Filters accept comma-separated exact names, family tokens, or globs. Model
matching checks the canonical ID and the board's original name, so all of
these select the same model: `grok-4.6`, `grok-4-6`, and `Grok 4.6`.

## DeepSWE rows

DeepSWE includes the board's `generated_at` timestamp and one row for every
model × effort combination that exists in the payload. A row has this shape:

```json
{
  "model": "grok-4-6",
  "model_id": "grok-4.6",
  "effort": "high",
  "pass1_pct": 65.2,
  "ci_pct": 1.5,
  "pass4_pct": 85.0,
  "attempts": 451,
  "cost_usd": 4.38,
  "out_tokens": 61161,
  "steps": 79,
  "duration_min": 18.1,
  "peak_ctx_tokens": 136248
}
```

`pass1_pct`, `pass4_pct`, and `ci_pct` are already percentages, not fractions.
`ci_pct` is the 95% confidence half-interval for pass@1. `model_id` is the
cross-board join key; `model` preserves the DeepSWE slug.

## FrontierCode rows

FrontierCode has no board `generated_at` field, so use `fetched_at` to report
when this local payload was fetched or written to cache. Without `--all`, the
script returns the best effort per model under the selected `--metric` and
`--subset`. With `--all`, it returns every model × effort row. `--effort`
filters before best-effort selection, so `--effort high` cannot silently return
a different reasoning level.

```json
{
  "model": "Grok 4.6",
  "model_id": "grok-4.6",
  "harness": "grok-build",
  "effort": "high",
  "pass_pct": 53.1,
  "score_pct": 48.0,
  "cost_usd": 2.88,
  "tokens": 36758,
  "flagged_pct": 0.7
}
```

`pass_pct`, `score_pct`, and `flagged_pct` are percentages. `pass_pct` is the
all-blockers pass rate; `score_pct` is the weighted rubric score. `harness`
matters because FrontierCode measures the model together with its agent
harness. `effort: null` means the model has no reasoning-level dial.

## Combined comparison

`compare_benchmarks.mjs` runs both scripts and joins rows through `model_id`.
By default it returns one best row per model from each board. `--all` asks
FrontierCode for every effort and joins rows by model × effort; use it when
comparing or verifying reasoning levels.

Each comparison row contains:

```json
{
  "model_id": "grok-4.6",
  "models": { "deepswe": "grok-4-6", "frontiercode": "Grok 4.6" },
  "efforts": { "deepswe": "high", "frontiercode": "high" },
  "deepswe": { "model_id": "grok-4.6", "pass1_pct": 65.2 },
  "frontiercode": { "model_id": "grok-4.6", "pass_pct": 53.1 },
  "missing_from_board": [],
  "ci_overlaps_with": [],
  "dominated_by": []
}
```

`missing_from_board` identifies a missing model × effort row in the current
join; it is distinct from an unmatched filter pattern. The two recommendation
signals use selected DeepSWE rows at the same effort: `ci_overlaps_with` lists
rows whose pass@1 confidence intervals overlap, and `dominated_by` lists rows
with strictly higher pass@1, lower cost, and non-overlapping intervals.
FrontierCode has no confidence intervals, so these signals do not compare its
rows.
