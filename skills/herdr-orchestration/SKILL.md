---
name: herdr-orchestration
description: >
  Use when orchestrating multiple issues through Herdr with Claude Code, Codex,
  or Pi agents; it manages worktrees, cross-family review loops, gated merges, and cleanup.
---

# Herdr Orchestration

Drive brief-free issue orchestration inside herdr using the claude, codex, and pi CLIs: per issue, create a worktree-backed workspace, launch one implementer agent in a pane and one cross-family reviewer agent in a pane split beside it, run the PR review loop to approval, then squash-merge and tear everything down. Both agents are visible panes the operator can watch — no headless background reviews, no sandboxes (all agents run in yolo/bypass mode).

## Role

You are the orchestrator, not the implementer.

- Never write, edit, patch, commit, or push code yourself. Every code change goes through a spawned agent.
- Act as the supervisor, not a passive dispatcher: watch progress at bounded checkpoints, steer drift early, interrupt clearly wrong or unsafe work, and verify every handoff. Let sound work proceed without micromanaging it.
- You spawn agents, forward tasks, gate on the reviewer's verdict, manage subscription quota, and clean up. Merging approved PRs is **your** job — the one git action you perform.
- Per issue: exactly one implementer pane and one reviewer pane, side by side in the issue's workspace, both reused across every fix/re-review cycle. Never spawn a fresh implementer or reviewer per cycle — accumulated context is the point.

## The one rule that shapes everything

**A model never reviews its own work — reviewer and implementer are different model families.**

- Codex implements → a claude reviewer pane reviews, and vice versa.
- pi models (DeepSeek, GLM, Grok) are three further distinct families: a pi implementer is reviewed by claude, codex, or a *different pi family*; a pi reviewer may review claude or codex work. DeepSeek Pro and Flash are the same family and must never review each other. `deepseek-v4-flash` is the budget reviewer of choice; reserve `grok-4.6` for cases where its stronger review is worth the scarce weekly pool.

The reviewer runs in the same yolo mode as the implementer — no sandbox. The don't-touch-the-code discipline is contractual, not enforced: the reviewer prompt forbids edits, commits, and pushes, and the oid-pinned merge gate catches any unreviewed change regardless of who made it. Claude-side fan-out stays in-family automatically (Claude Code subagents inherit their parent's model).

## Preflight (once per session)

1. Confirm `HERDR_ENV=1`. If not, stop: you are not inside herdr and cannot orchestrate.
2. Identify your own pane — never via `"focused":true`, which another client can own. Resolve the id into a variable first, then rename: `pane="${HERDR_PANE_ID:-$(herdr pane current | jq -r .result.pane.pane_id)}"; herdr agent rename "$pane" "orch"` (adjust the jq path to the actual output on first use). Self-address by the `orch` label afterwards; pane ids compact when panes close. Agent names must match `^[a-z][a-z0-9_-]{0,31}$` — lowercase only.
3. Confirm `gh auth status` works (you merge; agents post PR comments).
4. Confirm the quota gate: `codexbar usage --json --provider opencodego` returns usage (fast local probe). If codexbar is missing, fall back to `cclimits --json --claude --codex` — it covers claude/codex only, so pi-side quotas (opencode-go, z.ai, grok) run unmeasured (see quota section).
5. Confirm the agent CLIs you will dispatch: `claude --version`, `codex --version`, `pi --version`. Verified against claude 2.1.228, codex-cli 0.147.0, pi 0.84.1, codexbar 0.49.4, herdr 0.8.0 — if versions differ significantly, re-check flags with `--help` before relying on them.
6. Spot-check the global skill set agents depend on: `ls ~/.agents/skills` should include `implement`, `code-review`, `diagnosing-bugs`, `tdd`, `codebase-design` (the Matt Pocock set) plus `deep-code-review`. If missing, tell the operator before dispatching.
7. **Stale-worktree sweep.** `herdr worktree list --cwd <repo-root> --json`; for any worktree whose PR is **merged** (`gh pr list --head <branch> --state all`), tear it down now (worktree remove + branch delete). Closed-but-unmerged PRs may be intentionally retained — surface those to the operator instead of deleting. Repeat this sweep before ending the session — never leave stale worktrees behind.

## Inputs

The operator gives issues one of three ways; support all three:

- **Folder of markdown files** (e.g. `issues/*.md`): each file is one issue. Read its body for scope and acceptance criteria; honor any `Blocked by`.
- **GitHub issues** (numbers/labels): read each with `gh issue view <N>`; acceptance from the body; the PR closes it with `Closes #<N>`.
- **Plain chat list**: each line is one task; infer acceptance from the text.

If scope, acceptance location, or task order is genuinely ambiguous and unresolvable from the sources, ask the operator before dispatching. Do not invent repo structure, branch rules, or a verify command — read them from the repo (`AGENTS.md`/`CLAUDE.md`) and forward them to agents.

## Model selection (task character + quota)

Route by problem character, not just size. Benchmark data (DeepSWE v1.1) and operator-verified traits both feed this matrix; always honor quota headroom and the cross-family rule.

| Task character | Implementer | Reviewer |
|---|---|---|
| Easy, well-specified, mechanical | codex `gpt-5.6-luna` @ `max` | claude `opus` @ `high` |
| Standard feature work, broad multi-file changes | claude `opus` @ `high` | codex `gpt-5.6-sol` @ `xhigh` |
| Surgical/precision changes in delicate code | codex `gpt-5.6-sol` @ `high`–`xhigh` | claude `opus` @ `xhigh` |
| Hard but well-understood (large refactors) | claude `opus` @ `xhigh` or codex `sol` @ `xhigh` | opposite family @ `xhigh`+ |
| Hard and poorly understood — deep analysis, gnarly debugging | claude `fable` @ `xhigh` | codex `sol` @ `max` |
| Bulk well-specified work, or claude/codex quota is tight | pi `deepseek-v4-flash` @ `max` by default; use `deepseek-v4-pro` @ `max` only when its possible quality gain is worth the smaller allowance; reserve `grok-4.6` (vendor-default `high`) for work where speed/quality matters enough to spend its weekly pool | any other family — never DeepSeek reviewing DeepSeek |

Qualitative traits the benchmark doesn't show (operator-verified):

- **fable** is the smartest model — materially better than opus on genuinely hard problems despite benchmark parity. Reserve it for the hardest tier; don't "optimize" it away by re-reading leaderboards.
- **opus** is a very good default for most claude-side work. Rare edge cases (scope creep, test bloat, occasional refusal) are handled by the universal YAGNI prompt line and the reviewer gate — no special guardrails.
- **sol** is focused and meticulous: best for surgical changes and the most reliable reviewer.
- **luna** at `max` is the cheap codex-side workhorse for well-specified tasks.
- **deepseek-v4-flash** at `max` is the default pi implementer and reviewer: Pro's higher benchmark point estimate is not statistically separated, while Flash has far more OpenCode Go allowance. Use **deepseek-v4-pro** only when retry tolerance or operator experience favors it.
- **grok-4.6** is a fast, strong pi option, but its shared weekly pool burns quickly. Spend it selectively and route routine work to Flash. The **z.ai lane remains parked** until GLM-5.3 stops rate-limiting in operator tests.
- Re-run the `coding-benchmarks` skill when revisiting model choices; do not preserve leaderboard ledgers here.

Hard rules (benchmark cliffs):

- **luna: `max` only.** It collapses below that (`high` 44%, `medium` 11%, `low` 2% pass@1). Never dispatch luna below `max`.
- **fable: `xhigh`, never `max`** (`max` adds nothing over `xhigh` at +61% cost).
- **sol: never `low`;** its sweet spot is `high`, escalate to `xhigh`/`max` for hard work.
- **DeepSeek: `max` only.** **Grok: vendor-default `high`.** Pi 0.84.1 cannot transmit Grok effort, so its `:high` suffix is documentary and `:xhigh` would not escalate it. See [references/agent-clis.md](references/agent-clis.md) for launch details.

Before assigning a model, check its quota window; if it lacks headroom, use another family (keeping the pairing cross-family) or wait (see quota section).

## Per-issue lifecycle

Full command detail in [references/herdr-cli.md](references/herdr-cli.md) and [references/agent-clis.md](references/agent-clis.md); prompts in [references/agent-prompts.md](references/agent-prompts.md).

Branch naming follows the repo's convention; `feature/<slug>` below is the default when the repo doesn't specify one.

Before creating anything, **check for existing state** (idempotency/resume): `gh pr list --head feature/<slug> --state all --json number,state`, `herdr worktree list --json`, `git -C <repo-root> branch --list 'feature/<slug>'`. Resume by state, never duplicate:

- PR **merged** → only leftovers remain: run teardown (step 9).
- PR **closed but unmerged** → surface to the operator; don't reopen or delete on your own.
- PR **open** + worktree present → re-enter the loop at the state the PR shows (no verdict yet → review; BLOCKING verdict → fix cycle; LGTM → docs/merge).
- PR **open** but the worktree/workspace is gone → rebuild it from the existing branch: if the checkout still exists (`herdr worktree list --cwd <repo-root> --json` shows its path), `herdr worktree open --path <wt-path>`; otherwise `git -C <repo-root> worktree add <wt-path> feature/<slug>` then `herdr worktree open --path <wt-path>`. Redo worktree setup (env + deps), then re-enter the loop at the PR's state.
- Branch or worktree exists but **no PR** → re-attach an implementer to the existing worktree (reopen a closed workspace with `herdr worktree open`) and continue implementation.

1. **Worktree workspace.** `herdr worktree create --cwd <repo-root> --branch feature/<slug> --base <base> --label "<n> <slug>" --no-focus --json` — one call creates the git worktree and opens it as its own workspace. Then set it up: copy untracked env files (`.env*`) from the main checkout and install dependencies with the repo's package manager (see the herdr reference) — never symlink dependency dirs.
2. **Implementer pane.** Find the workspace's root pane, then `herdr agent start "i<n>" --kind <claude|codex|pi> --pane <pane-id> -- <model/effort/permission args>` (names must be lowercase). herdr detects readiness itself — no ready-marker scraping.
3. **Implement.** Deliver the task with `herdr agent prompt <target> "<text>" --wait --timeout <ms>` — no explicit `--until`: the default matches `idle`, `done`, or `blocked`, and you classify the settled state afterwards with `herdr agent get`. For long prompts write a scratch file and send a one-liner pointing at it. The implementer works to acceptance, follows the universal YAGNI principle, runs the repo verify command, and opens a READY PR.
4. **Find the PR deterministically:** `gh pr list --head feature/<slug> --json number,url,state` — never scrape the pane. If no PR exists and the agent is idle: nudge once with a completion prompt; if it still produces no PR, read the pane and escalate.
5. **Reviewer pane.** On first review, split the implementer's pane and start the cross-family reviewer beside it: `herdr pane split --pane <impl-pane> --direction right --cwd <wt-path>`, then `herdr agent start "r<n>" --kind <other-family> --pane <new-pane> -- <model/effort/yolo args>`. This pane persists for the issue's whole life — every re-review goes to it.
6. **Review.** First record the commit under review: `gh pr view <N> --json headRefOid` → `<review-oid>`, and put it in the review prompt (the reviewer states it in its Verification section). Deliver the review prompt to the reviewer pane with `herdr agent prompt r<n> ... --wait`. The reviewer uses the `code-review` skill (`deep-code-review` for hard-tier changes), also weighs any third-party bot reviews already on the PR, and posts the PR comment itself. The comment ends `VERDICT: LGTM` or `VERDICT: BLOCKING`. **The only gate is a verdict that attests `<review-oid>` while the PR head still equals it** — if the head moved during review, the verdict is void; re-review. Never `gh pr review --approve` (same GitHub account; self-approval is rejected).
7. **Loop.** Act on the verdict line and unresolved actionable items:
   - `BLOCKING` → send the **same implementer pane** a fix prompt (address every finding — the reviewer's, third-party review bots', and CI's — push `--force-with-lease`, reply on the PR), then the **same reviewer pane** a re-review prompt with a **freshly captured** `<review-oid>` — every push voids the prior oid. Cap: 3 cycles, then escalate to the operator.
   - `LGTM` but actionable non-blocking items remain → one fix turn for them, then a light reviewer re-check (not a full re-review); explicitly waived trivia gets a waiver note on the PR instead of silence.
   - `LGTM` with nothing unresolved → docs pass.
8. **Docs.** Same implementer: update any docs the change requires and push; reviewer does a light docs-match re-check only if docs changed. Then merge.
9. **Merge.** `gh pr view <N> --json state,mergeable,mergeStateStatus`. Route by state — not everything means "rebase":
   - `BEHIND`/`DIRTY` → rebase prompt to the implementer. Any rebase changes the head oid, so get at least a light re-verdict after (a *conflicted* rebase gets a full re-review — conflict resolution is a code change).
   - `UNSTABLE` (mergeable, checks pending/failing) → wait for CI or dispatch a fix; `BLOCKED` (required review/branch protection) → check what blocks; draft → have the implementer mark it ready; `UNKNOWN` → re-check once before acting.
   - Open/`MERGEABLE`/`CLEAN` (or `HAS_HOOKS`) → `gh pr merge <N> --squash --match-head-commit <review-oid>` (no `--delete-branch`; the branch is checked out in the worktree). The `--match-head-commit` pin makes a push between gate and merge fail safely instead of merging unreviewed code.
10. **Teardown.** Exit both agents (`/exit` for claude, `/quit` for codex and pi), wait for their panes to return to a shell, then `herdr worktree remove --workspace <ws> --force` (removes the checkout, closes the workspace and both panes) and delete the branch.

### Active supervision

Use bounded waits (normally five minutes while an agent is actively coding or reviewing), then inspect once: `herdr agent read <target> --source recent --lines 60`. Compare the work with the issue, acceptance criteria, and current lifecycle state. If the agent is drifting, send a concise correction; if it is continuing clearly wrong, destructive, or out-of-scope work, interrupt with `herdr agent send-keys <target> C-c`, then steer it. If progress is sound, return to a blocking wait. Supervision means timely intervention, not continuous pane polling.

## Universal implementer principle

Every implementer spawn prompt carries one shared line — and only one; modern models don't need detailed guidance:

> Keep it simple (YAGNI): the smallest coherent implementation that meets acceptance — maintainable and readable, no speculative abstractions, few focused tests that exercise real behavior.

## Use installed skills, don't duplicate them

Projects using this orchestrator rely on the globally installed Matt Pocock skill set (`~/.agents/skills`: `implement`, `tdd`, `code-review`, `diagnosing-bugs`, `codebase-design`, `design-an-interface`, `domain-modeling`, `improve-codebase-architecture`, `research`, `triage`, `wayfinder`, `handoff`), available to both claude and codex agents. Spawn prompts route agents to the relevant skills by name instead of restating their content — the prompt skeletons in [references/agent-prompts.md](references/agent-prompts.md) carry the routing lines. Never paste workflow guidance into a prompt that an installed skill already covers.

## Concurrency

Run at most **2 issues concurrently** (up to 4 agent panes: one implementer + one reviewer per issue), and only while quota headroom allows. Honor `Blocked by`: do not dispatch an issue until its dependencies have merged. When you would exceed the cap, queue the next issue and start it when a slot frees. Dispatch or queue, then end the turn on a blocking wait — never let "how much I can finish" drive design.

## Quota headroom (all subscriptions are shared — always leave headroom)

The operator uses these subscriptions elsewhere; leave headroom. Active routes are **codex** (weekly), **claude** (5h plus weekly), **opencode-go** (5h, weekly, monthly), and **grok** (one shared weekly pool). The parked z.ai details live in [references/lifecycle-and-quota.md](references/lifecycle-and-quota.md).

The gate is by window length, uniform across providers:

- Windows **≤ 5h**: stop dispatching that family when remaining ≤ **20%** — unless the reset is imminent (≤ ~30 min). For claude this also means keeping your own turns short.
- **Weekly/monthly** windows: stop when remaining ≤ **15%** — unless the reset is imminent (≤ ~12 h), in which case finishing in-flight work is fine.

Gate each provider on **whatever windows codexbar actually reports**. CodexBar's Grok result may omit `windowMinutes`; classify that pool as weekly. Also conserve a family when its burn pace would exhaust the window before reset, even if it has not crossed the fixed floor.

Mechanics:

- Check `codexbar usage --json --provider <codex|claude|opencodego|zai|grok>` before every dispatch of that family — one provider per call. opencodego/zai/grok answer in ~0.2–2s; **claude and codex take ~15–25s** (API/web-dashboard sources) — run those two as parallel background jobs, and never use `--provider all` (30s+, and it drags in disabled providers as error objects). codexbar has no cache: reuse this turn's results instead of re-fetching; re-check only the family you are about to spend.
- If codexbar is unavailable, fall back to `cclimits --json --claude --codex` (add `--cached` for repeated checks in one turn). cclimits does not cover opencode-go or grok — treat those as unmeasured providers: proceed, tell the operator, and let runtime quota errors be the stop signal.
- If a family in flight crosses its gate, let the current turn finish, park the agent at the turn boundary (do not exit it — resume later by sending its next prompt), and self-wake at the window reset.
- No idle spinning: compute the wait from the reset countdown, arm a detached self-wake addressed to your `orch` label, and end your turn. See [references/lifecycle-and-quota.md](references/lifecycle-and-quota.md).

## Anti-polling discipline

Never busy-poll `agent list`/`pane read`. Use bounded blocking waits for active supervision and self-scheduling for long quota waits:

- Prompt-and-wait in one call: `herdr agent prompt <target> "<text>" --wait --timeout <ms>` — omit `--until` so the default matches any settled state (`idle`, `done`, or `blocked`), then classify with `herdr agent get`.
- Wait on an already-working agent with a bounded timeout: `herdr agent wait <target> --timeout <ms>`. On timeout or `blocked`, inspect once and steer as needed; otherwise resume the wait.
- Long time-based waits (quota reset): detached self-wake, then end the turn.

## Naming for mobile (Moshi)

The operator reviews from a phone; keep labels short and issue-identifying:

- Worktree workspace label: `<n> <slug>` ≤ ~18 chars (e.g. `12 auth-login`).
- Implementer agent label: `i<n>`, reviewer label: `r<n>` (lowercase — herdr rejects uppercase names). Orchestrator pane: `orch`.
- PR title comes from the implementer per the repo's commit conventions.

## Reference selection

- [references/herdr-cli.md](references/herdr-cli.md) — verified herdr 0.8.0 commands: ids, worktree workspaces, pane splits, `agent start --kind`, prompt/wait, teardown.
- [references/agent-clis.md](references/agent-clis.md) — verified claude, codex, and pi launch flags (yolo mode for all), effort/thinking mapping, codexbar quota shape and latencies, cclimits fallback.
- [references/agent-prompts.md](references/agent-prompts.md) — implementer, reviewer, fix, re-review, and docs prompt skeletons plus the verdict format.
- [references/lifecycle-and-quota.md](references/lifecycle-and-quota.md) — the per-issue state machine, concurrency queueing, the quota headroom gates, and detached self-wake scheduling.

## Output contract

Each turn, report only operational state (redact secrets — account ids, tokens, keys):

- issues in flight: workspace, worktree, implementer model+effort, reviewer type, PR number;
- what you dispatched or waited on this turn;
- any steering or interruption and why;
- verdict + unresolved items + fix-cycle count per PR;
- merges done or skipped, with mergeability evidence;
- quota state when it gated a decision (provider, window, % used, reset countdown), plus any self-wake armed;
- blockers or operator decisions needed.
