# Searching GitHub with gh

## Choosing the right tool

| Need | Use |
|---|---|
| Text/pattern search in a repo you have checked out | `rg` locally — faster, regex, no rate limit |
| Code search across GitHub or in a repo you don't have | `gh search code` |
| Issues/PRs in one repo with simple filters | `gh issue list` / `gh pr list` (complete results, no search cap) |
| Issues/PRs with full search syntax | `gh issue list -S 'query'` / `gh search issues` / `gh search prs` |
| Repos or commits | `gh search repos` / `gh search commits` |
| Advanced issue search (`field.name:value`, `advanced_search`) | `gh api -X GET search/issues -f q='...' -f advanced_search=true` |

Prefer `list` over `search` when you need *all* matching items: search results
cap at 1000 and can lag behind reality; list endpoints paginate through
everything.

## The five subcommands

All support `--json fields`, `--jq`, `--template`, and `-L/--limit`
(default 30, hard range 1–1000).

```bash
gh search code <query> [-R owner/repo] [--owner O] [--language L] \
  [--filename F] [--extension E] [--match file|path] [--size KB-range]
# JSON fields: path, repository, sha, textMatches, url

gh search repos [<query>] [--owner O] [--language L] [--topic t1,t2] \
  [--stars ">100"] [--sort stars|forks|updated|help-wanted-issues] \
  [--archived=false] [--visibility public|private|internal]
# no --repo flag here; use --owner

gh search issues [<query>] [--repo R] [--owner O] [--author U] [--assignee U] \
  [--label L] [--state open|closed] [--created "<date>"] [--include-prs] \
  [--match title|body|comments] [--sort ...]

gh search prs [<query>] [--repo R] [--author U] [--review-requested U] \
  [--reviewed-by U] [--review none|required|approved|changes_requested] \
  [--checks pending|success|failure] [--merged] [--merged-at "<date>"] \
  [--draft] [-B base] [-H head] [--state open|closed]

gh search commits [<query>] [--repo R] [--owner O] [--author U] \
  [--committer U] [--author-date "<2022-02-01"] [--hash SHA] [--merge] \
  [--sort author-date|committer-date]
```

Date and number flags accept comparison syntax: `--created ">2024-01-01"`,
`--stars ">100"`, `--reactions ">50"`, ranges like `--created 2024-01-01..2024-06-30`.

## Qualifier cheat sheet

Raw qualifiers can be mixed straight into the query string:

```bash
gh search code panic path:pkg language:go
gh search issues 'is:open involves:@me sort:updated-desc'
gh search prs 'is:merged author:monalisa base:main'
```

| Qualifier | Meaning |
|---|---|
| `repo:owner/name`, `org:owner`, `user:login` | scope |
| `in:title`, `in:body`, `in:comments` | match location |
| `label:a label:b` vs `label:a,b` | separate qualifiers = AND, comma = OR |
| `-label:x`, `-language:js` | negation (see below) |
| `no:assignee`, `no:label`, `no:milestone` | absence |
| `involves:@me`, `mentions:user`, `commenter:user` | participation |
| `linked:pr`, `linked:issue` | cross-links |
| `created:2026-01-01..2026-02-01`, `closed:>2026-01-01` | date ranges |
| `comments:>10`, `reactions:>50` | counts |
| `is:open`, `is:merged`, `is:draft`, `state:closed reason:completed` | state |
| `path:src/`, `filename:config.yml`, `extension:ts` | code search file filters |

**Negation needs `--`**: a leading hyphen is parsed as a flag, so write
`gh search issues -- "crash -label:wontfix"`.

## Code search caveats

- Powered by the **legacy** code search engine: results differ from
  github.com's UI, and regex search is not available via the API.
- No `--sort` for code — results are best-match order only.
- Requires authentication (no anonymous code search endpoint).
- Rate limit is ~10 requests/min for code search, ~30/min for other search
  (vs 5000/hr core API). Batch your queries; don't probe iteratively.
- `textMatches` in `--json` output returns the matching fragments — usually
  enough to avoid fetching whole files.

## Hard limits

- 1000 results max per query (`--limit` enforces 1–1000).
- Query max 256 characters, at most 5 boolean operators (AND/OR/NOT), 5
  nesting levels.
- To get more than 1000 items, split the query (e.g. by date range) or switch
  to a `list` command / REST list endpoint with `--paginate`.

## Advanced issue search via the API

The REST search endpoint accepts filters the CLI doesn't surface (e.g. issue
type or custom fields with `advanced_search`):

```bash
gh api -X GET search/issues -f q='repo:owner/name is:open type:Bug' \
  -f advanced_search=true --jq '.items[] | {number, title, html_url}'
```

`--method GET` is required — adding `-f` fields otherwise flips the request
to POST.
