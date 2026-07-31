# Spawn prompt skeletons

Implementer prompts go to a herdr pane via `herdr agent prompt` (file-based for anything long — see [herdr-cli.md](herdr-cli.md)). Claude reviewer prompts go to a subagent via the Agent tool / SendMessage; codex reviewer prompts go to `codex exec` / `codex exec resume`. Keep prompts self-contained: a spawned agent starts blank and cannot see your conversation.

Fill the `{...}` slots from the repo and the issue source. `{verify_cmd}` and branch/commit conventions come from the repo's `AGENTS.md`/`CLAUDE.md` — read them and forward verbatim; never invent them.

Keep prompts lean. Modern models are good at figuring things out; give them the task, the constraints that aren't discoverable, and the output contract — not a procedure manual.

The Matt Pocock skill set is installed globally (`~/.agents/skills`) for both claude and codex. Prompts **route to those skills by name** and never restate what a skill already teaches — duplicated guidance drifts out of sync and bloats prompts.

## Implementer (first dispatch — claude or codex pane)

```text
You are implementing one issue end to end in this worktree ({wt_path}). You own the code.

Task: {task_pointer}  (e.g. read issues/12-*.md, or gh issue view 12, or the inline task text)
Acceptance criteria are the definition of done. Honor any "Blocked by".

Keep it simple (YAGNI): the smallest coherent implementation that meets acceptance — maintainable and readable, no speculative abstractions, few focused tests that exercise real behavior.

- Follow the repo's conventions (AGENTS.md/CLAUDE.md).
- Use the globally installed skills instead of improvising workflow: drive the work with the `implement` skill; `diagnosing-bugs` when fixing a bug; `tdd` when the task or repo calls for test-first; `codebase-design` / `design-an-interface` / `domain-modeling` when the task shapes a new module, API, or domain concept; `research` or `wayfinder` to orient in unfamiliar territory. Other installed skills apply as relevant — don't reinvent what a skill covers.
- Scope: this issue only. Match existing patterns; no drive-by refactors.
{fan_out_line}
- Branch is already checked out here: feature/{slug}. Commit per the repo's conventions.
- Before handoff run {verify_cmd} and get it green.
- Open a READY (not draft) PR against {base} with `gh pr create`. Map each acceptance criterion to what changed in the PR body{closes_clause}.
- Do NOT merge. Never persist secrets (tokens, cookies, keys, credential-bearing URLs).
- If you believe the task cannot be completed as specified, stop and state the blocker — do not silently reduce scope.

When done, print exactly: PR_NUMBER: <n>  (and any true blocker).
```

- `{fan_out_line}` (claude implementers only) = `- For larger tasks, fan out to subagents to parallelize independent chunks; they run on your own model.` Omit for codex.
- `{closes_clause}` = `; include "Closes #<N>"` for GitHub issues, else empty.

## Reviewer (each review pass)

Both reviewer kinds get the same routing line, prepended: `Use the code-review skill.` — or, for hard-tier changes (large refactors, deep-analysis work), `Use the deep-code-review skill.` The contract below is identical for claude subagent and codex exec reviewers.

```text
You are the code reviewer for PR #{N} in this worktree ({wt_path}). You do not write code.

Context: {task_pointer} — the same acceptance criteria the implementer worked to.

Inspect the PR directly: `gh pr view {N}`, `gh pr diff {N}`, `git log {base}..HEAD`, read changed files.
Run {verify_cmd} yourself (the repo may have no CI).
Make ONE comprehensive pass mapped against the acceptance criteria: blocking findings AND non-blocking improvements together. Also check scope fidelity — flag out-of-scope changes, needless abstractions, and tests that test nothing.
Judge BLOCKING strictly against acceptance and correctness; style preferences are non-blocking.

Post the review as a PR comment with `gh pr comment {N} --body-file <file>` using the VERDICT format below. That comment is the approval signal — do NOT run `gh pr review --approve` (same GitHub account; self-approval is rejected).

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

Read ALL feedback, not just the reviewer's verdict comment:
- `gh pr view {N} --json comments` — the VERDICT comment plus any bot/CI review comments.

Resolve EVERY actionable item — blocking and non-blocking. Do not skip small ones. If you disagree with a finding, reply on the PR explaining why instead of silently ignoring it.
Re-run {verify_cmd}. Push with `git push --force-with-lease`.
Reply on the PR with a short summary of what changed per finding (`gh pr comment {N} --body-file <file>`).
Do NOT merge.

Print exactly: FIXED  (and any blocker).
```

## Re-review (same reviewer instance — SendMessage or `codex exec resume`)

```text
Re-review PR #{N} after fixes in this worktree ({wt_path}).

The pushed fixes are already in this worktree — do NOT fetch, pull, or reset; re-read the current tree.
Re-read the PR comments including the implementer's responses, and re-check every item from your previous VERDICT.
Re-run {verify_cmd}.
Post an updated comment with the VERDICT format (LGTM or BLOCKING). Do NOT run `gh pr review --approve`.

Final line: verdict word + PR number.
```

## Docs pass (same implementer instance, after LGTM)

```text
The change for PR #{N} is implemented and approved. Now make documentation match.

Decide whether this change needs doc updates: README, docs/ guides, usage examples, public API/type docs, code comments on non-obvious logic, and the changelog if the repo keeps one. Follow the repo's docs conventions.
Make ONLY doc changes here — no behavior changes. Commit and `git push --force-with-lease`.
If nothing needs updating, do not push.

Print exactly: DOCS: updated   (or)   DOCS: none-needed
```

On `DOCS: updated`, run one light reviewer re-check (docs match behavior) before merge. On `DOCS: none-needed`, proceed straight to merge.

## Nudge (implementer idle without a PR — once, then escalate)

```text
You went idle without opening a PR. Re-read the task ({task_pointer}), complete any remaining acceptance criteria, run {verify_cmd}, and open the READY PR as instructed. If something genuinely blocks you, print the blocker instead.
```

## Fix-cycle cap

Cap at **3 fix/re-review cycles per PR**. After a 3rd still-BLOCKING verdict, stop the loop, leave the implementer and reviewer in place, and surface the PR to the operator with the outstanding items — do not merge.
