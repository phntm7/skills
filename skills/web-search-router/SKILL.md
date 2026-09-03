---
name: web-search-router
description: >
  Route web search, extraction, crawling, entity lookup, or monitoring across
  Linkup, Parallel, Tavily, TinyFish, and Firecrawl when multiple engines are
  available; use the selected engine's skill for execution details, or this
  skill's inline command for TinyFish and Firecrawl.
---

# Web search CLI router

Last verified: 2026-09-03 (vendor capability and pricing docs re-checked;
routing evidence still the 2026-08-04/05 and 2026-08-18 benchmark rounds).

Routing rules come from a 25-query benchmark plus a 5-engine
protected-site round; that dated evidence, and the vendor doc links behind
every cost and capability claim here, live in
[references/benchmark-findings.md](references/benchmark-findings.md).
Per-command usage lives in the `linkup-search`, `parallel-search`, and
`tavily-search` skills — load the one you route to before running it;
TinyFish and Firecrawl have no sibling skill, so their commands are inline.

- **Linkup** — cited answers, LinkedIn, deep search, typed JSON (search
  and fetch).
- **Parallel** — primary-source index, licensed entity data (Tracxn),
  enrichment, monitors, cheapest research tiers.
- **Tavily** — news/finance topics, crawl/map, targeted extraction, images.
- **TinyFish** — free SERP mirror: $0 per call, ~1.2k chars, dates on many
  results, snippets only.
- **Firecrawl** — protected-site coverage, schema-typed extraction,
  GitHub/docs `developer` index.

On plain "search the web" the engines are near-equal — routing matters at
the edges: **fetching pages that fight back** and **cost per call**. Done
means: after picking a route, load its execution skill, state any paid or
recurring cost, run the command, then return the requested fields or
citations — or the terminal error plus the fallback you tried.

## Routing table

| Task | Route |
| ---- | ----- |
| Quick fact to ground a reply | **TinyFish** — $0, ~1.2k chars: `tinyfish search query "..." --location pt`; escalate to Parallel or Tavily when snippets are too thin |
| Programming: library behaviour, API contract, error message, known bug | **Firecrawl `developer`** — GitHub issues, merged PRs, READMEs, curated docs: `firecrawl developer "..." --limit 10` |
| News, current events | **Tavily** news topic; for regional news drop `--country`, query in the local language, and cross-check with Linkup or Parallel |
| Live numbers: rates, prices | Tavily or Linkup, where numbers appear in snippets; fetch a Parallel result when its excerpt omits the value |
| LinkedIn profile / posts / comments | **Linkup** — Firecrawl refuses LinkedIn by policy and anonymous fetchers hit the login wall |
| Entity lists, firmographics, people search, row enrichment | **Parallel** (licensed data) |
| Crawl a docs site / map site URLs | **Tavily**, or **Firecrawl** `map` for `--search` filtering and sitemap modes |
| Find page → scrape → extract, one call | **Firecrawl** `search "..." --limit 3 --scrape --scrape-formats markdown` (5 credits: 2 per 10 results + 1 per page) or **Linkup** deep search ($0.055) |
| Specific fact inside a big or JS-heavy page | Tavily extract `--query`, or Parallel fetch `--objective` |
| Full page as markdown, including **PDFs** | any of the five — current docs say all parse PDFs; cheapest is TinyFish ($0), then Linkup fetch ($0.001). Verify the text is not raw `%PDF` bytes; **Firecrawl** `scrape URL --format summary` returns a summary instead |
| **Bot-protected site** (idealista, glassdoor, booking, zillow) | **Firecrawl** `scrape URL --only-main-content` first, **Parallel** fetch second; record what failed |
| **Typed fields out of a page** | protected → **Firecrawl** `scrape URL --format json --schema '{...}'` (1 credit + 4/page); reachable → **Linkup** `fetch --schema --instructions` (+$0.001) or `search --schema` |
| Geo-targeting or source-type filters | **Firecrawl** `--location "Lisboa,Portugal" --country PT` and `--categories github,research,pdf` (hard filter); TinyFish `--location` also documents human-readable locations |
| Continuous monitoring / webhooks | **Parallel monitor**; recurring cost — confirm with the user first |
| Offloaded research | scoped: Parallel `core-fast` ($0.025) or Tavily `mini` ($0.03–0.88, best source discipline). Broad: Parallel `pro`/`ultra`, Tavily `pro`, or Linkup `investigate`/`research` for EU/LinkedIn-heavy topics — confirm cost first |
| Bulk/batch lookups | **Linkup tasks** (100 per batch) or **TinyFish fetch** (many URLs per call, free); Tavily has no batch, Firecrawl free tier caps concurrency at 2 |

## Failure modes — route around these

- **Tavily is keyword-literal**: disambiguate the entity in the query
  ("Rust language ..."), dedupe mirror domains, expect no publish dates
  outside the news topic, and watch for wrong-country drift.
- **Parallel's `--after-date` is a hard filter over sparse metadata** —
  omit it and sort by `publish_date` yourself. Its excerpts often point at
  the page *with* a number without quoting it; follow up with a fetch.
- **Linkup's news-ish results are LinkedIn posts** — fresh but social, not
  citable. Use `sourced-answer` for live data; raw `search-results` can
  surface years-stale pages.
- **TinyFish**: pass `--location` explicitly. Current docs accept
  human-readable locations, but in the 2026-08-18 sample only ISO 3166-1
  alpha-2 codes took effect and locationless calls anchored to a random
  rotating US city. That round also got raw `%PDF` bytes from its fetch
  although the Fetch docs now document PDF text — re-test before relying
  on either.
- **Firecrawl** multi-URL `scrape` prints nothing to stdout: it writes
  `.firecrawl/<host>.md` into the CWD, so pass one URL per call.

## Cost cheat sheet (per call)

| | TinyFish | Linkup | Parallel | Tavily | Firecrawl |
| --- | --- | --- | --- | --- | --- |
| Search | **$0** | $0.005–0.006 (deep $0.05 raw results, $0.055 answer or typed) | $0.001–0.005 incl. 10 results, +$0.001/extra | $0.008 (advanced $0.016) | 2 credits per 10 results |
| Fetch/extract | **$0** | $0.001 standard → $0.01 `pro --render-js`, +$0.001 with a schema | $0.001 **per URL** | ~$0.0016/URL | 1 credit/page markdown, +4/page with `--format json` |
| Research | — | $0.25–2.50 | $0.005–2.40 | $0.03–2.00 (dynamic) | agent jobs, per-step |
| Included allowance | $0 on all usage: 30 searches/min and 500/hr, 150 fetch URLs/min and 1,000/day | eligible accounts: $20 initial/monthly top-up | $5/mo + 5k req | 1,000 credits/mo | 1,000 credits/mo, concurrency 2 |

## Patterns

- **Escalate stepwise**: open at the cheapest sufficient tier — cheap
  search → deep search → research — and step up only when the evidence is
  insufficient.
- **Start free**: TinyFish search for anything a SERP snippet answers; pay
  when you need page content, a composed answer, or a site it can't reach.
- **Cross-check load-bearing facts** across two engines (~1¢ total); their
  indexes differ enough that agreement is meaningful.
- **Protected-site ladder**: Firecrawl `scrape` → Firecrawl `--format json
  --schema` for fields → Parallel `fetch` as the second opinion.
- **Combine specialists**: Tavily news headline → Parallel entity data →
  Linkup LinkedIn posts → Firecrawl `developer` for the library bug.
- Only one CLI installed? Its own skill stands alone.
