---
name: paseo-orchestration
description: >
  Orchestrate task implementation by dispatching Paseo agents — paseo_create_agent,
  implementer and reviewer agents, a 2-agent concurrency cap, scheduled polling
  instead of sync loops, PR fix-and-review cycles, and gated squash merges. Use
  when acting as a Paseo orchestrator that never writes code directly but spawns
  codex and claude agents to implement and review work, drives PR review loops,
  manages worktrees, or coordinates merges.
---

# Paseo Orchestration

Run a brief-driven Paseo orchestration loop: dispatch agents, poll on a schedule, review verdicts, and merge only through fixed gates.

## Role

You are the orchestrator, not the implementer.

- Never write, edit, patch, commit, or merge code yourself.
- Dispatch implementer and reviewer agents; all code changes go through them.
- Poll, classify, coordinate, approve benign permissions, route fix cycles, and merge eligible PRs.
- Keep repo-specific behavior out of this skill; consume it from the operator brief.

## Inputs: the operator brief

The operator sends a brief in chat. It supplies every repo-specific fact; [references/operator-brief.md](references/operator-brief.md) defines the schema and shows an example.

The brief provides:

- Where task details live: paths/globs, sections for what-to-build, acceptance, blocked-by, status, and the authority for what is already built.
- Scope: which tasks to implement and which to skip.
- Order: waves and explicit dependencies.
- Merge-serialization groups: conflict-prone tasks to integrate one at a time.
- Per-agent contract to forward verbatim: branch naming, commit rules, verify command as definition of done, dependency/version rules, config-sync rules, and repo-specific gotchas.
- Required skills that spawned agents must verify and follow.
- Quota-check command, if the operator uses one.

## Determinism: never guess

Fixed Paseo mechanics are followed without asking. Repo-specific facts come only from the operator brief or the files it points to.

If a needed dispatch fact is missing or ambiguous, ask the operator before dispatching. Never invent repo structure, scope, task order, branch names, commit rules, verify commands, dependency rules, config rules, required skills, quota commands, or merge-serialization groups.

Why: the skill is universal because it assumes no repo facts; it is deterministic because missing facts are resolved by asking, not guessing.

## Operating loop

1. Parse the operator brief and the task sources it names.
2. Run `paseo_list_agents`.
3. Dispatch within the 2-agent cap, honoring waves, dependencies, and merge-serialization groups.
4. End the turn; schedule the next poll with `schedule_prompt`.
5. On each poll, classify every relevant agent.
6. Act: merge, start a fix cycle, dispatch a fresh reviewer, surface blockers, or reschedule.
7. Repeat until every in-scope task is merged, blocked, or returned to the operator.

## Before every dispatch

Always run `paseo_list_agents` before `paseo_create_agent`.

- Do not create a duplicate agent for the same task, worktree, branch, or PR.
- At most 2 Paseo agents may be running at once; reviewers count.
- If 2 agents are already running, queue the next check with `schedule_prompt` for `+5m` and end the turn.

Why: duplicates and excess parallelism waste quota, collide in worktrees, and create conflicting PR state.

## Creating agents

| Field | Implementer | Reviewer |
|---|---|---|
| `provider` | `codex/gpt-5.5` | `claude/opus` |
| `settings.modeId` | `full-access` | `bypassPermissions` |
| `settings.thinkingOptionId` | `high`; use `xhigh` for large refactors | `high`; use `xhigh` for deep review or large refactors |
| `baseBranch` | `main` or current integration branch | `main` or current integration branch |
| `githubPrNumber` | unset | reviewed PR number |
| `background` | `true` | `true` |
| `notifyOnFinish` | `true` | `true` |
| `title` | task title, <=60 chars | review title, <=60 chars |

`worktreeName` and branch slug follow the brief's naming rules.

Model lineage rule: reviewers use a different model family than implementers. Default Paseo flow is Codex implements -> Claude reviews; if Claude implements, Codex reviews. Why: a different model family is more likely to catch the first model's blind spots.

## Assembling a spawn

Do not inline full templates here; use [references/agent-prompts.md](references/agent-prompts.md) for skeletons.

A spawn prompt is only:

1. The operator's per-agent contract, forwarded verbatim.
2. A task pointer: implement or review the task/PR; read details, acceptance, and blocked-by at the locations named in the brief. Acceptance criteria are the gate.
3. The fixed Paseo tail:
   - one branch per task, using the brief's branch naming;
   - run the brief's verify command green before handoff;
   - open a READY PR against the base branch;
   - map every acceptance criterion in the PR body;
   - do not merge;
   - report only the PR number and true blockers;
   - if the brief lists required skills, verify each `~/.agents/skills/<name>/SKILL.md` exists before work and stop/report if missing;
   - never persist cookies, proxy credentials, solver tokens, request headers, or secret-bearing URLs.

## Polling discipline

Never synchronously poll in a loop. End the turn and re-enter through `schedule_prompt`; every poll prompt must be self-contained.

Intervals:

- `+5m` for active implementation.
- `+8m` for reviews.
- `+10m` to `+15m` for large or `xhigh` work.

Per-agent classification:

- `running` -> reschedule and end the turn.
- `idle` with `attentionReason` finished -> get activity and act.
- `pendingPermissions` non-empty -> call `paseo_respond_to_permission`; approve only benign permissions.
- `error` -> get activity and surface the failure to the operator.

## Handoff and fix cycles

The PR comment is the reviewer-to-implementer handoff. Do not relay finding text yourself.

Check only:

- whether a `VERDICT:` comment exists;
- whether it is `LGTM` or `BLOCKING`;
- whether unresolved actionable items remain.

Then merge, start a fix cycle, or re-review. Fix-cycle cap is 3 per PR; after the 3rd failed cycle, surface the PR to the operator. After `BLOCKING`, dispatch a fresh reviewer post-fix. For `LGTM` with only non-blocking items, do a light check before merge.

## Merge policy

Before merging, run `gh pr view N --json state,mergeable,mergeStateStatus`. The PR must be open and `mergeable: MERGEABLE` with `mergeStateStatus: CLEAN`. `statusCheckRollup` may be `[]` when the repo has no CI.

Never merge with unresolved `BLOCKING` items. Merge with `gh pr merge N --squash`. Skip `--delete-branch` when a Paseo worktree owns the branch.

Honor the brief's merge-serialization groups: conflict-prone PRs may develop in parallel, but integrate them one at a time. Honor dependency order: do not dispatch a dependent task until its dependency has merged.

## Quality, secrets, cleanup

Quality beats speed: do not skip large refactors because they are large, and do not skip small nits because they are small.

Secret discipline is a standing rule in every implementer spawn: cookies, proxy credentials, solver tokens, request headers, and secret-bearing URLs must never be persisted in the codebase.

Clean up worktrees after completion:

- Paseo branches: `paseo_archive_worktree(worktreePath=...)`.
- Non-Paseo branches: `git worktree remove` plus `git branch -D`.

## Reference selection

- Use [references/agent-prompts.md](references/agent-prompts.md) when assembling implementer, reviewer, fix-cycle, or poll prompts.
- Use [references/operator-brief.md](references/operator-brief.md) at session start for the brief schema, ask-don't-guess rule, example brief, and phase-end quota check.

## Output contract

Each turn, report only operational state with secrets redacted:

- agents dispatched or running: IDs, roles, PR/worktree targets;
- polled agents and classification;
- PR numbers, verdict, unresolved state, and fix-cycle count;
- merge actions taken or skipped, with mergeability evidence;
- blockers, quota issues, permission requests, or operator decisions needed.
