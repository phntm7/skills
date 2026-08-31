# Benchmark findings: Linkup vs Parallel vs Tavily vs TinyFish vs Firecrawl

Round 1 (2026-08-04/05) covers Linkup, Parallel, Tavily.
Round 2 (2026-08-18) adds TinyFish and Firecrawl and focuses on
bot-protected sites — see "Round 2" below.

## Round 1: Linkup vs Parallel vs Tavily

Method: hands-on tests run 2026-08-04/05. 25 identical queries (5 per
category) at comparable tiers (Linkup `standard` search-results, Parallel
`basic`, Tavily `basic`; news category used each tool's best news config).
Top-3 results graded 0–2 (2 = answer or authoritative source present,
1 = related, 0 = miss). Plus capability probes: speed tiers, LinkedIn,
PDF, JS pages, multi-step, structured output, entity lists, images,
research quality. Single-run scores — directional, not statistical.

## Scores (max 10 per cell)

| Category | Linkup | Parallel | Tavily |
| --- | --- | --- | --- |
| Programming (React 19, Rust async, Postgres 18, pnpm catalogs, Python no-GIL) | 7.5 | **8.5** | 6.5 |
| Niche tooling docs (mise, uv, Caddy, sentry-cli, ast-grep) | 8.5 | 9 | **9.5** |
| News (OpenAI, Anthropic, EU AI Act, Nvidia, Ukraine energy) | 6.5 | 5 | **10** |
| Ukrainian regional (outages, exchange, metro, Nova Poshta, Дія.Картка) | **9** | **9** | 7.5 |
| Freshness facts (USD/UAH, BTC, Node LTS, Apple event, iPhone UA price) | 8.5 | 8 | **9.5** |
| **Total /50** | 40 | 39.5 | **43** |

## Capability probes

- **Speed (fastest tiers)**: Tavily ultra-fast 0.87 s ≈ Parallel turbo
  0.99 s < Linkup fast 2.0 s — but Linkup composes a finished cited
  answer; the others return excerpts.
- **LinkedIn**: Linkup returned a full structured company profile from the
  exact URL (6 s). Parallel's entity-search returned licensed Tracxn
  firmographics (founders, funding, boards) with disambiguation (1.6 s).
  Tavily returned boilerplate.
- **PDF (arXiv)**: all three parsed perfectly, <2 s.
- **JS-heavy pricing page**: Tavily extract `--query` surfaced an actual
  price in 0.9 s; Parallel objective-excerpts hit the right section;
  Linkup returned the full 340 KB page.
- **Multi-step ("find Neon's pricing page, scrape it, return plans")**:
  only Linkup `deep` completed it in one call (14.7 s, $0.055). Parallel
  found official URLs (incl. an llms-friendly `.md` variant) needing a
  second call. Tavily returned third-party blogs and mirror-domain
  duplicates.
- **Structured extraction (company schema)**: Linkup `--schema` valid JSON
  in 2.7 s / $0.006 but data ~1 year stale; Parallel enrich lite-fast
  49.6 s / $0.005 with fresher data (caught a March 2026 funding round
  Linkup missed).
- **Entity lists**: Parallel entity-search returned an actual company list
  in 2 s; Linkup mixed real companies with hobby projects; Tavily
  returned listicles to read.
- **Images**: Tavily 5 relevant images with AI descriptions; Linkup 3
  loosely related; Parallel none.
- **Research quality (same acquisition question)**: Parallel `core-fast`
  45 s / $0.025 correct and verified; Tavily `mini` 32 s, best
  source discipline (flagged the $300M figure as secondary-source-only);
  Linkup `answer`/S ~4 min / $0.25, good but cited pricing aggregators
  over primary sources.

## Distinctive failures observed

- Tavily: "Rust async traits stabilization" → Rust the video game (Steam)
  + Wikipedia rust (corrosion); "Нова пошта" → Wikipedia "Nova"; Russian
  exchange sites for a Kyiv currency query; same article on `.com`/`.dev`/
  staging mirrors counted as 3 results.
- Parallel: `--after-date` returned zero results on sparse queries three
  separate times; xe.com results carried 2009 publish dates; quote-page
  excerpts without the actual number.
- Linkup: news queries dominated by LinkedIn posts; USD/UAH raw search
  returned 2015/2022 NBU archive pages; localized react.dev duplicates
  (ja/pl/zh) as separate results.

## Notable strengths observed

- Tavily news topic: 5/5 queries returned fresh, dated, journalistic
  sources (Reuters, CNBC, AP, Politico).
- Parallel: official/primary-source bias (GitHub issues, vendor docs,
  docs.astral.sh, pnpm.io); found canonical Ukrainian services
  (minfin.com.ua, novaposhtaglobal.ua).
- Linkup: live regional trackers with current status inline
  (alerts.energy "0 of 12 queues have outages"), official metro Telegram
  channel; sourced-answer mode composed the best direct answers.

## Round 2: adding TinyFish and Firecrawl (2026-08-18)

Method: `tinyfish` 0.23.0, `firecrawl-cli` 1.20.0, plus the three
incumbents. Fetch graded by *content signal in the extracted text*, not
HTTP success — a 200 that returns nav chrome is a fail. Search graded on
the same 5 queries across all five engines. Single-run; directional.

### Protected-site fetch matrix

`PASS` = target data present (price, m², rating, listings). Char counts
are extracted-text length at each CLI's max settings.

| Target | TinyFish | Linkup | Parallel | Tavily | Firecrawl |
| --- | --- | --- | --- | --- | --- |
| idealista.pt search page | FAIL `target_http_error` | FAIL unreachable | **PASS** 26.8k | FAIL | **PASS** 40.5k |
| idealista.pt single listing | FAIL `target_http_error` | FAIL unreachable | **PASS** 5.9k | FAIL | **PASS** 12.3k |
| amazon.com product page | PASS 86k | PASS 124k | PASS 60k | PASS 269k | PASS 225k |
| zillow.com search | PASS 720 (thin) | FAIL | PASS 7.1k | PASS 10.5k | **PASS** 54k |
| glassdoor.com reviews | FAIL | FAIL | PASS 4.2k | partial (no rating) | **PASS** 23.6k |
| booking.com results | PASS 8.2k | FAIL | PASS 40k | FAIL | **PASS** 75k |
| linkedin.com company | FAIL `bot_blocked` | PASS 1.2k | partial (no counts) | PASS 11.8k | FAIL (policy refusal) |
| arXiv PDF | **FAIL raw bytes** | PASS | PASS | PASS | PASS |
| **Clean passes /8** | 3 | 3 | **6** | 4 | **6** |

Idealista is the discriminator: **only Parallel and Firecrawl get through
it at all**. Amazon is not actually hard — all five pass; they differ only
in volume returned.

### Structured extraction from a protected page

Same live idealista listing, asked for price / area / rooms / location:

- **Firecrawl** `--format json --schema` → clean typed JSON:
  `{"price_eur":"669.000 €","area_m2":"110","rooms":"T2","location":"Rua
  Tenente Ferreira Durão s/n, Centro, Campo de Ourique, Lisboa"}` (5.6 s).
  Same flag on Amazon returned title + `$248.00` + `4.2 out of 5 stars`.
- **Parallel** `--objective` → correct data present but embedded in raw
  markdown; the agent still has to parse it.
- **Linkup** `--schema-file` → `{}` (it can't reach the page).
- **Tavily** `--query` / **TinyFish** `--format json` → hard fail.

### Search: same 5 queries, all five engines

All five answer in 1–3 s. The real spread is context cost per call:

| Engine | Results | Snippet chars/call | Dates present |
| --- | --- | --- | --- |
| TinyFish | 7–10 | **~1.0–1.5k** | **1–7 of 10** |
| Tavily | 5 | 2–6k | 0 |
| Firecrawl | 10 | 2–27k (varies wildly) | 0 on `web` |
| Linkup `search-results` | 20 | 30–49k | 0 |
| Parallel | 10 | 28–60k | 4–9 of 10 |

TinyFish is a Google-SERP mirror: highest precision per token in this
round (top-1 = `docs.python.org/3/library/asyncio-task.html`,
`openai.com/news/`, the idealista price report), at ~1/30th of Parallel's
or Linkup's payload. It returns snippets only — no page content — so
anything beyond grounding needs a second fetch call.

### Distinctive failures observed (round 2)

- **TinyFish `--location` silently ignores anything but an ISO 3166-1
  alpha-2 code.** `--location "Lisbon, Portugal"`, `Portugal`, `Lisboa`,
  and `Tokyo, Japan` were all discarded; `--location pt` and `ua` worked
  (thefork.pt / tripadvisor Kyiv). Worse, with no valid location the
  results anchor to a **random rotating US city per call** — two identical
  `"best restaurants"` calls returned Chapel Hill/Miami then Hiram, GA.
  Always pass `--location <iso2>`; results are otherwise irreproducible.
  `--language` appeared inert in every combination tested.
- **TinyFish fetch does not parse PDFs.** `arxiv.org/pdf/1706.03762`
  returned literal `%PDF-1.5` binary in the `text` field. The other four
  all parse it. `--include-etag-and-last-modified` returned no etag or
  last_modified keys on any page tested, so the documented conditional-GET
  flow (`--if-none-match`) has nothing to feed it.
- **Firecrawl multi-URL `scrape` prints nothing to stdout** — it writes
  `.firecrawl/<host>.md` files into the CWD and littered this repo. Use
  one URL per call, or expect files.
- **Firecrawl refuses LinkedIn by policy** ("we do not support this
  site"), so Linkup keeps LinkedIn outright.
- **Firecrawl `research search-papers` → HTTP 401** on this account; the
  paper index is not entitled by default. `developer` works fine.
- Firecrawl free tier caps **concurrency at 2** — batches queue, unlike
  the other four.

### Notable strengths observed (round 2)

- **Firecrawl `developer`** searches a coding-agent index (GitHub issues,
  merged PRs, READMEs, curated docs) and nailed a niche query: top hits
  were `python/cpython#155433` "`asyncio.TaskGroup` swallows
  cancellations coming from outside of it" and `#137517`, with matched
  passages and SPDX license state. No other engine here has an equivalent.
- **Firecrawl `--categories github,research,pdf`** hard-filters search to
  those source types (all 5 results were github.com issues/repos), and
  `--location "Lisboa,Portugal" --country PT` geo-targets correctly with
  human-readable names — the thing TinyFish gets wrong.
- **Firecrawl `--scrape`** returns search results *with* full markdown in
  one call (71 KB for the top hit, 4 credits for 2 results).
- **TinyFish Search and Fetch are $0 per call on every plan**, including
  free — plans buy throughput, not calls (30 search/min, 150 fetch/min on
  paid; 5 search/min free). It also fetches multiple URLs per call
  (3 URLs, 165 KB, 10 s) and offers a structured document-tree
  `--format json` and `--links`/`--image-links`.
- **Parallel caches aggressively**: first idealista fetch took 41 s live,
  repeats served in 0.7 s, and `--disable-cache-fallback` still succeeded
  (that flag rejects only *stale* content, not cache hits).

### Cost observed (round 2)

- TinyFish search + fetch: **$0**, rate-limited only.
- Firecrawl: 1 credit/scrape, 2/search, 4 for search+scrape of 2 results;
  ~57 credits consumed across this round of 1,000/mo free.
