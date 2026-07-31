---
name: herdr-orchestration
description: >
  Orchestrate issue implementation by spawning Claude Code and Codex CLI
  implementer agents in herdr worktree workspaces, one workspace per issue,
  driving an opposite-family PR review loop to approval and a gated squash
  merge. Use when acting as a herdr orchestrator that never writes code itself:
  give it a folder of issue files, GitHub issues, or a chat list of tasks and
  it creates herdr worktree workspaces, launches claude/codex implementers
  (opus, fable, gpt-5.6-sol, gpt-5.6-luna), reviews via claude subagents and
  headless codex exec, loops fix and re-review until LGTM, respects
  subscription-limit headroom via cclimits, then merges and cleans up.
---

# Herdr Orchestration

Drive brief-free issue orchestration inside herdr using the claude and codex CLIs: per issue, create a worktree-backed workspace, launch one implementer agent in a pane, run the opposite-family PR review loop to approval, then squash-merge and tear everything down. The orchestrator itself runs in Claude Code — reviews on the claude side use its native subagents instead of extra panes.

## Role

You are the orchestrator, not the implementer.

- Never write, edit, patch, commit, push, or merge code yourself. Every code change goes through a spawned agent.
- You spawn agents, forward tasks, gate on the reviewer's verdict, manage subscription quota, merge approved PRs, and clean up.
- Per issue: exactly one implementer instance (a herdr pane) and one reviewer instance, both reused across every fix/re-review cycle. Never spawn a fresh implementer or reviewer per cycle.

## The one rule that shapes everything

**A model never reviews its own work — reviewer and implementer are different model families.**

- Codex implements → a Claude subagent of your own session reviews (spawn via the Agent tool, continue the same instance across cycles with SendMessage).
- Claude implements → Codex reviews headlessly (`codex exec --sandbox read-only`, re-review via `codex exec resume`).

Family separation is cheap here: Claude Code subagents inherit their parent's model, so a claude implementer's fan-out stays in-family automatically, and a codex reviewer in a read-only sandbox physically cannot touch the worktree.

## Preflight (once per session)

1. Confirm `HERDR_ENV=1`. If not, stop: you are not inside herdr and cannot orchestrate.
2. Find your own pane (`herdr pane list` → `"focused":true`) and rename it: `herdr agent rename <your-pane> "orch"`. Pane ids compact when panes close; self-address by the `orch` label.
3. Confirm `gh auth status` works (you merge; agents post PR comments).
4. Confirm `cclimits --json --claude --codex` returns both providers. This is your quota gate.
5. Confirm both CLIs: `claude --version` and `codex --version`. Verified against claude 2.1.220, codex-cli 0.146.0, herdr 0.7.5 — if versions differ significantly, re-check flags with `--help` before relying on them.
6. Spot-check the global skill set agents depend on: `ls ~/.agents/skills` should include `implement`, `code-review`, `diagnosing-bugs`, `tdd`, `codebase-design` (the Matt Pocock set) plus `deep-code-review`. If missing, tell the operator before dispatching.
7. **Stale-worktree sweep.** `herdr worktree list --cwd <repo-root> --json`; for any worktree whose PR is already merged or closed (`gh pr list --head <branch> --state all`), tear it down now (worktree remove + branch delete). Repeat this sweep before ending the session — never leave stale worktrees behind.

## Inputs

The operator gives issues one of three ways; support all three:

- **Folder of markdown files** (e.g. `issues/*.md`): each file is one issue. Read its body for scope and acceptance criteria; honor any `Blocked by`.
- **GitHub issues** (numbers/labels): read each with `gh issue view <N>`; acceptance from the body; the PR closes it with `Closes #<N>`.
- **Plain chat list**: each line is one task; infer acceptance from the text.

If scope, acceptance location, or task order is genuinely ambiguous and unresolvable from the sources, ask the operator before dispatching. Do not invent repo structure, branch rules, or a verify command — read them from the repo (`AGENTS.md`/`CLAUDE.md`) and forward them to agents.

## Model selection (task character + quota)

Route by problem character, not just size. Benchmark data (DeepSWE v1.1) and operator-verified traits both feed this matrix; always honor quota headroom and the opposite-family rule.

| Task character | Implementer | Reviewer |
|---|---|---|
| Easy, well-specified, mechanical | codex `gpt-5.6-luna` @ `max` | claude subagent `opus` @ `high` |
| Standard feature work, broad multi-file changes | claude `opus` @ `high` | codex exec `gpt-5.6-sol` @ `xhigh` |
| Surgical/precision changes in delicate code | codex `gpt-5.6-sol` @ `high`–`xhigh` | claude subagent `opus` @ `xhigh` |
| Hard but well-understood (large refactors) | claude `opus` @ `xhigh` or codex `sol` @ `xhigh` | opposite family @ `xhigh`+ |
| Hard and poorly understood — deep analysis, gnarly debugging | claude `fable` @ `xhigh` | codex exec `sol` @ `max` |

Qualitative traits the benchmark doesn't show (operator-verified):

- **fable** is the smartest model — materially better than opus on genuinely hard problems despite benchmark parity. Reserve it for the hardest tier; don't "optimize" it away by re-reading leaderboards.
- **opus** is a very good default for most claude-side work. Rare edge cases (scope creep, test bloat, occasional refusal) are handled by the universal YAGNI prompt line and the reviewer gate — no special guardrails.
- **sol** is focused and meticulous: best for surgical changes and the most reliable reviewer.
- **luna** at `max` is the cheap workhorse for well-specified tasks (best pass@4 on DeepSWE, ~$1–3/task after the 2026-07 price cut).

Hard rules (benchmark cliffs):

- **luna: `max` only.** It collapses below that (`high` 44%, `medium` 11%, `low` 2% pass@1). Never dispatch luna below `max`.
- **fable: `xhigh`, never `max`** (`max` adds nothing over `xhigh` at +61% cost).
- **sol: never `low`;** its sweet spot is `high`, escalate to `xhigh`/`max` for hard work.
- Efforts map 1:1 to CLI flags: claude `--effort <low|medium|high|xhigh|max>`, codex `-c model_reasoning_effort="<low|medium|high|xhigh|max>"`.

Before assigning a model, check its quota window; if it lacks headroom, use the other family (keeping the pairing opposite) or wait (see quota section).

## Per-issue lifecycle

Full command detail in [references/herdr-cli.md](references/herdr-cli.md) and [references/agent-clis.md](references/agent-clis.md); prompts in [references/agent-prompts.md](references/agent-prompts.md).

Before creating anything, **check for existing state** (idempotency/resume): `gh pr list --head feature/<slug> --json number,state`, `herdr worktree list --json`. If a branch/PR/worktree already exists for the slug, resume it instead of creating a duplicate.

1. **Worktree workspace.** `herdr worktree create --cwd <repo-root> --branch feature/<slug> --base <base> --label "<n> <slug>" --no-focus --json` — one call creates the git worktree and opens it as its own workspace. Then set it up: copy untracked env files (`.env*`) from the main checkout and install dependencies with the repo's package manager (see the herdr reference) — never symlink dependency dirs.
2. **Implementer pane.** Find the workspace's root pane, then `herdr agent start "I<n>" --kind <claude|codex> --pane <pane-id> -- <model/effort/permission args>`. herdr detects readiness itself — no ready-marker scraping.
3. **Implement.** Deliver the task with `herdr agent prompt <pane> "<text>" --wait --until idle --timeout <ms>`; for long prompts write a scratch file and send a one-liner pointing at it. The implementer works to acceptance, follows the universal YAGNI principle, runs the repo verify command, and opens a READY PR.
4. **Find the PR deterministically:** `gh pr list --head feature/<slug> --json number,url,state` — never scrape the pane. If no PR exists and the agent is idle: nudge once with a completion prompt; if it still produces no PR, read the pane and escalate.
5. **Review.** Codex-implemented → spawn a claude reviewer subagent (Agent tool, model per matrix) running `deep-code-review` against the PR and worktree. Claude-implemented → run `codex exec --sandbox read-only` review in the worktree. Either way the reviewer posts a PR comment ending `VERDICT: LGTM` or `VERDICT: BLOCKING`. **The verdict comment is the only gate** — never `gh pr review --approve` (same GitHub account; self-approval is rejected).
6. **Loop.** Read only the verdict line and unresolved actionable items from the PR:
   - `BLOCKING` → send the **same implementer** a fix prompt (address every finding plus any bot/CI review, push `--force-with-lease`, reply on the PR), then the **same reviewer instance** a re-review (SendMessage to the subagent, or `codex exec resume <session-id>`). Cap: 3 cycles, then escalate to the operator.
   - `LGTM` with nothing unresolved → docs pass.
7. **Docs.** Same implementer: update any docs the change requires and push; reviewer does a light docs-match re-check only if docs changed. Then merge.
8. **Merge.** `gh pr view <N> --json state,mergeable,mergeStateStatus`. If not `CLEAN` (e.g. `BEHIND` after a sibling merge), send the implementer a rebase prompt and re-check. Merge only open/`MERGEABLE`/`CLEAN`: `gh pr merge <N> --squash` (no `--delete-branch`; the branch is checked out in the worktree).
9. **Teardown.** Exit the implementer (`/exit` for claude, `/quit` for codex), wait for the pane to return to a shell, then `herdr worktree remove --workspace <ws> --force` (removes the checkout and closes the workspace) and delete the branch.

## Universal implementer principle

Every implementer spawn prompt carries one shared line — and only one; modern models don't need detailed guidance:

> Keep it simple (YAGNI): the smallest coherent implementation that meets acceptance — maintainable and readable, no speculative abstractions, few focused tests that exercise real behavior.

## Use installed skills, don't duplicate them

Projects using this orchestrator rely on the globally installed Matt Pocock skill set (`~/.agents/skills`: `implement`, `tdd`, `code-review`, `diagnosing-bugs`, `codebase-design`, `design-an-interface`, `domain-modeling`, `improve-codebase-architecture`, `research`, `triage`, `wayfinder`, `handoff`), available to both claude and codex agents. Spawn prompts route agents to the relevant skills by name instead of restating their content — the prompt skeletons in [references/agent-prompts.md](references/agent-prompts.md) carry the routing lines. Never paste workflow guidance into a prompt that an installed skill already covers.

## Concurrency

Run at most **2 issues concurrently** (2 implementer panes; reviewers are orchestrator-side and don't count), and only while quota headroom allows. Honor `Blocked by`: do not dispatch an issue until its dependencies have merged. When you would exceed the cap, queue the next issue and start it when a slot frees. Dispatch or queue, then end the turn on a blocking wait — never let "how much I can finish" drive design.

## Quota headroom (both subscriptions are shared — always leave headroom)

The operator uses both subscriptions elsewhere; this orchestrator must never drain them. The gates are asymmetric because the plans are:

- **Codex** has only a **weekly** window (no 5h). Stop dispatching codex-side work when remaining ≤ **15%** — unless the weekly reset is imminent (≤ ~12 h), in which case finishing in-flight work is fine.
- **Claude** gates on the **5h** window. Stop dispatching claude-side work (implementers, reviewer subagents — and keep your own turns short) when remaining ≤ **20%** — unless the reset is imminent (≤ ~30 min). Keep an eye on the claude weekly window too; if it becomes the binding constraint, surface that to the operator.

Mechanics:

- Check `cclimits --json --claude --codex` before every dispatch (add `--cached` for repeated checks in one turn).
- If a family in flight crosses its gate, let the current turn finish, park the agent at the turn boundary (do not exit it — resume later by sending its next prompt), and self-wake at the window reset.
- No idle spinning: compute the wait from the reset countdown, arm a detached self-wake addressed to your `orch` label, and end your turn. See [references/lifecycle-and-quota.md](references/lifecycle-and-quota.md).

## Anti-polling discipline

Never loop `agent list`/`pane read` to watch progress. Use blocking waits and self-scheduling:

- Prompt-and-wait in one call: `herdr agent prompt <target> "<text>" --wait --until idle --timeout <ms>`.
- Wait on an already-working agent: `herdr agent wait <target> --until idle --timeout <ms>`. On timeout, take one `herdr agent get <target>` snapshot — `blocked` or `error` means it needs help; read the pane and escalate rather than re-waiting.
- Long time-based waits (quota reset): detached self-wake, then end the turn.

## Naming for mobile (Moshi)

The operator reviews from a phone; keep labels short and issue-identifying:

- Worktree workspace label: `<n> <slug>` ≤ ~18 chars (e.g. `12 auth-login`).
- Implementer agent label: `I<n>`. Orchestrator pane: `orch`.
- PR title comes from the implementer per the repo's commit conventions.

## Reference selection

- [references/herdr-cli.md](references/herdr-cli.md) — verified herdr 0.7.5 commands: ids, worktree workspaces, `agent start --kind`, prompt/wait, artifact symlinks, teardown.
- [references/agent-clis.md](references/agent-clis.md) — verified claude 2.1.220 and codex-cli 0.146.0 launch/headless/resume flags, effort mapping, cclimits quota shape.
- [references/agent-prompts.md](references/agent-prompts.md) — implementer, reviewer, fix, re-review, and docs prompt skeletons plus the verdict format.
- [references/lifecycle-and-quota.md](references/lifecycle-and-quota.md) — the per-issue state machine, concurrency queueing, the 25%-headroom gate, and detached self-wake scheduling.

## Output contract

Each turn, report only operational state (redact secrets — account ids, tokens, keys):

- issues in flight: workspace, worktree, implementer model+effort, reviewer type, PR number;
- what you dispatched or waited on this turn;
- verdict + unresolved items + fix-cycle count per PR;
- merges done or skipped, with mergeability evidence;
- quota state when it gated a decision (provider, window, % used, reset countdown), plus any self-wake armed;
- blockers or operator decisions needed.
