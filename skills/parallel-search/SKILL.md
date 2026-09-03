---
name: parallel-search
description: >
  Use when Parallel is requested or selected for excerpt-rich search, page or
  PDF extraction, entity discovery, enrichment, monitoring, or deep research;
  it provides cost-aware CLI workflows.
---

# Parallel CLI

Last verified: 2026-09-03 (CLI v0.9.3).

All commands support `--json`; async commands support `--no-wait` and `-o`
file output.
If `linkup` or `tvly` is also installed, the `web-search-router` skill
maps task types to the best engine.

## Setup check

```bash
parallel-cli auth      # shows active credential source
parallel-cli balance   # prepaid credit balance
```

Auth: `PARALLEL_API_KEY` env var (overrides stored login) or
`parallel-cli login` (device OAuth, stored in
`~/.config/parallel-web-tools/auth.json`).

## Choosing the right command

| Need | Use | Cost | Latency |
| ---- | --- | ---- | ------- |
| High-volume, latency-critical lookups | `search --mode turbo` | $0.001 | ~200 ms |
| Most lookups and agent search steps | `search --mode basic` (CLI default) | $0.005 | ~1 s |
| Highest-quality multi-hop retrieval per call | `search --mode advanced` | $0.005 | ~3 s |
| Read specific URLs (JS pages, PDFs OK), focused on a goal | `fetch <urls...> --objective` | $0.001 **per URL** | ~1 s |
| Verified answer or report from minutes of autonomous research | `research run -p <processor>` | $0.005–2.40 by tier | 10 s–2 h |
| Fast ranked people/company list | `findall entity-search` | $0.005 (incl. 100 results) | 1–3 s |
| Verified entity discovery with match evaluation | `findall run` | $0.10–10 fixed + per-match | min |
| Enrich CSV/JSON rows with web data | `enrich run` | processor price × rows | min |
| Track the web for changes over time | `monitor create` | $0.003–0.01/run | recurring |

Search pricing includes 10 results; each additional result costs $0.001
(so `--max-results 20` on basic ≈ $0.015).

Escalate stepwise: basic search → advanced search → research at a low tier
(`core-fast` ≈ $0.025, ~1 min) → higher tiers only for genuinely hard,
deliverable-grade work.

## Search

Parallel search takes a natural-language **objective** and optional keyword
**`-q` queries**. Both together give the best results; either alone works:

```bash
parallel-cli search "OBJECTIVE — what you're trying to learn, with context" \
  -q "keyword query one" -q "keyword query two" -q "keyword query three" \
  --mode basic --json
```

- **Objective**: self-contained natural-language goal (max 5000 chars).
  Include source/freshness guidance and task context: `Find latest info
  about X. Focus on product releases and benchmarks. Prefer official docs.`
- **`-q` queries**: 3–6 words each, 2–3 diverse queries (max 5). Vary
  entity names, synonyms, and angles. Never sentences, never `site:`
  operators — steering sources belongs in the objective or `--include-domains`.
- Results are ranked excerpts compressed for reasoning utility — designed
  to be consumed directly, often no follow-up fetch needed.

Useful flags: `--max-results` (≤20), `--after-date YYYY-MM-DD`,
`--include-domains`/`--exclude-domains`, `--location us|gb|de|...`,
`--excerpt-max-chars-per-result`/`--excerpt-max-chars-total`,
`--max-age-seconds` (force fresher-than-N content), `--session-id` (group
related search+fetch calls of one task), `--client-model <model-id>`
(optimizes excerpts for the consuming model — set it to your own model id).

Known behaviors (verified):

- **`--after-date` is a hard filter over sparse publish metadata** — on
  niche or fast-moving queries it often returns zero results instead of
  stale ones. Prefer omitting it and filtering by the `publish_date`
  field yourself; treat an empty filtered result as "nothing indexed",
  not "nothing exists". `publish_date` is frequently `null` on
  general-topic results.
- For live numbers (rates, prices), excerpts often point at the quote
  page without quoting the number — chain a `fetch` on the top result.

**Domain-filter warning**: `--include-domains` is a hard allowlist — the
rest of the web is not searched at all. Prefer steering in the objective
("prefer official documentation") or `--exclude-domains`; reserve
`--include-domains` for when answers must come exclusively from those
domains. Details: [references/search-and-extract.md](references/search-and-extract.md).

## Fetch / extract

```bash
parallel-cli fetch URL1 URL2 --objective "what to pull from these pages" --json
parallel-cli fetch URL --full-content        # whole-page markdown
```

Batch up to 20 URLs per call. Handles JS-heavy pages and PDFs automatically —
no render flag needed. With `--objective`/`-q` you get ranked excerpts focused
on the goal; without them, whole-page markdown with boilerplate. Anonymous —
no login walls. Common pattern: search (mode basic) → pick top URLs → one
batched fetch with an objective.

## Research

Deep research with explicit cost/latency tiers ("processors"). Async task;
the CLI polls and always saves results to disk (default
`./parallel-research/<run_id>` — pass `-o` to control where files land).

```bash
parallel-cli research run "question or brief (max 15k chars)" \
  -p core-fast --text -o /path/to/report --timeout 600
parallel-cli research run "..." -p pro --no-wait --json   # fire and poll later
parallel-cli research status <run_id>; parallel-cli research poll <run_id>
```

- Processor picks the budget: `lite` $0.005 → `base` $0.01 → `core` $0.025
  → `core2x` $0.05 → `pro` $0.10 → `ultra` $0.30 → `ultra2x`/`4x`/`8x`
  $0.60–2.40. Append `-fast` for 2–5× lower latency at slightly lower data
  freshness (default: `pro-fast`). Verified: `core-fast` answered a
  multi-fact acquisition question correctly in 45 s for $0.025.
- `--text` returns a markdown report with citations (steer with
  `--text-description "under 1000 words, focus on X"`); default is
  API-chosen structured JSON.
- `--previous-interaction-id <trun_id>` chains follow-up research on prior
  context.
- From a coding agent: tiers ≤ `core-fast` are fine to run inline; for
  `pro`/`ultra` tiers submit with `--no-wait` or run in the background.

Processor selection detail, task-spec/schema design, and FindAll / enrich /
monitor usage: [references/research-findall-monitor.md](references/research-findall-monitor.md).

## Cost discipline

- Prices: search $0.001–0.005; fetch $0.001; research $0.005 (lite) to
  $2.40 (ultra8x). Free tier: $5 credits/month plus signup bonus.
- Most questions die at basic/advanced search for half a cent. Research at
  `lite`/`base`/`core` tiers costs 0.5–2.5 cents — cheap enough to use
  whenever a search result needs cross-checking. `pro` and above ($0.10+)
  are for genuinely exploratory or multi-source work the user asked for.
- FindAll `pro` generator ($10 + $1/match) can hit $100+ on a large run —
  confirm with the user before `pro`-tier FindAll, `ultra`-tier research,
  or enrichment over hundreds of rows.
