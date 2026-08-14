---
name: web-search-router
description: >
  Use before web search, extraction, crawling, entity lookup, or monitoring when
  Linkup, Parallel, and Tavily are available; it selects the best engine by capability,
  reliability, and cost.
---

# Web search CLI router

Last verified: 2026-08-05. Routing rules distilled from a 25-query
benchmark (5 categories × 3 engines) plus capability tests — evidence in
[references/benchmark-findings.md](references/benchmark-findings.md).

Three CLIs, three specialists. Per-command usage lives in the sibling
skills: `linkup-search`, `parallel-search`, `tavily-search`.

- **Linkup** — answer engine: composed cited answers, LinkedIn extraction,
  single-call sequential deep search, structured JSON at search tier.
- **Parallel** — structured-data platform: primary-source-biased index,
  licensed entity data (Tracxn), tabular enrichment, monitors, cheapest
  research tiers.
- **Tavily** — content-acquisition toolkit: news/finance topic pipelines,
  crawl/map, query-focused extraction, image search.

On plain "search the web" the three are near-equal (benchmark totals
40 / 39.5 / 43 of 50) — routing matters at the edges, not the average.

## Routing table

| Task | Use | Command sketch |
| ---- | --- | -------------- |
| Quick fact to ground a reply | Parallel turbo ($0.001) or Linkup fast (composed answer, $0.006) | `parallel-cli search -q "..." --mode turbo` |
| General agent search step | Parallel basic (programming) / Tavily (docs lookup) — close call, any works | see sibling skills |
| News, current events | **Tavily** — first choice (5/5 in our single-run benchmark) | `tvly search "..." --topic news --time-range week` |
| Regional news (e.g. Ukraine-local) | Tavily news topic *without* `--country`, query in the local language; cross-check with Linkup/Parallel general search | locale drift is Tavily's weak spot |
| Live numbers: rates, prices | Tavily or Linkup (numbers appear in snippets); NOT Parallel raw search | `tvly search "..." --topic finance --include-answer advanced` |
| LinkedIn profile / posts / comments | **Linkup only** | `linkup search "{linkedin_url} Return the profile details."` |
| Entity lists, firmographics, people search | **Parallel** (licensed data) | `parallel-cli findall entity-search "..." -t companies` |
| Enrich CSV/JSON rows with web data | **Parallel** | `parallel-cli enrich run --data '...' --intent "..."` |
| Crawl a docs site / map site URLs | **Tavily** | `tvly map URL` → `tvly crawl URL --select-paths ...` |
| Find page → scrape → extract, one call | **Linkup deep** ($0.055) | `linkup search "First find... Then scrape... Then return..." --depth deep` |
| Specific fact inside a big/JS page | Tavily extract `--query` or Parallel fetch `--objective` | `tvly extract URL --query "..."` |
| Full page as markdown (incl. PDF) | any — all three parse PDFs well | cheapest: Linkup fetch $0.001 |
| Structured JSON, one-shot | Linkup `--schema` (search tier, ~3 s, $0.006) | fresher but slower: Parallel enrich |
| Image search | **Tavily** (`--include-image-descriptions`) | Linkup weaker, Parallel none |
| Continuous monitoring / webhooks | **Parallel monitor** (only option); recurring cost — confirm with user first | `parallel-cli monitor create "..." --frequency 6h` |
| Ukrainian / regional queries | Linkup (live trackers, Telegram) or Parallel (official service sites); query in the local language | Tavily third — locale drift |
| Offloaded research, scoped question | Parallel `core-fast` ($0.025, ~1 min) or Tavily `mini` ($0.03–0.88 dynamic, best source discipline) | Linkup research is 10× pricier at entry |
| Offloaded research, broad report | Parallel `pro`/`ultra` or Tavily `pro`; Linkup `investigate`/`research` for EU/LinkedIn-heavy topics | confirm cost with user first |
| Bulk/batch lookups | **Linkup tasks** (CLI, 100/batch); Parallel's Task Group API is not exposed by `parallel-cli` (its CLI bulk path is `enrich` for tabular rows) | Tavily CLI has no batch |

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

## Cost cheat sheet (per call)

| | Linkup | Parallel | Tavily |
| --- | --- | --- | --- |
| Search | $0.005–0.006 (deep $0.05) | $0.001–0.005 incl. 10 results, +$0.001/extra result | $0.008 (advanced $0.016) |
| Fetch/extract | $0.001–0.005 | $0.001 **per URL** | ~$0.0016/URL |
| Research | $0.25–2.50 | $0.005–2.40 | $0.03–2.00 (dynamic) |
| Free tier | $20/mo credits | $5/mo + 5k req | 1,000 credits/mo |

## Patterns

- **Escalate stepwise**: cheap search → advanced/deep search → research at
  the lowest sufficient tier. Never open with research for something a
  half-cent search answers.
- **Cross-check load-bearing facts** across two engines (~1¢ total) —
  their indexes differ enough that agreement is meaningful.
- **Combine specialists**: Tavily news headline → Parallel entity data on
  the company → Linkup LinkedIn posts for the people involved.
- Only one CLI installed? Its sibling skill stands alone — this router
  only matters when there's a choice.
