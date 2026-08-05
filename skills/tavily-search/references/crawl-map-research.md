# Crawl, map, and research in detail

Sources: Tavily docs + official tavily-ai/skills repo, verified hands-on
2026-08-04.

## Crawl vs map

| | `crawl` | `map` |
| --- | --- | --- |
| Returns | full page content | URLs only |
| Speed | slower | faster |
| Credits | ~3 per 10 pages basic (map 1 + extract 2); ~5 with advanced extraction | 1 per 10 pages; 2 with `--instructions` |
| Use for | RAG corpora, docs sections, bulk content | site structure, finding the right page, pre-crawl planning |

## Shared parameters

- `--max-depth 1–5`: link levels from the root. **Start with 1–2** — cost
  and drift grow fast with depth.
- `--max-breadth`: links followed per page (default 20).
- `--limit`: total page cap (default 50) — the primary budget control.
- `--select-paths` / `--exclude-paths`: comma-separated regex on paths
  (`/docs/.*`, `/api/v1.*`).
- `--select-domains` / `--exclude-domains`: regex on domains — needed to
  stay on one subdomain.
- `--allow-external/--no-external`: API default is external links **on**
  for crawl, off for map — but drift happens regardless via redirects and
  sibling subdomains (verified: mapping mise.jdx.dev with instructions
  pulled in asdf-vm.com and aube.jdx.dev). Pass `--no-external` and
  `--select-domains` explicitly for any scoped job.
- `--instructions "natural language"`: semantic focus for the
  crawler/mapper (doubles map cost); with `--chunks-per-source 1–5` on
  crawl, returns only relevant chunks per page instead of full content —
  the main defense against context explosion.
- `--timeout 10–150`; crawl `--output-dir DIR` writes one .md per page.

## Crawl workflow

1. `map` the site first (cheap) to see structure and count pages.
2. Scope with `--select-paths` and `--limit` from what map showed.
3. Crawl with `--instructions` + `--chunks-per-source 3` unless you truly
   need full pages.
4. For a handful of known URLs, skip crawl — batched `extract` is cheaper
   and faster.

## Research models

| Model | Credits/request | Character |
| ----- | --------------- | --------- |
| `mini` | 4–110 ($0.03–0.88) | Targeted agentic research for scoped questions |
| `pro` | 15–250 ($0.12–2.00) | Multi-agent, multi-domain comprehensive reports |
| `auto` (default) | either | Routes by complexity — unpredictable cost; set the model explicitly |

Pricing is dynamic within the range per request. Verified: a scoped
multi-fact question on `mini` completed in 32 s and correctly separated
primary-source facts from unverified secondary reporting.

## Research brief writing

From Tavily's guidance:

- Clear goal + essential context + desired output format; no
  contradictions.
- Be specific where you can (market, geography, competitors, constraints);
  stay open-ended only for deliberate discovery.
- Include what you already know so it isn't re-researched: "We already
  know X and Y. Research Z."
- Ask explicitly for primary-source verification and citations when
  accuracy matters.

## Research CLI mechanics

```bash
tvly research run "brief" --model mini --json -o out.json   # blocks (default timeout 600 s)
tvly research run "brief" --model pro --no-wait             # → request_id
tvly research status <request_id>
tvly research poll <request_id>                             # block until done
tvly research run "brief" --stream                          # live output
tvly research run "brief" --output-schema schema.json       # structured JSON output
tvly research run "brief" --citation-format numbered|mla|apa|chicago
```

Response fields: `content` (the report), `sources`, `status`,
`request_id`, `response_time`, `created_at`. With `--output-schema`, the
output conforms to your JSON schema instead of a prose report.

From a coding agent: `mini` is fine to run inline (~30 s–2 min); for `pro`
submit `--no-wait` and poll between other work, or run the blocking call
as a background task.
