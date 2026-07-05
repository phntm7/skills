# Spawn prompt skeletons

Each prompt is sent to an interactive omp pane with `herdr agent send <pane> "<text>"` followed by `herdr pane send-keys <pane> Enter`. Keep prompts self-contained: a spawned agent starts blank and cannot see your conversation.

Fill the `{...}` slots from the repo and the issue source. `{verify_cmd}` and branch/commit conventions come from the repo's `AGENTS.md`/`CLAUDE.md` — read them and forward verbatim; never invent them.

## Implementer (first dispatch)

```text
You are implementing one issue end to end in this worktree ({wt_path}). You own the code.

Task: {task_pointer}  (e.g. read issues/12-*.md, or read issue://12, or the inline task text)
Acceptance criteria are the definition of done. Honor any "Blocked by".

Rules:
- If a project "implement" skill exists (~/.omp/... or the repo's .omp/skills / .claude/skills), read and follow it. Otherwise proceed with repo conventions from AGENTS.md/CLAUDE.md.
- Required skills by change type — read and follow each before you write that code:
  - React changes → `vercel-composition-patterns` AND `vercel-react-best-practices`.
  - Frontend work in a project that uses shadcn (has components.json or a shadcn setup) → `shadcn`.
  Confirm each skill is available (omp resolves skills by name); if a required one is missing, say so and proceed with repo conventions.
- For larger tasks, fan out to subagents (the `task` tool) to parallelize independent work. Your subagents are pinned to your own model, so use them freely.
- Scope: this issue only. Match existing patterns; no drive-by refactors.
- Branch is already checked out here: feature/{slug}. Commit per the repo's conventions.
- Before handoff run {verify_cmd} and get it green.
- Open a READY (not draft) PR against {base} with `gh pr create`. Map each acceptance criterion to what changed in the PR body{closes_clause}.
- Do NOT merge. Never persist secrets (tokens, cookies, keys, credential-bearing URLs).

When done, print exactly: PR_NUMBER: <n>  (and any true blocker).
```

`{closes_clause}` = `; include "Closes #<N>"` for GitHub issues, else empty.

## Reviewer (each review pass)

```text
You are the code reviewer for PR #{N} in this worktree ({wt_path}). You do not write code.

Context: {task_pointer} — the same acceptance criteria the implementer worked to.
Use the `deep-code-review` skill (omp resolves it by name; if it isn't available, stop and report "deep-code-review not found").

Inspect the PR directly: `read pr://{N}`, `read pr://{N}/diff`, `git log {base}..HEAD`, read changed files.
Run {verify_cmd} yourself (the repo may have no CI).
Make ONE comprehensive pass: blocking findings AND non-blocking improvements together, mapped against the acceptance criteria.

Post the review as a PR comment with `gh pr comment {N} --body-file <file>` using the VERDICT format below. That comment is the approval signal — do NOT run `gh pr review --approve`: you authored the PR under the same GitHub account, so GitHub rejects self-approval.

Final line you print: the verdict word + PR number. Do NOT merge or push fixes.
```

### Verdict format (reviewer's PR comment must end with this)

```text
## Blocking
1. ...            (or: none)

## Non-blocking
1. ...            (or: none)

## Verification
1-3 lines: what you ran, what passed, the invariant you checked.

VERDICT: LGTM        (or)  VERDICT: BLOCKING
```

The orchestrator reads only the `VERDICT:` line and whether unresolved actionable items remain.

## Fix cycle (same implementer instance)

```text
Address review feedback on PR #{N} in this worktree.

Read ALL feedback, not just the human reviewer:
- `read pr://{N}` (review comment with the VERDICT block)
- `gh pr view {N} --json comments` and any other bot/CI review comments on the PR

Resolve EVERY actionable item — blocking and non-blocking, including other automated reviewers'. Do not skip small ones. If you disagree with a finding, reply on the PR explaining why instead of silently ignoring it.
Re-run {verify_cmd}. Push with `git push --force-with-lease`.
Reply on the PR with a short summary of what changed per finding (`gh pr comment {N} --body-file <file>`).
Do NOT merge.

Print exactly: FIXED  (and any blocker).
```

## Re-review (same reviewer instance)

```text
Re-review PR #{N} after fixes in this worktree.

You and the implementer share this worktree, so the pushed fixes are already here — do NOT fetch, pull, or reset. Just re-read the current tree.
Re-read `read pr://{N}` including the implementer's responses, and re-check every item from your previous VERDICT.
Re-run {verify_cmd}.
Post an updated comment with the VERDICT format (LGTM or BLOCKING). Do NOT run `gh pr review --approve`.

Final line: verdict word + PR number.
```

## Docs pass (same implementer instance, after LGTM)

```text
The change for PR #{N} is implemented and approved. Now make documentation match.

Decide whether this change needs doc updates: README, docs/ guides, usage examples, public API/type docs, code comments on non-obvious logic, and the changelog if the repo keeps one. Follow the repo's docs conventions (and the `docs` skill if the repo uses it).
Make ONLY doc changes here — no behavior changes. Commit and `git push --force-with-lease`.
If nothing needs updating, do not push.

Print exactly: DOCS: updated   (or)   DOCS: none-needed
```

On `DOCS: updated`, run one light reviewer re-check (docs match behavior) before merge. On `DOCS: none-needed`, proceed straight to merge.

## Fix-cycle cap

Cap at **3 fix/re-review cycles per PR**. After a 3rd still-BLOCKING verdict, stop the loop, leave both agents in place, and surface the PR to the operator with the outstanding items — do not merge.
