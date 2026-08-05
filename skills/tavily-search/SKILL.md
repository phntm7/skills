---
name: tavily-search
description: >
  Search the web, extract page content, crawl or map websites, and run deep
  research with the Tavily CLI (`tvly`). Use when a task needs real-time web
  search (including news and finance topic modes with dated results), URL
  content extraction, bulk documentation crawling, site URL discovery, or an
  AI research report with citations. Triggers: "search the web", "look up
  online", "find articles/news about", "fetch/extract this page", "crawl
  these docs", "map this site", "research X in depth", "tvly", "tavily". If
  more than one of the linkup/parallel-cli/tvly CLIs is installed, consult
  the web-search-router skill first to pick the engine. Not for browser
  automation or authenticated pages (use a browser tool instead).
---

# Tavily CLI

Last verified: 2026-08-04 (CLI v0.1.6).

Tavily is an AI-native web API with the `tvly` CLI. Commands: **search**,
**extract** (URLs → content), **map** (discover site URLs), **crawl** (bulk
extract a site), **research** (cited research reports, ~30 s–minutes). All
support `--json` and `-o file`. Billing is credit-based: 1 credit = $0.008
pay-as-you-go; 1,000 free credits/month. If `linkup` or `parallel-cli` is
also installed, the `web-search-router` skill maps task types to the best
engine.

## Setup check

```bash
tvly --status   # version + auth source
```

Auth: `TAVILY_API_KEY` env var or `tvly login` (browser OAuth or
`--api-key`). Search and extract even work unauthenticated under a rate
cap; map/crawl/research require a key.

## Choosing the right command

Escalation ladder — start cheap, escalate only when needed:

| Need | Command | Credits | Latency |
| ---- | ------- | ------- | ------- |
| Find pages / answer from the web | `search` (basic) | 1 ($0.008) | ~1 s |
| Precision search, reranked chunks | `search --depth advanced` | 2 ($0.016) | ~2 s |
| Read known URLs (≤20 per call) | `extract` | 1 per 5 URLs | <1 s |
| Locate the right page on a big site | `map` | 1 per 10 pages | ~10–30 s |
| Bulk content from a site section | `crawl` | ~3 per 10 pages | ~30 s+ |
| Multi-source research report with citations | `research --model mini` | 4–110 ($0.03–0.88) | ~30 s–min |
| Complex multi-domain research | `research --model pro` | 15–250 ($0.12–2.00) | minutes |

## Search

```bash
tvly search "query" --max-results 5 --json
tvly search "query" --depth advanced --chunks-per-source 3
tvly search "query" --topic news --time-range week          # dated news results
tvly search "query" --topic finance --include-answer advanced
tvly search "query" --include-domains arxiv.org,github.com --start-date 2026-01-01
```

Query rules:

- Keyword-shaped, **under 400 characters** — a search query, not a prompt.
- **Disambiguate ambiguous entities explicitly** — retrieval is
  keyword-literal, with no intent inference. Verified failures: "Rust
  async traits" returned the Rust video game and Wikipedia's corrosion
  article; "Нова пошта" returned Wikipedia's "Nova". Write "Rust language
  async traits", "Нова пошта доставка".
- Anchor regional queries with city/country terms — results can drift to
  same-language sites from the wrong country (a Kyiv exchange-rate query
  returned Russian exchange sites).
- Expect occasional duplicate results from mirror domains (same article on
  `.com`/`.dev`/staging hosts) — dedupe by title before counting coverage.
- Split multi-facet questions into separate calls (`Competitors of X`,
  `Financial performance of X`, `Recent developments of X`) instead of one
  mega-query; calls are cheap and independent.
- **Depths**: `ultra-fast`/`basic` return NLP page summaries; `fast`/
  `advanced` return chunks (≤500 chars) reranked against the query — use
  `advanced` when hunting a specific fact. CLI default: `basic`.
- **Topics matter**: `--topic news` is a separate pipeline with publish
  dates and `--time-range day|week|month|year` — always use it for current
  events. `--topic finance` for market/financial queries. General-topic
  results carry no dates.
- Filters: `--include-domains` (≤300, wildcards like `*.gov` OK; also
  URL-path prefixes like `linkedin.com/in`), `--exclude-domains` (≤150),
  `--country <name>` (boost, e.g. `ukraine`, `united states`),
  `--start-date`/`--end-date`.
- `--include-answer basic|advanced` adds a composed, cited answer — use
  when the answer goes straight to the user; skip it when you'll reason
  over results yourself.
- Each result has a relevance `score` (0–1): post-filter with a ~0.5–0.7
  threshold; the score means query-relevance, not factual-match.

Regional queries: phrase the query in the local language (a Ukrainian query
surfaces local trackers and official operator pages that English misses).
Avoid combining `--country` with `--topic news` — it drags in social-media
noise.

## Extract

```bash
tvly extract URL1 URL2 --query "what you're looking for" --chunks-per-source 3 --json
tvly extract URL --format markdown            # whole page
```

Up to 20 URLs per call, 1 credit per 5 URLs (2 with
`--extract-depth advanced` — needed for dynamic/JS-heavy pages).
`--query` reranks chunks so you get the relevant part, not the whole page.
Failed extractions are free. Anonymous — login-walled pages won't work.

## Map and crawl

```bash
tvly map https://docs.example.com --limit 50 --select-paths "/docs/.*"
tvly crawl https://docs.example.com --max-depth 2 --limit 30 \
  --instructions "pages about authentication" --chunks-per-source 3 \
  --output-dir ./crawled
```

Map returns URLs only (site discovery); crawl returns page content
(map + extract billed together). Both take `--max-depth` (start with 1–2),
`--max-breadth`, `--limit`, and regex `--select-paths`/`--exclude-paths`/
`--select-domains`. **Always constrain scope**: an unconstrained map/crawl
wanders into external and sibling domains (verified — a map of
mise.jdx.dev drifted to asdf-vm.com). Use `--no-external` plus
`--select-paths`/`--select-domains`, and mind that `--instructions` doubles
map cost. Pattern: `map` first to find the right section, then `extract`
or a scoped `crawl`.

## Research

```bash
tvly research run "brief" --model mini --timeout 300 --json -o report.json   # waits, ~30 s+
tvly research run "brief" --model pro --no-wait                  # returns request_id
tvly research status <id>; tvly research poll <id>
tvly research run "brief" --output-schema schema.json            # structured output
tvly research run "brief" --citation-format apa
```

- `mini` handles well-scoped questions surprisingly well — verified: a
  multi-fact acquisition question answered in 32 s with primary-vs-secondary
  source discrimination. `pro` is multi-agent, for multi-domain reports.
  Default `auto` routes by complexity — set the model explicitly to pin
  cost (mini 4–110 credits, pro 15–250, dynamic per request).
- Brief-writing: state the goal, known context ("we already know X — don't
  re-research it"), constraints, and expected output format. Ask for
  primary-source verification explicitly.
- `--stream` for live output; default wait timeout 600 s
  (`--timeout`, `--poll-interval`).

Deeper reference: [references/search-and-extract.md](references/search-and-extract.md)
(depths, topics, response fields, filtering); [references/crawl-map-research.md](references/crawl-map-research.md)
(crawl/map parameters, research models and briefs, credit details).

## Cost discipline

- Basic search 0.8¢, advanced 1.6¢, extract ~0.16¢/URL — probe freely.
- Research is **dynamic-priced**: mini can reach $0.88, pro $2.00. Use mini
  for scoped questions; reserve pro for genuinely multi-domain reports the
  user asked for. Set `--model` explicitly — `auto` may pick pro.
- Crawl cost scales with pages: `--limit` and `--select-paths` are your
  budget controls; a depth-3 unconstrained crawl of a big docs site can
  burn hundreds of credits.
- Free tier: 1,000 credits/month covers ~1,000 basic searches.
