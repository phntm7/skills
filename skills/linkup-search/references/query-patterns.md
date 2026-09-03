# Query patterns per depth

Source: Linkup search best-practices docs. Last verified: 2026-09-03
(CLI v1.3.0).

## fast — keyword-only, no LLM

Single-pass keyword search; the query string goes to the index as-is. No
instruction parsing, no URL scraping, no sub-searches. Sub-second.

Use for: conversational lookups where latency dominates, high-volume
pipelines, one specific fact.

Query shape — short and keyword-like:

```text
NVIDIA Q4 2024 revenue
Current EUR/USD exchange rate
```

Never send instruction-style prompts to `fast`; it treats them as keywords.

## standard — one iteration of agentic search

The agent interprets the query, can split it into parallel sub-searches, and
can scrape **one** URL included in the query string. Outputs of one step
cannot feed another step within the call. 1–3 s.

### Adjacent searches for breadth

Standard fans out automatically, but naming the dimensions gives control:

| Use case | Prompt |
| -------- | ------ |
| Company research | `Build a profile on {company}. Run several searches to map (i) its products, (ii) its team, and (iii) its business model.` |
| News | `Find recent news about OpenAI. Run several searches with adjacent keywords.` |
| Trends | `What are people saying about AI agents on Twitter and Reddit? Run several searches.` |

For coverage workloads (news, trends) the bare instruction is enough; for
dimension-specific workloads (competitive analysis) name the dimensions.

### Search-and-scrape in one call

```text
Scrape the website linkup.so.
Also run a search to find articles, news, and posts mentioning linkup.so clients.
Based on the content from the website and from the search,
return a list of clients that use Linkup, with the source for each.
```

## deep — multiple iterations, sequential steps

Outputs from one step feed the next (find a URL → scrape it → extract).
Scrapes multiple URLs per call, including discovered ones, with JS
rendering. 5–30 s. It follows step ordering literally, so number the steps:

```text
First find Datadog's pricing page URL.
Then scrape that URL.
Then return plan names, per-host prices, and included features as JSON.
```

Chained URL discovery:

```text
First find LinkedIn posts on context engineering.
Then, for each URL, extract the LinkedIn comments.
```

Compound role-based briefs also work well on deep:

```text
Your role is to map a company's value proposition from its website.

Inputs: {company_name}, {company_website}.

- First, find and scrape the homepage and primary product pages.
- From each page, extract: headline claims, customer benefits,
  differentiator language, and CTAs.
- Then, synthesize the extracted data into a summary of the value
  proposition.
- Avoid vague marketing fluff. Focus on concrete external value claims.
```

Use deep when: info needs full pages rather than snippets, precise items
must be pulled from a page (prices, specs, PDF links), or a single pass is
unreliable.

## Query anatomy (standard and deep)

Four components; deep tolerates longer instructions and explicit ordering:

1. **Role** — perspective: `You are an expert GTM consultant.`
2. **Scope** — where to look: `On {company_domain}, analyze homepage, about, and blog.`
3. **Method** — what to extract: `Include products, business model, target market.`
4. **Format** — answer shape: prose, list, or a structured schema.

Split every query into *what to retrieve* (the agent optimizes searches for
it) and *how to reason over results* (shapes the answer).

## LinkedIn extraction (Search only)

Fetch cannot read LinkedIn — it gets the anonymous login wall. Search has a
dedicated LinkedIn pipeline. Requires the **exact** profile/company URL
(`linkedin.com/in/{slug}` or `linkedin.com/company/{slug}`); shortened links
and partial slugs fail.

| Target | Query |
| ------ | ----- |
| Profile details | `{linkedin_url}` + `Return the profile details.` |
| Recent posts | `{linkedin_url}` + `Return the recent posts.` |
| Comments | `{linkedin_url}` + `Return the comments.` |
| Topic search | `Search for LinkedIn posts on {keyword}.` |

URL unknown? Use deep to find and scrape in one call:

```text
First find the LinkedIn profile for {person_name} at {company}.
Then scrape that URL and return the profile details.
```

## Structured output

`--schema '{...}'` or `--schema-file schema.json` (either implies
`--output structured`). Standard JSON Schema; the response is a JSON object
conforming to it — no parsing needed.

- Keep schemas shallow; deep nesting costs retrieval quality and money.
- Mark essential fields `required`; leave uncertain ones optional so the
  call doesn't fail when a field isn't found.
- Describe fields with `description` when names are ambiguous.

Example:

```bash
linkup search "current stable versions of Node.js LTS and pnpm" \
  --schema '{"type":"object","properties":{"node_lts_version":{"type":"string"},"pnpm_version":{"type":"string"}},"required":["node_lts_version","pnpm_version"]}'
```

## Bad → Fix pairs

| Pitfall | Bad | Fix |
| ------- | --- | --- |
| Reasoning instead of retrieving | `How to estimate Total SA's annual IT spend?` | `Find Total SA's annual reports and IT-services contracts that mention IT spend. For each source, extract the figure, the year, and the citation URL.` |
| Unscoped "tell me about" | `Tell me about the company linkup.so.` | `Find the linkup.so homepage, product pages, and about page. Extract: what the company does, target customers, pricing model, and known investors.` |
| Dates in the query string | `What AI funding rounds happened between 2025-01-01 and 2025-03-31?` | `List European AI seed rounds.` + `--from-date 2025-01-01 --to-date 2025-03-31` |
| Instructions on fast | Multi-step prompt with `--depth fast` | Same prompt with `--depth deep` |
| Fetch on LinkedIn | `linkup fetch https://linkedin.com/in/slug --render-js` | `linkup search "https://linkedin.com/in/slug Return the profile details."` |

Date-filter caveat: some pages (product pages, news) carry a metadata
publish date that differs from the last update, which makes date filtering
unstable — treat filtered recency as approximate.

## Index behaviors to expect

- News-style queries surface fresh **LinkedIn posts** (24–48 h) that carry
  the story but are social, not citable. For citable coverage, add
  `--exclude-domains linkedin.com` or name news outlets in the query.
- For live data (rates, prices, schedules), raw `search-results` can return
  years-stale pages; `sourced-answer` reconciles sources and dates far
  better — use it for anything time-sensitive.
- Results may include localized duplicates of one page (ja/pl/zh docs
  mirrors) — dedupe by path before counting coverage.
