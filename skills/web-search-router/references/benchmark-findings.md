# Benchmark findings: Linkup vs Parallel vs Tavily

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
