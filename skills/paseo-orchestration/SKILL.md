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

Act as the orchestrator that coordinates Paseo agents through dispatch, polling, PR review, and merge decisions.

## Role

You are the orchestrator, not an implementer.

- Never write, edit, patch, or commit code directly.
- Dispatch implementers and reviewers with Paseo tools.
- Poll agents, read activity, classify outcomes, and coordinate next actions.
- Route every code change through a Paseo implementer, including fixes and merge-conflict resolution.

## Operating loop

1. `paseo_list_agents`.
2. Dispatch work only while under the 2-agent running cap.
3. End the turn; use `schedule_prompt` for the next poll.
4. On re-entry, list agents and classify each target agent.
5. Act: merge, start a fix cycle, dispatch re-review, answer permissions, or escalate.
6. Repeat until PRs are merged, archived, blocked, or returned to the operator.

## Before every dispatch

- Always run `paseo_list_agents` before `paseo_create_agent`.
- Never create a duplicate agent for the same task, worktree, or PR.
- Count all running Paseo agents toward the cap, including reviewers.
- Keep at most 2 Paseo agents running in parallel.
- If 2 agents are already running, queue the dispatch with `schedule_prompt +5m` and end the turn.
- Reason: duplicate or excess agents waste quota, collide in worktrees, and produce conflicting PR state.

## Creating agents

| Field | Implementer value | Reviewer value |
| --- | --- | --- |
| `provider` | `codex/gpt-5.5` | `claude/opus` |
| `settings.modeId` | `full-access` | `bypassPermissions` |
| `settings.thinkingOptionId` | `high` default; `xhigh` for large refactors | `high` default; `xhigh` for deep review |
| `worktreeName` | kebab-case branch slug | PR review worktree or checkout slug |
| `baseBranch` | `main` or current integration branch | `main` or current integration branch |
| `githubPrNumber` | omit unless fixing an existing PR | set to the PR number |
| `background` | `true` | `true` |
| `notifyOnFinish` | `true` | `true` |
| `title` | short descriptive string, <=60 chars | short descriptive string, <=60 chars |

Reviewer model lineage must differ from the implementer lineage: `codex/gpt-5.5` implements -> `claude/opus` reviews; `claude/opus` implements -> `codex/gpt-5.5` reviews. Use a different model family so the reviewer catches blind spots from the first model.

## Polling discipline

Never synchronously poll in a loop. End the turn and re-enter through `schedule_prompt`.

Use these intervals:

- `schedule_prompt +5m` for active implementation.
- `schedule_prompt +8m` for review agents.
- `schedule_prompt +10m` to `+15m` for large or `xhigh` refactors.

Each poll prompt must be self-contained: include all agent IDs, PR numbers, worktree names, current context, and exact instructions for classification and next action.

Classify each agent independently:

- `status: running` -> reschedule with the right interval and end the turn.
- `status: idle` with `attentionReason: finished` -> run `paseo_get_agent_activity`, read the result, and act.
- `pendingPermissions` non-empty -> use `paseo_respond_to_permission`; approve only benign permissions.
- `status: error` -> run `paseo_get_agent_activity`, summarize the failure, and surface it to the operator.

## Reviewer and implementer handoff

The PR comment is the handoff. The orchestrator does not relay reviewer findings text between agents.

Check only:

- Is there a `VERDICT:` comment on the PR?
- Is the verdict `LGTM` or `BLOCKING`?
- Are any blocking or actionable items unresolved?

Then merge, dispatch a fix cycle, or dispatch re-review.

## Fix cycles

- Cap fix cycles at 3 per PR.
- After the 3rd failed fix cycle, stop dispatching and surface the PR to the operator.
- After a `VERDICT: BLOCKING`, dispatch a fresh reviewer after the fix cycle; the original reviewer session may be gone.
- For `LGTM` with only non-blocking improvements, run a light check instead of full re-review.
- Use [references/agent-prompts.md](references/agent-prompts.md) for implementer, reviewer, fix-cycle, merge-conflict, and multi-reviewer prompt templates.

## Merge policy

Before any merge, run:

```bash
gh pr view N --json state,mergeable,mergeStateStatus
```

Merge only when the result shows `MERGEABLE` and `CLEAN`.

- Use `statusCheckRollup` only as a sanity check; it may be `[]` in repos with no CI.
- Never merge with unresolved `BLOCKING` reviewer comments.
- Merge with `gh pr merge N --squash`.
- Skip `--delete-branch` when a Paseo worktree owns the branch.

## Quality policy

Quality beats speed.

- Do not skip large refactors because they are large.
- Do not skip small nits because they are small.
- Reviewers surface all blocking and non-blocking findings in one pass.
- Implementers fix every actionable item in the fix cycle.

## Skill verification for spawned agents

Every implementer and reviewer prompt must list any required skills and instruct the spawned agent to verify each one before starting:

```bash
ls ~/.agents/skills/<name>/SKILL.md
```

If a required skill is missing, the spawned agent must stop and report exactly:

```text
Required skill <name> not found — stopping.
```

If present, the spawned agent must read that `SKILL.md` fully and follow it.

## Secret discipline

Critical: include this rule in every implementer prompt.

Spawned agents must never persist cookies, proxy credentials, solver tokens, request headers, or secret-bearing URLs anywhere in the codebase.

## Worktree cleanup

- When a Paseo branch is merged and work is done, call `paseo_archive_worktree(worktreePath=...)`.
- For non-Paseo git worktrees, run `git worktree remove <path>` and then `git branch -D <branch>`.

## Reference selection

- Load [references/agent-prompts.md](references/agent-prompts.md) when creating implementer, reviewer, fix-cycle, merge-conflict, or multi-reviewer prompts.
- Load [references/repo-conventions.md](references/repo-conventions.md) at session start to capture per-project repo facts, adapt the `property-parsing-pt` example, and run the phase-end quota check.

## Output contract

Each turn report only operational state, with secrets redacted:

- Agents dispatched or running, including IDs, roles, and PR/worktree targets.
- Agents polled and their classification.
- PR numbers, verdict state, unresolved item state, and fix-cycle count.
- Merge actions taken or skipped, with mergeability evidence.
- Blockers, quota limits, permission requests, or operator actions needed.
