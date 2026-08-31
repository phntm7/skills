---
name: web-search-router
description: >
  Use before web search, extraction, crawling, entity lookup, or monitoring when
  Linkup, Parallel, Tavily, TinyFish, and Firecrawl are available; it selects the
  best engine by capability, reliability, and cost.
---

# Web search CLI router

Last verified: 2026-08-18. Routing rules distilled from a 25-query
benchmark (5 categories × 3 engines), a 5-engine protected-site round,
plus capability tests — evidence in
[references/benchmark-findings.md](references/benchmark-findings.md).

Five CLIs, five specialists. Per-command usage for the first three lives
in the sibling skills `linkup-search`, `parallel-search`, `tavily-search`;
TinyFish and Firecrawl commands are inline here.

- **Linkup** — answer engine: composed cited answers, LinkedIn extraction,
  single-call sequential deep search, structured JSON at search tier.
- **Parallel** — structured-data platform: primary-source-biased index,
  licensed entity data (Tracxn), tabular enrichment, monitors, cheapest
  research tiers. Cracks bot-protected sites.
- **Tavily** — content-acquisition toolkit: news/finance topic pipelines,
  crawl/map, query-focused extraction, image search.
- **TinyFish** — free SERP mirror: cheapest grounding by far ($0/call,
  ~1.2k chars per search), best dates, snippets only. Weak fetch.
- **Firecrawl** — scraper-first platform: best protected-site coverage,
  schema-typed extraction from any page, GitHub/docs `developer` index.

On plain "search the web" the engines are near-equal — routing matters at
the edges, not the average. Where they differ sharply is **fetching pages
that fight back** and **cost per call**.

## Routing table

| Task | Use | Command sketch |
| ---- | --- | -------------- |
| Quick fact to ground a reply | **TinyFish** — $0, ~1.2k chars, dated results | `tinyfish search query "..." --location us` |
| General agent search step | TinyFish (cheapest) → Parallel basic (programming) / Tavily (docs lookup) if snippets are too thin | see sibling skills |
| Programming question: library behaviour, API contract, error message, known bug | **Firecrawl `developer`** — GitHub issues, merged PRs, READMEs, curated docs | `firecrawl developer "..." --limit 10` |
| News, current events | **Tavily** — first choice (5/5 in our single-run benchmark) | `tvly search "..." --topic news --time-range week` |
| Regional news (e.g. Ukraine-local) | Tavily news topic *without* `--country`, query in the local language; cross-check with Linkup/Parallel general search | locale drift is Tavily's weak spot |
| Live numbers: rates, prices | Tavily or Linkup (numbers appear in snippets); NOT Parallel raw search | `tvly search "..." --topic finance --include-answer advanced` |
| LinkedIn profile / posts / comments | **Linkup only** | `linkup search "{linkedin_url} Return the profile details."` |
| Entity lists, firmographics, people search | **Parallel** (licensed data) | `parallel-cli findall entity-search "..." -t companies` |
| Enrich CSV/JSON rows with web data | **Parallel** | `parallel-cli enrich run --data '...' --intent "..."` |
| Crawl a docs site / map site URLs | **Tavily** or **Firecrawl** (`map` supports `--search` filtering and sitemap modes) | `tvly map URL` → `tvly crawl URL --select-paths ...` |
| Find page → scrape → extract, one call | **Firecrawl** `search --scrape` (results + full markdown, 4 credits) or **Linkup deep** ($0.055) | `firecrawl search "..." --limit 3 --scrape --scrape-formats markdown` |
| Specific fact inside a big/JS page | Tavily extract `--query` or Parallel fetch `--objective` | `tvly extract URL --query "..."` |
| Full page as markdown | any except TinyFish for PDFs | cheapest: TinyFish $0, then Linkup fetch $0.001 |
| **PDF** | Linkup / Parallel / Tavily / Firecrawl — **never TinyFish** (returns raw `%PDF` bytes) | `firecrawl scrape URL.pdf` |
| **Bot-protected site** (idealista, glassdoor, booking, zillow) | **Firecrawl** first, **Parallel** second — the only two that get through. Everything else fails | `firecrawl scrape URL --only-main-content` |
| **Typed fields out of a protected page** (price, area, rating) | **Firecrawl** `--format json --schema` — returns clean typed JSON in one call | `firecrawl scrape URL --format json --schema '{"type":"object","properties":{"price":{"type":"string"}}}'` |
| Structured JSON from reachable pages | Linkup `--schema` (search tier, ~3 s, $0.006) | fresher but slower: Parallel enrich |
| Page summary instead of full text | **Firecrawl** `--format summary` | saves context on long articles |
| Geo-targeted search | **Firecrawl** (`--location "Lisboa,Portugal" --country PT`) or TinyFish `--location <iso2>` | Firecrawl accepts human-readable names; TinyFish only ISO codes |
| Restrict search to GitHub / papers / PDFs | **Firecrawl** `--categories github,research,pdf` | hard filter, not a hint |
| Continuous monitoring / webhooks | **Parallel monitor** (only option); recurring cost — confirm with user first | `parallel-cli monitor create "..." --frequency 6h` |
| Ukrainian / regional queries | Linkup (live trackers, Telegram) or Parallel (official service sites); query in the local language | Tavily third — locale drift |
| Offloaded research, scoped question | Parallel `core-fast` ($0.025, ~1 min) or Tavily `mini` ($0.03–0.88 dynamic, best source discipline) | Linkup research is 10× pricier at entry |
| Offloaded research, broad report | Parallel `pro`/`ultra` or Tavily `pro`; Linkup `investigate`/`research` for EU/LinkedIn-heavy topics | confirm cost with user first |
| Bulk/batch lookups | **Linkup tasks** (CLI, 100/batch); **TinyFish fetch** takes many URLs per call for free; Parallel's Task Group API is not exposed by `parallel-cli` | Tavily CLI has no batch; Firecrawl free tier caps concurrency at 2 |

## Failure modes — route around these

- **Tavily is keyword-literal**: ambiguous entities fail hard ("Rust async
  traits" → the Rust video game; "Нова пошта" → Wikipedia "Nova"). Always
  disambiguate in the query ("Rust language ..."). It can also drift to
  wrong-country sites on regional queries and returns duplicate content
  across mirror domains. No publish dates outside news topic.
- **Parallel's `--after-date` is a hard filter over sparse metadata** —
  sparse queries return zero results (observed 3×). For recency, omit it
  and sort by `publish_date` yourself (often `null` on general results).
  Its excerpts often point at the page *with* the number (quote pages)
  without quoting the number — follow up with fetch. Weakest on
  Ukrainian/regional content.
- **Linkup's news-ish results are LinkedIn posts** — fresh (24–48 h) and
  they do carry the story, but they're social posts, not citable sources.
  Fine for "what's the buzz", wrong for citations. Raw `search-results`
  can also surface years-stale pages for live data — use `sourced-answer`
  there. Index favors content sites/blogs over primary docs.
- **TinyFish `--location` accepts only ISO 3166-1 alpha-2 codes** and
  silently discards anything else. With no valid code, results anchor to a
  **random rotating US city per call** — the same query twice returned
  Chapel Hill then Hiram, GA. Always pass `--location <iso2>` or results
  are irreproducible. `--language` appeared inert. Its fetch also fails
  outright on PDFs and on hard-protected sites (`target_http_error`,
  `bot_blocked`), and returns snippets only — no page content.
- **Firecrawl refuses LinkedIn by policy** and its `research
  search-papers` index returns 401 unless entitled. Multi-URL `scrape`
  prints nothing to stdout — it writes `.firecrawl/<host>.md` into the CWD,
  so pass one URL per call unless you want files in the repo.

## Cost cheat sheet (per call)

| | TinyFish | Linkup | Parallel | Tavily | Firecrawl |
| --- | --- | --- | --- | --- | --- |
| Search | **$0** | $0.005–0.006 (deep $0.05) | $0.001–0.005 incl. 10 results, +$0.001/extra | $0.008 (advanced $0.016) | 2 credits |
| Fetch/extract | **$0** | $0.001–0.005 | $0.001 **per URL** | ~$0.0016/URL | 1 credit/page |
| Research | — | $0.25–2.50 | $0.005–2.40 | $0.03–2.00 (dynamic) | agent jobs, per-step |
| Free tier | unlimited calls, 5 search/min | $20/mo credits | $5/mo + 5k req | 1,000 credits/mo | 1,000 credits/mo, concurrency 2 |

TinyFish charges $0 per call on every plan — plans buy throughput
(30 search/min, 150 fetch/min paid), not calls. Open there when a snippet
is enough.

## Patterns

- **Escalate stepwise**: cheap search → advanced/deep search → research at
  the lowest sufficient tier. Never open with research for something a
  half-cent search answers.
- **Start free**: TinyFish search first for anything a SERP snippet
  answers; escalate to a paid engine only when you need page content,
  composed answers, or a site TinyFish can't reach.
- **Cross-check load-bearing facts** across two engines (~1¢ total) —
  their indexes differ enough that agreement is meaningful.
- **Protected-site ladder**: Firecrawl `scrape` → Firecrawl
  `--format json --schema` if you need fields → Parallel `fetch` as the
  second opinion. Don't burn calls on Tavily/Linkup/TinyFish there.
- **Combine specialists**: Tavily news headline → Parallel entity data on
  the company → Linkup LinkedIn posts for the people involved →
  Firecrawl `developer` for the library bug behind it.
- Only one CLI installed? Its sibling skill stands alone — this router
  only matters when there's a choice.
