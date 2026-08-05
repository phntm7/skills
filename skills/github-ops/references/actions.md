# GitHub Actions: runs, logs, artifacts, workflows

## Finding runs

```bash
gh run list -R owner/repo -L 10 --json databaseId,displayTitle,conclusion,headBranch,url,workflowName
gh run list -b my-branch -s failure -L 5 --json databaseId,displayTitle,url
gh run list -w ci.yml -c <commit-sha> --json databaseId,conclusion   # runs for one commit
gh run list -e pull_request -u someuser --created ">2026-08-01"
```

For runs tied to a PR, start from `gh pr checks <N>` instead of `gh run list`
— it maps checks to the PR directly and its `--json` output includes a
synthetic `bucket` field (`pass|fail|pending|skipping|cancel`). Exit code 8
means checks are still pending.

## Inspecting a failed run

```bash
gh run view <run-id> -v                    # summary with job steps
gh run view <run-id> --log-failed          # logs for failed steps only — start here
gh run view <run-id> --log                 # full log (can be huge; avoid dumping into context)
gh run view <run-id> --attempt 2 --log-failed
gh run view <run-id> --exit-status         # non-zero exit if the run failed (for scripting)
```

Narrowing to one job:

```bash
gh run view <run-id> --json jobs --jq '.jobs[] | {name, databaseId, conclusion}'
gh run view --job <job-databaseId> --log-failed
```

**The job id is the `databaseId` from the JSON above — not the number in the
browser URL** (`.../actions/runs/X/jobs/Y`); the URL number 404s via the API.

Log quirks: gh fetches logs as a zip and may fail to associate some jobs; it
falls back to slower per-job API fetches (errors if more than 25 job logs are
missing), and unattributed lines appear as `UNKNOWN STEP`.

## Watch and rerun

```bash
gh run watch <run-id> --exit-status [-i 5] [--compact]
gh run rerun <run-id> --failed             # rerun only failed jobs
gh run rerun --job <job-databaseId>
gh run rerun <run-id> --debug              # rerun with debug logging enabled
```

`gh run watch` does not work with fine-grained PATs (no `checks:read`
permission exists for them).

## Artifacts

```bash
gh run download <run-id>                   # all artifacts of that run
gh run download <run-id> -n coverage -D ./artifacts
gh run download <run-id> -p 'logs-*'
```

Always pass the run id: without it, gh grabs the latest artifact by name
across runs, which is nondeterministic.

## Workflows

```bash
gh workflow list -a                        # -a includes disabled workflows
gh workflow view ci.yml --yaml [-r ref]    # workflow file content at a ref
gh workflow run deploy.yml -r main -f environment=staging
gh workflow run deploy.yml --json < inputs.json
gh workflow enable ci.yml
gh workflow disable ci.yml
```

`gh workflow run` prints the created run's URL when available — use that id.
If no URL is printed, fall back to
`gh run list -w deploy.yml -e workflow_dispatch -L 1 --json databaseId,status,createdAt`,
but note this races with concurrent dispatches of the same workflow — check
`createdAt` (and actor) before trusting it.
