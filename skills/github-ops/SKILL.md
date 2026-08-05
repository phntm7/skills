---
name: github-ops
description: >
  Operate GitHub with the gh CLI instead of web-fetching github.com: search
  code/repos/issues/PRs across GitHub or in one repo, read files and READMEs
  from remote repos without cloning, check GitHub Actions runs and fetch failed
  CI logs, list and post PR comments and reviews, work with issues and
  releases, and call the REST/GraphQL API via gh api. Use when a task touches a
  GitHub repo that is not checked out locally, mentions CI/Actions failures, PR
  feedback or review comments, GitHub search, or when tempted to fetch
  github.com or raw.githubusercontent.com URLs.
---

# GitHub Operations via gh CLI

Use `gh` for every GitHub data operation. Do not fetch github.com HTML or
raw.githubusercontent.com with a web tool: `gh` is authenticated (private
repos work, rate limits are per-user, not anonymous), returns structured JSON,
and one command replaces a scrape-and-parse round trip. This skill is not for
driving the github.com browser UI — use a browser tool for that.

## Preflight

- `gh auth status` once per session if unsure (never `gh auth token` or
  `--show-token` — no tokens in the transcript). If auth fails, tell the user
  to run `gh auth login`. Only when `gh` is unavailable or unauthenticated and
  the data is public may you fall back to unauthenticated `api.github.com`
  requests — label the result as a degraded read; never web-scrape private
  repo pages.
- Repo-scoped commands (`pr`, `issue`, `run`, `workflow`, `release`, `repo`)
  need `-R owner/repo` outside a checkout. `gh api` takes no `-R`: its
  `{owner}`/`{repo}` placeholders resolve from the local checkout or
  `GH_REPO=owner/repo`; explicit paths (`repos/owner/repo/...`) and
  `gh search` need neither.
- For scripted use, prefix commands that might page or prompt:
  `GH_PAGER=cat GH_PROMPT_DISABLED=1 gh ...`

## Reads vs writes

Reads (view, list, search, diff, checks, log and artifact fetching) are
always safe to run. Anything that mutates GitHub state — commenting,
reviewing, creating or closing issues, rerunning or dispatching workflows,
enabling/disabling workflows, creating releases — is an external side
effect visible to other people: run it only when the user's request clearly
asks for that specific mutation; otherwise confirm first.

## Context economy

Always request only the fields you need: `--json field1,field2 --jq '...'`.
Never dump raw API responses into context.

- Run a command with bare `--json` (no argument) to get the list of available
  fields — this error output is the documented discovery mechanism.
- `--jq` needs no system jq; gh embeds one. On normal commands `--jq` requires
  `--json`; on `gh api` it works directly on the response.

## Task → command map

| Task | Command |
|---|---|
| Read a repo's README | `gh repo view owner/repo` |
| Read one file from a remote repo | `gh api 'repos/owner/repo/contents/PATH?ref=BRANCH' -H 'Accept: application/vnd.github.raw+json'` |
| List a remote directory | `gh api repos/owner/repo/contents/DIR --jq '.[].path'` |
| Search code across GitHub | `gh search code QUERY --language go -L 20` |
| Search code in one repo | `gh search code QUERY -R owner/repo` (checked out locally? use `rg` instead) |
| Search issues / PRs / repos / commits | `gh search issues\|prs\|repos\|commits ...` |
| CI status of a PR | `gh pr checks N --json name,state,bucket,link` |
| Why did CI fail | `gh run list -b BRANCH -s failure -L 5 --json databaseId,displayTitle,url` then `gh run view ID --log-failed` |
| Read PR + conversation comments | `gh pr view N --json title,body,state,reviewDecision,comments` |
| Read inline code-review comments | `gh api repos/{owner}/{repo}/pulls/N/comments` (NOT available via `--json`) |
| Comment on a PR / issue | `gh pr comment N --body-file f.md` / `gh issue comment N -b "..."` |
| Approve / request changes | `gh pr review N --approve` / `--request-changes -b "..."` |
| PR diff | `gh pr diff N [--name-only]` |
| Issues | `gh issue list -R owner/repo -s open --json number,title,labels`, `gh issue view N --comments` |
| Releases | `gh release list`, `gh release view TAG --json body,assets`, `gh release download TAG -p '*.tgz'` |
| Anything else | `gh api <REST path>` or `gh api graphql -f query='...'` — see [references/api.md](references/api.md) |

## Reading repo content without cloning

```bash
gh repo view owner/repo --json description,defaultBranchRef,latestRelease
gh api repos/owner/repo/readme -H 'Accept: application/vnd.github.raw+json'
gh api 'repos/owner/repo/contents/src/main.ts?ref=v2' -H 'Accept: application/vnd.github.raw+json'
```

Without the raw Accept header the contents endpoint returns base64 JSON. Do
not use `raw.githubusercontent.com` (404s on private repos) or the
`download_url` field (temporary tokenized URL). If you need many files from
one repo, a shallow clone is cheaper: `gh repo clone owner/repo -- --depth 1`.

## Searching GitHub

```bash
gh search code 'parseConfig' -R owner/repo --json path,textMatches -L 20
gh search issues 'timeout error' --repo owner/repo --state open --json number,title,url
gh search prs --review-requested @me --state open --json number,title,repository
```

Raw qualifiers mix into the query (`gh search code panic path:pkg language:go`).
Negated qualifiers must go after `--`: `gh search issues -- "crash -label:bug"`.
Know the limits: code search uses a legacy engine (no regex, results differ
from github.com), all search caps at 1000 results, and search rate limits are
much lower than normal API calls. Full qualifier cheat sheet, per-subcommand
flags, and limits: [references/search.md](references/search.md).

## Actions / CI failures

The core debugging loop:

```bash
gh pr checks 123 --json name,state,bucket,link          # bucket: pass|fail|pending|skipping|cancel
gh run list -b my-branch -s failure -L 5 --json databaseId,displayTitle,url
gh run view <run-id> --log-failed                        # only the failed steps' logs
gh run view <run-id> --json jobs --jq '.jobs[] | {name, databaseId, conclusion}'
gh run view --job <job-databaseId> --log-failed          # narrow to one job
```

`--job` takes the job `databaseId`, never the number from a browser URL.
Rerun, watch, artifacts, workflow dispatch: [references/actions.md](references/actions.md).

## PR comments and reviews

A PR has three distinct comment surfaces; `gh pr view --json` only covers two:

| Surface | Read | Write |
|---|---|---|
| Conversation comments | `gh pr view N --json comments` | `gh pr comment N --body-file f.md` |
| Reviews (approve / request changes) | `gh pr view N --json reviews,reviewDecision` | `gh pr review N --approve` / `--request-changes` / `--comment -b "..."` |
| Inline code comments (diff-anchored) | `gh api repos/{owner}/{repo}/pulls/N/comments` | reply: `gh api -X POST repos/{owner}/{repo}/pulls/N/comments/<id>/replies -f body='...'` |

Write multiline bodies with `--body-file` or a heredoc — never inline `-b`
with `\n` escapes (rendered literally). For idempotent bot comments, use
`gh pr comment N --edit-last --create-if-none -F f.md`. REST comment data has
no thread-resolution state, so it can't tell actionable feedback from
already-resolved threads — use the GraphQL `reviewThreads` query for that.
Details, plus creating inline comments and reviews:
[references/pr-reviews.md](references/pr-reviews.md).

## Gotchas

- `gh api` switches GET→POST as soon as any `-f`/`-F` field is added. For
  query-string params, force `--method GET`.
- `-f` sends strings only. Integer, boolean, or nested body fields need `-F`
  (typed) or `--input -` with a JSON heredoc — otherwise the API returns 422.
- `gh api --paginate` emits each page as a separate JSON document; add
  `--slurp` to merge into one array.
- Sub-issues, dependencies, and Projects mutations take the numeric issue
  **id** (or GraphQL node id), not the `#123` number — capture `.id` on create.
- `gh pr view --json comments` misses inline review comments entirely; use the
  `pulls/N/comments` endpoint.
- Missing-scope errors (e.g. `INSUFFICIENT_SCOPES` on Projects): fix with
  `gh auth refresh -h github.com -s <scope>`.
- Repeated identical reads: add `--cache 1h` to `gh api` calls. Quota check:
  `gh api rate_limit`.

## References

| Reference | Load when |
|---|---|
| [references/search.md](references/search.md) | Building non-trivial searches: qualifiers, boolean limits, advanced issue search, choosing search vs list vs api |
| [references/actions.md](references/actions.md) | Debugging CI beyond `--log-failed`: reruns, artifacts, watch, workflow dispatch, log quirks |
| [references/pr-reviews.md](references/pr-reviews.md) | Posting inline review comments, creating reviews via API, reading review threads on busy PRs |
| [references/api.md](references/api.md) | Any `gh api` call beyond a simple GET: field typing, pagination, GraphQL, rate limits, auth scopes |
