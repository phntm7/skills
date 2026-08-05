# Research, FindAll, enrich, and monitor

Source: Parallel docs (docs.parallel.ai), verified 2026-08-04.

## Research processors

Every tier has a standard variant (freshest data, for accuracy-critical or
background work) and a `-fast` variant (2–5× faster, still very fresh — for
interactive/agent use). Same tier, same price.

| Tier | Cost | Fast latency | Standard latency | Suited for |
| ---- | ---- | ------------ | ---------------- | ---------- |
| `lite` | $0.005 | 10–20 s | 10–60 s | Quick lookups, ~2 output fields |
| `base` | $0.01 | 15–50 s | 15–100 s | Simple questions, ~5 fields |
| `core` | $0.025 | 15–100 s | 1–5 min | Cross-referenced moderate research, ~10 fields |
| `core2x` | $0.05 | 15 s–3 min | 1–10 min | High-complexity cross-referenced outputs |
| `pro` | $0.10 | 30 s–5 min | 2–10 min | Exploratory research, ~20 fields (CLI default: `pro-fast`) |
| `ultra` | $0.30 | 1–10 min | 5–25 min | Multi-source deep research |
| `ultra2x` | $0.60 | 1–20 min | 5–50 min | Difficult deep research |
| `ultra4x` | $1.20 | 1–40 min | 5–90 min | Very difficult research |
| `ultra8x` | $2.40 | 1 min–1 hr | 5 min–2 hr | Most challenging research |

Prefer standard processors when absolute freshness matters (prices,
breaking news, live data) or the job runs in the background; prefer `-fast`
when an agent or user is waiting.

## Running research from the CLI

```bash
parallel-cli research run "brief" -p core-fast --text -o report --force
# → report.md (markdown w/ citations) + report.json (metadata)

parallel-cli research run "brief" -p ultra --no-wait --json   # returns trun_ id
parallel-cli research status trun_abc123
parallel-cli research poll trun_abc123          # block until done, save
parallel-cli research processors                # list tiers + latencies
```

- Query max 15,000 chars; `-f file` or `-` for stdin.
- Results always save to disk (default `./parallel-research/<run_id>`);
  set `-o` deliberately so artifacts don't litter the project root.
- Default output is API-chosen structured JSON ("auto" schema); `--text`
  switches to a markdown report, `--text-description` steers length/focus.
- Poll defaults: 45 s interval, 3600 s timeout.
- Chaining: every run prints an interaction id; pass
  `--previous-interaction-id trun_...` to continue with prior context
  (multi-turn research).

## Writing research briefs

Same principle as the Task API spec: state the entity, the data points
wanted, constraints, formats, and fallback behavior.

- Name what to research and which facts/fields to return.
- Specify formats: dates as `YYYY-MM-DD`, quantities with units, list
  sizes (`top_5_products`).
- Specify error handling: "If unavailable, return null" — otherwise the
  agent may guess.
- Add source constraints in the brief: "Verify against primary sources
  (filings, official pages); flag figures only found on aggregators."
- Don't ask for `reasoning`/`confidence` fields — citations, reasoning, and
  confidence come back automatically in the result basis.

## FindAll — entity discovery

Discovers entities (companies, people) matching natural-language criteria.

```bash
parallel-cli findall entity-search "Senior PMs at AI startups" -t people -n 25   # fast, best-effort
parallel-cli findall run "Find AI companies that raised Series A in 2026" -g base -n 25
parallel-cli findall run "..." --dry-run     # preview interpreted schema, no charge
parallel-cli findall extend|enrich|result|status|poll|cancel ...
```

Generator pricing: `preview` $0.10 flat; `base` $0.25 + $0.03/match;
`core` (default) $2.00 + $0.15/match; `pro` $10.00 + $1.00/match. A
`pro` run with `-n 100` can cost $110 — **confirm with the user before
core/pro runs with high match limits.** Use `--dry-run` first to check the
interpreted entity type and match conditions, and `entity-search` when a
fast ranked list is enough.

## Enrich — tabular data enrichment

Adds web-researched columns to CSV/JSON rows; each row is a research task
billed at the chosen processor's price (rows × price).

```bash
parallel-cli enrich suggest "Find the CEO and latest funding round" \
  --source-columns '["company","website"]'          # AI proposes columns + processor
parallel-cli enrich run --source-type csv --source leads.csv --target out.csv \
  --intent "Find the CEO and latest funding round" --processor base-fast
parallel-cli enrich run --data '[{"company":"Google"},{"company":"Apple"}]' \
  --target out.csv --intent "Find the CEO"
```

Include the minimum columns that uniquely identify each entity (e.g.
company + website). 100 rows at `base` = $1; at `pro` = $10 — size the
processor to field complexity, not prestige.

## Monitor — continuous web tracking

```bash
parallel-cli monitor create "New AI funding announcements" --frequency 6h
parallel-cli monitor create "SEC filings from Tesla" --webhook https://example.com/hook
parallel-cli monitor create --type snapshot --task-run-id trun_abc --frequency 1d
parallel-cli monitor list | events <id> | trigger <id> | update <id> | cancel <id>
```

Types: `event_stream` (default — tracks a search query for new events) and
`snapshot` (re-runs a research task and diffs the output). Frequency
`1h`/`6h`/`1d`/`2w` etc. Pricing per run: lite $0.003, base $0.01 — a
1-hour-frequency monitor costs ~$2–7/month, so confirm recurring monitors
with the user and `cancel` (irreversible) ones no longer needed.
