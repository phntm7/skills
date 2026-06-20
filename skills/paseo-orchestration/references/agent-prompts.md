# Spawn skeletons

Each spawn is assembled from brief-bound inputs, not repo assumptions:

1. Forward `{per_agent_contract}` verbatim.
2. Point to this task's details from the brief: `{task_id}` at `{task_location}`.
3. Add only the small fixed Paseo tail in the matching skeleton.

Repo structure, commands, docs to read, and gotchas come from `{per_agent_contract}` or `{task_location}`. Core orchestration rules live in [SKILL.md](../SKILL.md).

## Implementer

```text
{per_agent_contract}

Implement {task_id} to its acceptance criteria read at {task_location}. Honor its blocked-by.
Scope: this task only.
Branch: one branch for this task per {branch_naming}.
Before handoff: run {verify_cmd} green.
PR: open a READY (not draft) PR against {base_branch}.
PR body: map each acceptance criterion to what changed.
Do NOT merge.
Report only the PR number + true blockers.

Never persist cookies, proxy credentials, solver tokens, request headers, or secret-bearing URLs in the codebase.
If {required_skills} is non-empty, verify ~/.agents/skills/<name>/SKILL.md exists for each required skill before work. If any is missing, stop and report: Required skill <name> not found — stopping.
```

## Reviewer

Reviewer lineage differs from implementer lineage; see [SKILL.md](../SKILL.md). The reviewer still receives `{per_agent_contract}` verbatim; ignore implementer-only branch creation or PR-opening lines.

```text
{per_agent_contract}

Review PR N for {task_id}. Read the same task context at {task_location}.

Inspect the PR directly:
- gh pr diff N
- git log {base_branch}..HEAD
- read changed files

Make ONE comprehensive pass surfacing blocking findings AND non-blocking improvements together.
Run {verify_cmd} yourself with force/not-cached behavior; the repo may have no CI.
Post the review as a PR comment via: gh pr comment N --body-file <file>
Use the fixed VERDICT format below.

Final message: verdict word + PR number.
Do NOT merge or push fixes.
```

```text
VERDICT: LGTM            (or) VERDICT: BLOCKING

## Blocking
1. ...    (or: none)

## Non-blocking improvements
1. ...    (or: none)

## Verification notes
1-3 lines: what you ran, what passed, the specific invariant checked
```

## Fix cycle

The PR is the source of truth. The 3-cycle cap and fresh-reviewer-after-BLOCKING rule live in [SKILL.md](../SKILL.md).

```text
{per_agent_contract}

Fix PR N for {task_id}. Read the task context at {task_location}.

Read ALL PR comments:
- gh pr view N --json comments
- gh api repos/{owner}/{repo}/issues/N/comments

Resolve EVERY actionable item, blocking and non-blocking. Do not skip small ones.
Re-run {verify_cmd}.
Push with: git push --force-with-lease
Reply with a short summary.
Do NOT merge.
```

## Merge-conflict fix

Use this when a sibling PR lands during review.

```text
{per_agent_contract}

Fix merge conflicts for PR N for {task_id}. Read the task context at {task_location} and the brief's merge-serialization groups.

Run: git fetch origin && git rebase origin/{base_branch}
Resolve conflicts, commonly migration/journal files and shared files named in the brief's merge-serialization groups.
Re-run {verify_cmd}.
Push with: git push --force-with-lease
Confirm: gh pr view N --json mergeable,mergeStateStatus
Required result: MERGEABLE/CLEAN.
Do NOT merge.
Report the outcome.
```

## Multi-reviewer pass (same worktree)

Use one checkout worktree for multiple reviewers. Respect the 2-agent cap in [SKILL.md](../SKILL.md).

```text
Create the shared review worktree:
paseo_create_worktree(target: {mode: "checkout-pr", prNumber: N})

Create reviewers pointed at that worktree.
Each reviewer:
- verifies every skill in {required_skills} exists at ~/.agents/skills/<name>/SKILL.md before work
- follows those skills
- reads {task_id} at {task_location}
- reviews PR N in that same worktree
- runs {verify_cmd}
- posts findings as a PR comment

Do not exceed the 2-agent cap.
Do NOT merge.
```