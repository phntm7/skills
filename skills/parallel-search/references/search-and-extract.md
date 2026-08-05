# Search and extract in detail

Source: Parallel docs (docs.parallel.ai), verified 2026-08-04.

## Modes

| Mode | Latency | Cost /1k | Notes |
| ---- | ------- | -------- | ----- |
| `turbo` | ~200 ms | $1 | Grounding/lookup at chat speed. English + Japanese only. |
| `basic` | ~1 s | $5 | Best default for agent workloads; works best with 2–3 good `-q` queries. |
| `advanced` | ~3 s | $5 | Deeper retrieval + compression pipeline; multi-hop quality per call. API default; CLI defaults to `basic`. |

Legacy CLI aliases: `one-shot`/`fast` → basic, `agentic` → advanced.

Pick `basic` unless: latency/cost dominate at high volume (turbo) or result
quality matters more than 2 extra seconds (advanced — good for background
agents, code review, research steps).

## Objective + queries interplay

Provide both. The objective carries intent and context; the queries carry
retrieval diversity.

```bash
parallel-cli search \
  "What EV tax credits apply to small businesses in California, and how do they differ for leasing vs buying?" \
  -q "EV tax credit business" -q "California EV rebate lease" -q "federal EV incentive purchase vs lease"
```

Query rules (from Parallel's own tool definition):

- Exactly 2–3 diverse queries is the sweet spot (max 5, 200 chars each).
- 3–6 words each; always include the key entity or topic.
- Vary entity names, synonyms, and angles across queries.
- Never sentences, never instructions, never `site:` operators.

Objective rules:

- Self-contained: include the entity/topic — don't rely on conversation
  context the API can't see.
- Fold in source and freshness preferences: "prefer official documentation",
  "focus on announcements from the past 3 months".
- Complex multi-part questions are fine — Parallel resolves multi-topic
  queries in a single call; that's the point of the objective field.

## Freshness and caching

Default serves indexed (cached) content — fast. Controls:

- `--max-age-seconds N` (min 600): fetch live content when cache is older.
  Significantly increases latency; use for prices, news, live data.
- `--disable-cache-fallback`: error instead of silently serving stale
  content when live fetch fails.
- Standard vs `-fast` research processors make the same trade at the
  research level.

## Session and model hints

- `--session-id`: pass the same id across the search + fetch calls of one
  logical task (UUID with a prefix works well); server returns one if
  omitted — reuse it. Groups calls for relevance treatment.
- `--client-model`: the model consuming the results (e.g.
  `claude-fable-5`). Enables model-tailored excerpt sizing/format.

## Source policy

- `--include-domains` is a **hard allowlist** — nothing outside it is
  searched. Quality drops sharply if relevant pages live elsewhere. Use
  only for compliance-bound corpora or single-known-publisher tasks.
- `--exclude-domains` blocks specific sites; much safer.
- Prefer steering in the objective ("prefer official documentation over
  blogs") when the open web should stay available.
- `--after-date YYYY-MM-DD` restricts by publish date; publish metadata is
  imperfect, treat as approximate.
- `--location <iso2>` geo-targets results (`us`, `gb`, `de`, `jp`, ...);
  unsupported codes are ignored with a warning.

## Extract (fetch)

`parallel-cli fetch` / `parallel-cli extract` (same command):

```bash
parallel-cli fetch https://a.com/doc https://b.com/paper.pdf \
  --objective "I'm researching React performance. Find guidance on preventing unnecessary re-renders." \
  -q "React.memo" -q "useMemo useCallback" --json
```

- Up to 20 URLs per request; batch instead of looping.
- JS-heavy pages and PDFs handled automatically.
- With `--objective`/`-q`: ranked excerpts aligned to the goal (boilerplate
  skipped). Without: whole-page markdown.
- `--full-content` adds complete page content (`--full-content-max-chars`
  to cap). `--no-excerpts` strips excerpts when you only want full content.
- Excerpt sizing: `--excerpt-max-chars-per-result` (min 1000),
  `--excerpt-max-chars-total` (default 60000).
- Anonymous fetches: login-walled pages return the logged-out view.
- Same freshness flags as search (`--max-age-seconds`,
  `--disable-cache-fallback`); same `--session-id` grouping.

## Search-then-extract pattern

```bash
sid="task_$(uuidgen)"
parallel-cli search "objective" -q "..." -q "..." --session-id "$sid" --json \
  | jq -r '.results[:3][].url' \
  | xargs parallel-cli fetch --objective "specific extraction goal" --session-id "$sid" --json
```

Search excerpts are dense enough that a follow-up fetch is often
unnecessary — fetch only when you need full detail from specific pages.
