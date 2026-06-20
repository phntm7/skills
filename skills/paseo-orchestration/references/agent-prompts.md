# Agent prompt templates

These are the prompt shapes the orchestrator dispatches to Paseo implementer and reviewer agents; every prompt is self-contained (the receiving agent has no prior context) and references the core orchestration rules in [SKILL.md](../SKILL.md) (concurrency cap, polling via `schedule_prompt`, merge gates) only where needed.

## Implementer prompt

Use this for an implementer that receives a prepared branch and turns one issue into a ready PR. Keep the parts in this order so the acceptance criteria remain the gate: read list, scope, numbered acceptance gate, dependency gotchas, workflow, then blockers. Include secret discipline and skill verification in every implementer prompt because spawned agents may use optional skills and must not persist credentials or secret-bearing data.

```text
You are the implementer for <ISSUE_ID>: <ISSUE_TITLE>.

1. Read list, in order:
   - AGENTS.md
   - CONTEXT.md
   - <PRD_PATH>
   - <ISSUE_FILE> — acceptance criteria in this file are the gate for done
   - Relevant ADRs: <ADR_PATHS_OR_NONE>

2. Scope:
   - Implement exactly <ISSUE_ID> only.
   - Do NOT expand beyond the issue.
   - Preserve existing behavior outside this issue unless an acceptance criterion requires changing it.

3. Acceptance gate:
   1. <CRITERION_1>
   2. <CRITERION_2>
   3. <CRITERION_3>
   ...

4. Known gotchas from prior merged PRs this work depends on:
   - <GOTCHA_1_OR_NONE>
   - <GOTCHA_2_OR_NONE>

5. Workflow:
   - Branch is already created: <BRANCH>.
   - Do NOT commit to main.
   - Use Conventional Commits for every commit.
   - Before declaring done, run the repo verification command: <TEST_CMD>.
   - Push <BRANCH> and open a READY PR, not a draft PR, against main.
   - In the PR body, map each numbered acceptance criterion above to the implementation that satisfies it.
   - Do NOT merge.
   - Stop after opening the PR and report only the PR number plus any true blocker.

6. Blockers:
   - This issue blocks: <BLOCKS_OR_NONE>.
   - This issue was blocked by: <BLOCKED_BY_OR_NONE>.

Secret discipline: never persist cookies, proxy credentials, solver tokens, request headers, or secret-bearing URLs anywhere in the codebase.
Skill verification: before using any skill, verify `~/.agents/skills/<name>/SKILL.md` exists. If it is missing, stop and report: `Required skill <name> not found — stopping.`
```

## Reviewer prompt

Use this for a reviewer whose model lineage differs from the implementer lineage: `codex/gpt-5.5` implementers are reviewed by `claude/opus`, and `claude/opus` implementers are reviewed by `codex/gpt-5.5`. The reviewer performs one comprehensive pass, posts the review as a PR comment, and does not push fixes.

The PR comment must use this exact format:

```markdown
VERDICT: LGTM            (or) VERDICT: BLOCKING

## Blocking
1. ...    (or: none)

## Non-blocking improvements
1. ...    (or: none)

## Verification notes
1-3 lines: what you ran, what passed, the specific invariant checked
```

```text
You are the reviewer for PR N: <PR_TITLE>.

Model-lineage check: your model lineage must differ from the implementer lineage. Implementer lineage: <IMPLEMENTER_LINEAGE>. Reviewer lineage: <REVIEWER_LINEAGE>. If these match, stop and report the mismatch.

1. Read list, in order:
   - AGENTS.md
   - CONTEXT.md
   - <PRD_PATH>
   - <ISSUE_FILE> — acceptance criteria in this file are the review gate
   - Relevant ADRs: <ADR_PATHS_OR_NONE>

2. Inspect the PR directly:
   - Run `gh pr diff N`.
   - Run `git log main..HEAD`.
   - Read the changed files directly; do not review only summaries.

3. Perform ONE comprehensive review pass and surface EVERYTHING together:
   - Blocking findings: acceptance-gate failures, safety invariant breaks, test tautologies, regressions, or missing required verification.
   - Non-blocking improvements: small and safe quality changes that should be fixed even if they do not block correctness.

4. Verification:
   - Run the repo verification command yourself with force/not-cached behavior because the repo may have no CI: <TEST_CMD_WITH_FORCE>.
   - Include exactly what passed or failed in the verification notes.

5. Post the review as a PR comment:
   - Write the review body to <REVIEW_BODY_FILE>.
   - Run `gh pr comment N --body-file <REVIEW_BODY_FILE>`.
   - Use exactly this comment structure:
     VERDICT: LGTM or VERDICT: BLOCKING
     ## Blocking
     numbered list, or `none`
     ## Non-blocking improvements
     numbered list, or `none`
     ## Verification notes
     1-3 lines: what you ran, what passed, the specific invariant checked

6. Final response:
   - Emit only the verdict word and PR number, for example: `LGTM PR N` or `BLOCKING PR N`.

Do NOT merge. Do NOT push fixes.
```

## Implementer fix-cycle prompt

Use this when a reviewed PR needs changes. The PR is the source of truth: the implementer reads all PR comments, fixes every actionable item, and force-pushes with lease. The orchestrator applies the 3-cycle cap from [SKILL.md](../SKILL.md); after a BLOCKING verdict, dispatch a fresh reviewer after the fix is pushed.

```text
You are the implementer for fix cycle <CYCLE_NUMBER> on PR N: <PR_TITLE>.

The PR is the source of truth. Read ALL PR comments, including the reviewer agent comment and automated code-review tool comments:
- `gh pr view N --json comments`
- `gh api repos/{owner}/{repo}/issues/N/comments`

Resolve EVERY actionable item:
- Fix all blocking findings.
- Fix all non-blocking improvements.
- Do not skip small items.
- If an item is not actionable or is intentionally not changed, explain why in your PR reply.

Workflow:
1. Make the fixes on the existing PR branch <BRANCH>.
2. Re-run the repo verification command: <TEST_CMD>.
3. Force-push safely: `git push --force-with-lease`.
4. Reply on the PR with a short summary of what changed and what verification ran.
5. Do NOT merge.

Cycle policy context: this is cycle <CYCLE_NUMBER> of 3. If this PR had a BLOCKING verdict, a fresh reviewer will be dispatched after your push.
```

## Merge-conflict fix prompt

Use this when a sibling PR lands while the current PR is in review and the branch needs to be rebased. The implementer updates the PR branch, resolves conflicts, verifies, force-pushes with lease, confirms mergeability, and reports the outcome without merging.

```text
You are resolving merge conflicts for PR N: <PR_TITLE> on branch <BRANCH>.

Context:
- A sibling PR landed while this PR was in review.
- Your job is to rebase this PR branch onto origin/main, resolve conflicts, verify, and report mergeability.

Workflow:
1. Run `git fetch origin && git rebase origin/main`.
2. Resolve all conflicts. Common conflict areas may include migration journal files such as `_journal.json` and shared files touched by sibling PRs.
3. Re-run the repo verification command: <TEST_CMD>.
4. Push safely: `git push --force-with-lease`.
5. Confirm mergeability is clean: `gh pr view N --json mergeable,mergeStateStatus` must show MERGEABLE/CLEAN.
6. Report the outcome: what conflicted, how it was resolved, verification result, and mergeability state.

Do NOT merge.
```

## Multi-reviewer pass (same worktree)

Use this for a PR review pass with several skill-based reviewers in one checked-out PR worktree. First create the shared worktree, then dispatch reviewers pointing at that worktree. Before launching reviewers, apply the 2-agent concurrency cap in [SKILL.md](../SKILL.md).

```text
Dispatch sketch for PR N: <PR_TITLE>

1. Create the shared review worktree:
   paseo_create_worktree(target: {mode: "checkout-pr", prNumber: N})

2. For each reviewer assignment below, create a reviewer agent pointed at the created worktree:
   - Reviewer A: skills <SKILL_A>, <SKILL_B>; focus <FOCUS_A>
   - Reviewer B: skills <SKILL_C>; focus <FOCUS_B>
   - Reviewer C: skills <SKILL_D>; focus <FOCUS_C>

3. Reviewer prompt template:
   You are a skill-based reviewer for PR N: <PR_TITLE> in worktree <WORKTREE_PATH>.

   Required skills: <SKILL_NAMES>.
   Before using each skill, verify `~/.agents/skills/<name>/SKILL.md` exists. If any required skill is missing, stop and report: `Required skill <name> not found — stopping.`

   Read:
   - AGENTS.md
   - CONTEXT.md
   - <PRD_PATH>
   - <ISSUE_FILE>
   - Relevant ADRs: <ADR_PATHS_OR_NONE>

   Review focus:
   - <ASSIGNED_FOCUS>

   Workflow:
   - Read the required skills fully and follow their methodology.
   - Inspect the PR directly with `gh pr diff N`, `git log main..HEAD`, and direct reads of changed files.
   - Post findings as a PR comment with `gh pr comment N --body-file <REVIEW_BODY_FILE>`.
   - Include blocking findings, non-blocking improvements, and verification notes appropriate to your assigned focus.
   - Do NOT merge.
   - Do NOT push fixes.
```
