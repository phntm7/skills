# gh api: the REST/GraphQL escape hatch

Use `gh api` when no dedicated subcommand covers the endpoint, or when a
subcommand's `--json` output omits the data (inline PR comments, sub-issues,
Projects V2, issue types).

For current flags, run `gh api --help`.

Placeholders `{owner}`, `{repo}`, `{branch}` resolve from the current
directory's repo or `GH_REPO`.

## Method and field semantics (top trap)

- Default method is GET, **but adding any `-f`/`-F` field silently switches
  it to POST**. For query-string params on a read, force it:
  `gh api -X GET search/issues -f q='...'`.
- `-f/--raw-field` always sends a **string**. `-F/--field` converts
  `true`/`false`/`null`/integers to real JSON types, resolves `{owner}`
  placeholders, and reads `@file` / `@-` (stdin).
- Nested bodies: `key[subkey]=v`, arrays `key[]=v1 key[]=v2`. But past one
  level of nesting, write real JSON and use `--input`:

```bash
gh api -X POST repos/{owner}/{repo}/issues/5/sub_issues --input - <<'EOF'
{"sub_issue_id": 123456789}
EOF
```

When an endpoint requires a numeric JSON value, use `-F`; `-f` sends a string
and may be rejected (often 422). When an endpoint takes an id, note whether
it wants the **database id / node id** (from `.id` in a previous response) or
the issue/PR **number** — sub-issues, dependencies, and Projects mutations
all want ids.

## Fetching raw file content

```bash
gh api repos/{owner}/{repo}/readme -H 'Accept: application/vnd.github.raw+json'
gh api 'repos/{owner}/{repo}/contents/PATH?ref=BRANCH' -H 'Accept: application/vnd.github.raw+json'
```

Without the header you get JSON with base64 `content`. Binary files: use
`Accept: application/vnd.github.raw+json` with output redirection.

## Pagination

```bash
gh api --paginate repos/{owner}/{repo}/issues --jq '.[].number'   # per-page jq is safe
gh api --paginate --slurp repos/{owner}/{repo}/issues             # one merged JSON array
```

`--paginate` emits each page as a **separate JSON document** — downstream
tools that expect a single document need `--slurp`.

GraphQL pagination has a contract: the query must accept
`$endCursor: String` and select `pageInfo { hasNextPage endCursor }`:

```bash
gh api graphql --paginate -f query='
  query($endCursor: String) {
    repository(owner: "cli", name: "cli") {
      issues(first: 100, after: $endCursor) {
        nodes { number title }
        pageInfo { hasNextPage endCursor }
      }
    }
  }'
```

## GraphQL

```bash
gh api graphql -F owner='{owner}' -F name='{repo}' -f query='
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) { stargazerCount }
  }'
```

All `-f`/`-F` fields other than `query` and `operationName` become GraphQL
variables. Some surfaces are feature-flagged and invisible without a header,
e.g. `-H 'GraphQL-Features: issue_types'`. Projects V2 is GraphQL-only; the
reliable pattern is reverse lookup from a known issue's `projectItems`
rather than fuzzy project-name search.

## Rate limits, caching, retries

- `gh api rate_limit` shows remaining quota per resource (core / search /
  code_search / graphql). Core is 5000/hr; search ~30/min; code search ~10/min.
- `--cache 1h` serves repeated identical requests from a local cache —
  use it for reads you may repeat within a session.
- `-i/--include` prints response headers (inspect `x-ratelimit-remaining`,
  `Link`); `GH_DEBUG=api` logs full HTTP traffic — treat that output as
  sensitive and quote only the sanitized fragments you need.

## Auth and scopes

- Token precedence: `GH_TOKEN` > `GITHUB_TOKEN` > stored keyring login.
  Exit code 4 means auth required — verify with plain `gh auth status`.
  Never run `gh auth token` or `gh auth status --show-token`: they print
  credentials into the transcript.
- Missing scopes fail with `INSUFFICIENT_SCOPES` (common: `project` for
  Projects V2). Report the missing scope and hand
  `gh auth refresh -h github.com -s <scope>` to the user — it needs
  interactive browser approval; never run it as an autonomous fix.
- GitHub Enterprise: `GH_HOST=github.mycorp.com` plus
  `GH_ENTERPRISE_TOKEN`; or `--hostname` per call.
