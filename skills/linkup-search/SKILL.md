---
name: linkup-search
description: >
  Use when Linkup is requested or selected for filtered web search, page extraction,
  LinkedIn data, batch lookup, or deep research; it provides structured, cost-aware CLI workflows.
---

# Linkup CLI

Last verified: 2026-09-03 (CLI v1.3.0).

Linkup is an AI-native web search API with a CLI: **search** (agentic web
search, 1–30 s), **fetch** (URL → markdown, optionally typed JSON),
**research** (autonomous multi-minute agent), and **tasks** (async
batches). Every command takes `--json`. When choosing among engines, use
the `web-search-router` skill; use this skill for Linkup execution. Done
means the command succeeded and you returned the requested fields or
citations; for async work, poll until `completed` or `failed` and return
the result or the reported error, never a pending task.

## Setup check

Check auth with `linkup config`; if the key is missing, ask the user to run
`linkup setup`. It comes from `LINKUP_API_KEY` (takes precedence) or
`~/.linkup/config`. Failed calls and empty results are never billed; an
exhausted balance returns HTTP 429. Search and Fetch are rate-limited to
10 queries/second per organization — pace bulk work or submit it through
`tasks`; higher limits require a custom plan.

## Choosing the right command and depth

Depth ladder — take the first tier whose output contract meets the
request: `search --depth fast` (one keyword lookup, <1 s) → `search`
(standard default; anything a few Google searches answer, $0.005–0.006) →
`search --depth deep` (chained find-a-URL-then-read-it steps, 5–30 s,
$0.05–0.055) → `research` (minutes of autonomous verified investigation,
$0.25–2.50; reserve L/XL for deliverable-grade reports). `fetch` reads one
known URL; `tasks create` batches up to 100 calls of any type
asynchronously at the same per-call price.

## Search

```bash
linkup search "query" --output search-results --max-results 10 --json
linkup search "query" --include-domains github.com --schema '{"type":"object","properties":{...}}'
```

`linkup search --help` carries the full surface. Flags that shape every
run: `-d/--depth fast|standard|deep`, `-o/--output
sourced-answer|search-results|structured` (`--schema`/`--schema-file`
implies structured), `--include-domains`/`--exclude-domains` (maximum 100
domains each), `--from-date`/`--to-date` (YYYY-MM-DD), `--json`. Pick the
output type by consumer: you reason over results → `search-results` (raw
sources, full snippets, cheapest); the answer goes to the user →
`sourced-answer` (default); code parses fields → `structured`.

`fast` is keyword-only and ignores instructions: keep those queries short
and keyword-shaped (`NVIDIA Q4 2024 revenue`) and send instruction-style
briefs to `standard` or `deep`, which parse retrieval instructions and (on
`deep`) follow numbered steps literally. For per-depth query patterns,
LinkedIn recipes, index behaviors, schema tips, and bad→fix pairs, read
[references/query-patterns.md](references/query-patterns.md).

## Fetch

```bash
linkup fetch https://example.com --render-js   # markdown; --render-js for SPAs
linkup fetch URL --mode pro --schema-file s.json --instructions "..." --json
```

`--mode standard|pro` crossed with `--render-js` sets success rate and
price: standard $0.001, standard+JS or pro $0.005, pro+JS $0.01. For typed
JSON from a known page add `--schema`/`--schema-file` (+$0.001), plus
`--instructions` for rules a schema can't express (currency, which prices
to keep; requires a schema, max 4,000 chars). Markdown still returns
alongside `data`, ungrounded fields are omitted rather than invented, and
`--include-raw-content`/`--include-raw-html` add the unprocessed page.

Fetch is anonymous, so LinkedIn returns the login wall — extract LinkedIn
through `search`. HTML over 20 MB and PDFs over 100 MB return 400, as do
non-HTML/PDF binaries; near-empty markdown or "Loading..." means retry with
`--render-js`, then `--mode pro`.

## Research

An autonomous research agent (ranks #1 on the SealQA-0 sourced-QA
benchmark), async by default — returns a task id; poll or `--wait`.

```bash
linkup research "brief" --mode answer --reasoning-depth M --wait --json
linkup research get <id> --json    # poll a task submitted earlier
```

`--mode` takes `answer`, `investigate`, `research`, or `auto`; `auto` (also
the behavior when the flag is omitted) classifies for you, so name one of
the three when cost, latency, or output shape must be pinned.
`--reasoning-depth S|M|L|XL` buys compute and sets price ($0.25 / $0.50 /
$1.50 / $2.50; **L is the CLI default**), and `--schema`/`--schema-file`
works here too. From a coding agent, submit without `--wait` and poll
between other work, or run the `--wait` call as a background task. For
brief phrasing, mode and depth selection, polling cadence, and batching via
`tasks`, read
[references/research-and-batch.md](references/research-and-batch.md).

## Sources

- CLI: https://docs.linkup.so/pages/sdk/cli/cli.md
- Search: https://docs.linkup.so/pages/documentation/endpoints/search/overview.md
- Fetch: https://docs.linkup.so/pages/documentation/endpoints/fetch/overview.md
- Research: https://docs.linkup.so/pages/documentation/endpoints/research/overview.md
- Tasks: https://docs.linkup.so/pages/documentation/endpoints/tasks/overview.md
- Pricing: https://docs.linkup.so/pages/documentation/platform/pricing.md
- Rate limits: https://docs.linkup.so/pages/documentation/platform/rate-limits.md
