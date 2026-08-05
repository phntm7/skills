# Search and extract in detail

Sources: Tavily docs + official tavily-ai/skills repo, verified hands-on
2026-08-04.

## Depths and content types

| Depth | Latency | Relevance | Returns | Credits |
| ----- | ------- | --------- | ------- | ------- |
| `ultra-fast` | lowest | lower | NLP page summary | 1 |
| `fast` | low | good | reranked chunks | 1 |
| `basic` (CLI default) | medium | high | NLP page summary | 1 |
| `advanced` | higher | highest | reranked chunks | 2 |

- **Summary vs chunks**: summaries give general page context; chunks
  (≤500 chars each, `--chunks-per-source 1–5` on fast/advanced) are
  reranked against the query — better for pinpointing a specific fact.
- Tavily's own guidance: `advanced` is "still fast and suitable for almost
  all use cases" when precision matters; `basic` is the balanced default.

## Topics

- `--topic news`: separate news pipeline. Results carry RFC-format publish
  dates; combine with `--time-range day|week|month|year`. Dramatically
  better than general topic for current events (verified: real dated
  CNBC/Reuters headlines vs aggregator noise from general search).
- `--topic finance`: market-oriented retrieval; combine with
  `--include-answer advanced` for a cited rate/price answer.
- `--topic general` (default): no publish dates in results.

## Filtering

- `--include-domains`: max 300 entries, wildcard support (`*.gov`), and
  URL-path prefixes work (`linkedin.com/in` limits to profile pages).
- `--exclude-domains`: max 150 (e.g. drop `reddit.com,quora.com`).
- `--country <full name>`: boosts (not restricts) results from a country —
  `ukraine`, `united states`. Skip it for local-language queries, which do
  the job better on their own.
- `--start-date`/`--end-date` (YYYY-MM-DD) or relative `--time-range`.
- Publish-date metadata on the general topic is unreliable; date filters
  are approximate outside news topic.

## Answer and raw content

- `--include-answer basic|advanced`: composed answer with source
  citations. Good quality-per-cost for user-facing direct answers; skip
  when the agent reasons over results itself.
- `--include-raw-content markdown|text`: full page content inline with
  search results — a search+extract in one call; use sparingly, it can
  flood context.
- `--include-images` / `--include-image-descriptions` for image results.

## Response shape (`--json`)

Top level: `query`, `answer` (if requested), `results[]`, `images[]`,
`response_time`, `request_id`. Per result: `title`, `url`, `content`,
`score` (0–1 relevance), `raw_content` (if requested),
`published_date` (news topic only).

Post-filtering: the `score` measures relevance to the query, not whether
the result matches strict criteria (right person, right product). Filter
`score > 0.5–0.7`, then verify entity identity from content/URL patterns
before trusting a result.

## Extract

- Up to 20 URLs per call; billed 1 credit per 5 successful extractions
  (basic) or 2 per 5 (`--extract-depth advanced`). Failures are free.
- `--extract-depth advanced` for JS-heavy/dynamic pages, tables, embedded
  content; basic for static pages.
- `--query "..."` + `--chunks-per-source 1–5` returns only chunks relevant
  to the query instead of the whole page — verified sub-second retrieval of
  one specific settings section from a large docs page.
- `--format markdown|text`; `--include-images`; `--timeout 1–60`.
- Anonymous fetches: login walls (LinkedIn etc.) return nothing useful.

## Patterns

- **Search → extract**: search with `--depth basic`, pick top URLs by
  score, then one batched extract with `--query` focus.
- **Split queries**: three cheap focused searches beat one compound query —
  different facets rank differently.
- **Direct answer**: `--topic finance --include-answer advanced` for
  rates/prices; `--topic news --time-range week` for "what happened".
