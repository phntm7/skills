# Research and batch tasks

Source: Linkup research/tasks best-practices docs (verified 2026-08-04).

## Research modes

| Mode | Behavior | Use for |
| ---- | -------- | ------- |
| `answer` | Iterates to verify: reasons against itself, checks alternative candidates, cross-references evidence, returns one definitive answer. | Hard single-answer questions where being right matters (finance, legal, fact verification). |
| `investigate` | Goes deep on one entity/topic: follows threads, explores discovered trails, verifies claims. | Deep-dive reports on a single company/person/subject; multi-hop questions. |
| `research` | Goes wide: parallel threads, structured report across topics/entities. | Industry landscapes, entity lists, multi-theme reports. |

Example prompts per mode:

- answer: `What is the American company that generated the highest revenues in Europe in 2025?`
- investigate: `Build a detailed report on the company Anthropic from the perspective of a lawyer.`
- research: `List all the AI startups that raised more than a $10M seed round in Europe in the last 6 months. For each, generate a short description and include its website.`

Omitting `--mode` lets the agent auto-classify — convenient but
unpredictable in cost, latency, and output shape. Set it explicitly.

## Reasoning depth = budget = price

| Depth | Cost | Latency | When |
| ----- | ---- | ------- | ---- |
| S | $0.25 | 2–5 min | Short multi-step investigations; default for agent-initiated research |
| M | $0.50 | 3–7 min | Routine use, balanced cost/quality |
| L | $1.50 | 5–10 min | Thorough answers under bounded latency. **CLI default — override deliberately.** |
| XL | $2.50 | 10–20 min | Deliverables where completeness beats latency |

The agent is budget-aware: it stops when satisfied, so XL doesn't just write
more — it searches and cross-checks more. Higher depth buys skepticism and
coverage, not verbosity.

## Writing the research brief

Terse briefs work; precise briefs produce more predictable, aligned output.
Specify any of: angles to cover, leads to pursue, facts to verify, entities
to compare, constraints an answer must satisfy, expected structure.

Fully specified brief shape:

```text
Produce a competitive landscape of European AI inference providers in 2026.

Scope:
- Cover at minimum: Mistral, Aleph Alpha, Silo AI, OVHcloud, Scaleway,
  and any provider with disclosed funding above €20M.
- Exclude US-headquartered hyperscalers unless they operate a sovereign
  EU offering.

For each provider, surface:
- Headquarters and primary inference regions.
- Models served and deployment modes.
- Disclosed pricing normalized per million input tokens.
- Latest funding round and lead investors.

Verify all numeric claims against primary sources (pricing pages, filings,
press releases). Flag figures only available from secondary aggregators.
```

Domain and date filters (`--include-domains`, `--exclude-domains`,
`--from-date`, `--to-date`) work on research too — use them to pin the
agent to primary sources.

## Async lifecycle from the CLI

```bash
id=$(linkup research "brief" --mode investigate --reasoning-depth M --json | jq -r .id)
linkup research get "$id" --json          # status: pending|processing|completed|failed
linkup research get "$id" --wait --json   # block until done
linkup research list --page 1 --page-size 10
```

- `--wait` defaults: poll every 5 s, timeout 1200 s. A timed-out wait prints
  the resume command; the task keeps running server-side.
- From a coding agent: submit without `--wait`, keep working, poll between
  other steps — or run the `--wait` variant as a background process.
- Max poll rate 1 req/s; faster polling only triggers rate limits.
- Failed tasks cost nothing; retry freely.

## Batch tasks

`tasks` wraps search/fetch/research asynchronously. Same per-call price —
it buys workflow (bulk, scheduled, mixed batches), not discounts.

```bash
linkup tasks create --file batch.json   # up to 100 tasks per submission
linkup tasks get <id>
linkup tasks list --status completed --type search
```

`batch.json` — mixed endpoints allowed; tasks run in parallel regardless of
order:

```json
[
  { "type": "search", "input": { "q": "Datadog pricing", "depth": "standard", "outputType": "searchResults" } },
  { "type": "fetch",  "input": { "url": "https://www.datadoghq.com/pricing/", "renderJs": true } }
]
```

- >100 items: split into parallel batches; no penalty.
- Dependent work (search results feeding fetches): submit the second batch
  after the first completes.
- Each task fails independently; inspect `error` per task and resubmit only
  failures.
- Results have a bounded lifetime — persist them promptly.
- Polling cadence: search/fetch batches 1–2 s; research batches 5 s backing
  off to 30 s; use `tasks list` (bulk) over per-id gets for large batches.

## Offload vs. research it yourself

Delegate to `linkup research` when the question is self-contained,
web-answerable, and benefits from parallel multi-source verification — it
runs off-context and returns a cited answer for $0.25–0.50 at S/M. Do the
research yourself (search + fetch loop) when you need to steer mid-course,
mix web facts with local code/repo context, or when a couple of cheap
searches would settle it.
