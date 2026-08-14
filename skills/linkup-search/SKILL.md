---
name: linkup-search
description: >
  Use when Linkup is requested or selected for filtered web search, page extraction,
  LinkedIn data, batch lookup, or deep research; it provides structured, cost-aware CLI workflows.
---

# Linkup CLI

Last verified: 2026-08-04 (CLI v1.0.2).

Linkup is an AI-native web search API with a CLI. It gives you four
capabilities: **search** (agentic web search, 1–30 s), **fetch** (URL →
markdown), **research** (autonomous multi-minute research agent), and
**tasks** (async batches). All commands support `--json` for parseable
output. If `parallel-cli` or `tvly` is also installed, the
`web-search-router` skill maps task types to the best engine.

## Setup check

```bash
linkup config   # shows API key + source; if missing, ask the user to run: linkup setup
```

Auth comes from `LINKUP_API_KEY` (takes precedence) or `~/.linkup/config`.
Failed calls and empty results are never billed; an exhausted balance
returns HTTP 429.

## Choosing the right command and depth

| Need | Use | Cost | Latency |
| ---- | --- | ---- | ------- |
| Keyword lookup, one fact | `search --depth fast` | $0.005–0.006 | <1 s |
| Anything one or a few Google searches would answer | `search` (standard, default) | $0.005–0.006 | 1–3 s |
| Multi-step: find a URL then read it, scrape several pages, chained steps | `search --depth deep` | $0.05–0.055 | 5–30 s |
| Read one known URL in full | `fetch` | $0.001 ($0.005 with `--render-js`) | <2 s |
| Question needing minutes of autonomous investigation with verified sources | `research` | $0.25–2.50 by depth | 2–20 min |
| Hundreds of lookups in bulk | `tasks create` | same per-call price | async |

Rule of thumb: chat-style or keyword lookup → `fast`; if one or a few
parallel Google searches would answer it → `standard`; if a human would open
multiple tabs or follow leads → `deep`; if it needs minutes of iterative
investigation and cross-checking → `research`.

## Search

```bash
linkup search "query"                                  # sourced answer + sources
linkup search "query" --output search-results --max-results 10 --json
linkup search "query" --include-domains github.com,devblogs.microsoft.com
linkup search "query" --exclude-domains reddit.com --from-date 2026-01-01 --to-date 2026-06-30
linkup search "query" --schema '{"type":"object","properties":{...},"required":[...]}'
```

Key flags: `-d/--depth fast|standard|deep`, `-o/--output
sourced-answer|search-results|structured`, `--schema`/`--schema-file`
(implies structured output), `--include-domains` (max 100),
`--exclude-domains` (unlimited), `--from-date`/`--to-date` (YYYY-MM-DD),
`--max-results`, `--include-images` (search-results only).

**Output type selection**: you (the agent) will reason over results →
`search-results` (raw sources + full snippets, and it's the cheapest); answer
goes straight to the user → `sourced-answer` (default); code parses fields →
`structured` with a schema.

Known behaviors (verified):

- News-style queries surface **LinkedIn posts** prominently — very fresh
  (24–48 h) and usually carrying the story, but they're social posts, not
  citable news sources. Fine for "what's the buzz"; for citable coverage,
  add `--exclude-domains linkedin.com` or name news outlets in the query.
- For live data (rates, prices, schedules), raw `search-results` can
  return years-stale pages; `sourced-answer` mode reconciles sources and
  dates far better — use it for anything time-sensitive.
- Results may include localized duplicates of the same page (ja/pl/zh
  docs mirrors) — dedupe by path before counting coverage.

### Writing queries that work

`standard` and `deep` are **agentic**: they parse instructions, fan out into
parallel sub-searches, and (on `deep`) chain steps sequentially. Write
retrieval instructions, not questions to reason about:

- **Bad**: `How to estimate Total SA's annual IT spend?`
- **Good**: `Find Total SA's annual reports and IT-services contracts that
  mention IT spend. For each source, extract the figure, year, and URL.`
- **Bad**: `Tell me about linkup.so`
- **Good**: `Find the linkup.so homepage, product and about pages. Extract:
  what the company does, target customers, pricing model, investors.`

Rules:

- Name what to retrieve and what fields to extract. Scope beats vagueness.
- For breadth (news, trends), append: `Run several searches with adjacent
  keywords.` For controlled coverage, name the dimensions: `Run several
  searches to map (i) products, (ii) team, (iii) business model.`
- On `deep`, write ordered steps — it follows them literally: `First find
  Datadog's pricing page URL. Then scrape that URL. Then return plan names
  and per-host prices.`
- Put a URL in the query to scrape it in the same call (`standard`: one URL;
  `deep`: several, with JS rendering).
- Use `--from-date`/`--to-date` flags instead of embedding date ranges in
  the query text.
- `fast` is keyword-only — it ignores instructions entirely. Keep those
  queries short and keyword-shaped (`NVIDIA Q4 2024 revenue`).

For per-depth patterns, LinkedIn extraction (search-only — Fetch hits the
login wall), structured-schema tips, and bad→fix pairs, read
[references/query-patterns.md](references/query-patterns.md).

## Fetch

```bash
linkup fetch https://example.com                 # clean markdown, HTML or PDF
linkup fetch https://app.example.com --render-js # JS-rendered SPAs ($0.005 vs $0.001)
```

Flags: `--render-js`, `--include-raw-html`, `--extract-images`. Anonymous
(no logins), 20 MB cap, HTML+PDF only (binaries → 400). If markdown comes
back near-empty or full of "Loading...", retry with `--render-js`. Common
pattern: `search --output search-results` to find URLs, then `fetch` the top
hits for full pages.

## Research

An autonomous research agent (ranks #1 on the SealQA-0 sourced-QA
benchmark). Async by default — returns a task id; poll or `--wait`.

```bash
linkup research "brief" --mode answer --reasoning-depth M --wait --json
linkup research "brief"            # prints task id immediately
linkup research get <id> --json    # poll later
```

Set `--mode` explicitly (omitting lets it auto-classify — unpredictable
cost/latency): `answer` = one verified, cross-checked answer (high-stakes
facts); `investigate` = deep report on a single entity/topic;
`research` = broad multi-entity/multi-theme report.

`--reasoning-depth` sets the compute budget and the price: S $0.25 (2–5 min),
M $0.50 (3–7 min), L $1.50 (5–10 min, **default — set it deliberately**),
XL $2.50 (10–20 min). Structured output via `--schema`/`--schema-file`
works here too.

When launched from a coding agent, prefer submitting without `--wait` and
polling `research get <id>` between other work, or run the `--wait` call as
a background task. For research-brief phrasing, mode selection detail,
polling cadence, and batching via `tasks`, read
[references/research-and-batch.md](references/research-and-batch.md).

## Cost discipline

- Prices per call: standard search ≈ half a cent; deep search ≈ 5 cents;
  research $0.25–2.50. Failed/empty calls are free; retries are fine.
- Don't use `deep` where `standard` + explicit adjacent-search instructions
  suffice. Don't use `research` for anything a $0.05 deep search answers.
- Escalate stepwise: standard → deep → research S/M. Reserve L/XL for
  deliverable-grade reports the user explicitly wants thorough.
- Batching via `tasks` changes workflow, not price.
