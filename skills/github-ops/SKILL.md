---
name: github-ops
description: >
  Use when working with remote GitHub repositories, Actions, PRs, issues,
  releases, or code search via gh. Use local tools for a checkout, the
  `web-search-router` skill for open-web research, and a browser for GitHub UI.
---

# GitHub Operations via gh CLI

Last verified: 2026-09-03 (gh 2.99.0)

Use `gh` for remote GitHub data. Use local tools for a checked-out repository
and the `web-search-router` skill for open-web research. Clone only when many
remote files make it cheaper. `gh` is authenticated and returns structured
JSON — do not fetch github.com HTML or raw.githubusercontent.com. Use a
browser tool for the github.com UI.

## Preflight

- `gh auth status` once per session if unsure (never `gh auth token` or
  `--show-token` — no tokens in the transcript). If auth fails, tell the user
  to run `gh auth login`. Missing scopes (`INSUFFICIENT_SCOPES`, common:
  `project` for Projects V2): report the missing scope and hand
  `gh auth refresh -h github.com -s <scope>` to the user — it needs
  interactive browser approval; never run it as an autonomous fix. Only when
  `gh` is unavailable or unauthenticated and the data is public may you fall
  back to unauthenticated `api.github.com` requests — label the result as a
  degraded read; never web-scrape private repo pages.
- Commands that need repository context (`pr`, `issue`, `run`, `workflow`,
  `release`) take `-R owner/repo` outside a checkout. `gh repo view` and
  `gh repo clone` take `OWNER/REPO` positionally. `gh api` takes no `-R`: its
  `{owner}`/`{repo}` placeholders resolve from the local checkout or
  `GH_REPO=owner/repo`; explicit paths (`repos/owner/repo/...`) and
  `gh search` need neither.
- For scripted use, prefix commands that might page or prompt:
  `GH_PAGER=cat GH_PROMPT_DISABLED=1 gh ...`

## Reads vs writes

Read commands do not mutate remote GitHub state; downloads may write locally.
Anything that mutates GitHub state — commenting, reviewing, creating or
closing issues, rerunning or dispatching workflows, enabling/disabling
workflows, creating releases — is an external side effect visible to other
people: run it only when the user's request clearly asks for that specific
mutation; otherwise confirm first.

## Context economy

Request only the fields needed: `--json field1,field2 --jq '...'`. Avoid
dumping raw responses. Bare `--json` lists fields. `--jq` is embedded; on
normal commands it requires `--json`, on `gh api` it works directly.

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

Without the raw Accept header the contents endpoint returns base64 JSON.
Skip `raw.githubusercontent.com` (404s on private repos) and `download_url`
(temporary token). Many files: `gh repo clone owner/repo -- --depth 1`.

## Searching GitHub

Raw qualifiers mix into the query (`gh search code panic path:pkg language:go`).
Negated qualifiers must go after `--`: `gh search issues -- "crash -label:bug"`.
`--search-type`, qualifier cheat sheet, query limits, and search vs list:
[references/search.md](references/search.md).

## Actions / CI failures

```bash
gh pr checks 123 --json name,state,bucket,link          # bucket: pass|fail|pending|skipping|cancel
gh run list -b my-branch -s failure -L 5 --json databaseId,displayTitle,url
gh run view <run-id> --log-failed                        # only the failed steps' logs
gh run view <run-id> --json jobs --jq '.jobs[] | {name, databaseId, conclusion}'
gh run view --job <job-databaseId> --log-failed          # narrow to one job
```

Job IDs, log association, reruns, watch, artifacts, workflow dispatch:
[references/actions.md](references/actions.md).

## PR comments and reviews

A PR has three distinct comment surfaces; `gh pr view --json` only covers two:

| Surface | Read | Write |
|---|---|---|
| Conversation comments | `gh pr view N --json comments` | `gh pr comment N --body-file f.md` |
| Reviews (approve / request changes) | `gh pr view N --json reviews,reviewDecision` | `gh pr review N --approve` / `--request-changes` / `--comment -b "..."` |
| Inline code comments (diff-anchored) | `gh api repos/{owner}/{repo}/pulls/N/comments` | reply: `gh api -X POST repos/{owner}/{repo}/pulls/N/comments/<id>/replies -f body='...'` |

Write multiline bodies with `--body-file` or a heredoc; `\n` in `-b` renders
literally. For idempotent bot comments, use
`gh pr comment N --edit-last --create-if-none -F f.md`. Inline comments,
thread resolution, and creating reviews:
[references/pr-reviews.md](references/pr-reviews.md).

## Done

Done means the target repo/PR/run is identified and only requested fields
are returned; a CI diagnosis names the run, job, failing step, and URL/log
evidence; auth, scope, and degraded-read failures are stated explicitly.

## Sources

- gh manual: https://cli.github.com/manual
- gh api: https://cli.github.com/manual/gh_api
- gh search: https://cli.github.com/manual/gh_search
- GitHub REST search: https://docs.github.com/en/rest/search/search#constructing-a-search-query
