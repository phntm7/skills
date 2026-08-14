---
name: herdr-omp-orchestration
description: >
  Use when orchestrating issue implementation through Herdr with OMP implementer
  and reviewer agents; it manages worktrees, review loops, gated merges, and cleanup.
---

# Herdr OMP Orchestration

Drive brief-free issue orchestration inside herdr: per issue, create a worktree and a tab, launch an implementer agent and an opposite-model reviewer agent as interactive omp sessions in side-by-side panes, run the PR fix/re-review loop to approval, then squash-merge and tear everything down.

## Role

You are the orchestrator, not the implementer.

- Never write, edit, patch, commit, push, or merge code yourself. Every code change goes through a spawned agent.
- You spawn agents, forward tasks, watch panes, gate on the reviewer's verdict, manage subscription quota, merge approved PRs, and clean up.
- Exactly two agents exist per issue — one implementer, one reviewer — and they are reused across every fix/re-review cycle. Never spawn a fresh agent per cycle.

## The one rule that shapes everything

**A model never reviews its own work.** The implementer and reviewer must be different model families, and — because omp's `task` subagent defaults to its own model — the reviewer's subagent fan-out must also stay on the reviewer's family. You enforce this by launching each omp agent with a per-process `--config` overlay that pins `modelRoles.{default,task,slow,plan}` to that agent's assigned model (see [references/herdr-omp-cli.md](references/herdr-omp-cli.md)). Without the overlay, `deep-code-review`'s subagents silently run on the implementer's model and the review is worthless.

## Preflight (once per session)

1. Confirm `HERDR_ENV=1`. If not, stop: you are not inside herdr and cannot orchestrate.
2. Identify your own workspace: `herdr pane list` → find the pane with `"focused":true`; its `workspace_id` (e.g. `w9`) is where every issue tab goes. Then rename yourself for stable self-scheduling: `herdr agent rename <your-pane> "orch"` — herdr pane ids compact when panes close, so address your own pane by the `orch` label, not a stored id.
3. Confirm `gh auth status` works (you merge and the agents post PR comments).
4. Confirm `omp usage --json` returns reports. This is your quota gate; there is no separate script.
5. Discover available models: `omp models find gpt-5.5`, `omp models find opus`, `omp models find glm-5.2`. Provider ids vary by machine — never hardcode them; read them here.

## Inputs

The operator gives issues one of three ways; support all three:

- **Folder of markdown files** (e.g. `issues/*.md`): each file is one issue. Read its body for scope and acceptance criteria; honor any `Blocked by`.
- **GitHub issues** (numbers/labels): read each with `read issue://<N>`; acceptance from the body; the PR closes it with `Closes #<N>`.
- **Plain chat list**: each line is one task; infer acceptance from the text.

If scope, acceptance location, or task order is genuinely ambiguous and unresolvable from the sources, ask the operator before dispatching. Do not invent repo structure, branch rules, or a verify command — read them from the repo (`AGENTS.md`/`CLAUDE.md`) and forward them to agents.

## Model selection (difficulty + quota)

Pick per issue, always honoring quota headroom (below) and the opposite-family rule:

- **Easy** issue (small, mechanical, low-risk) → implement with `glm-5.2` (via a discovered subscription provider); review with a strong opposite family.
- **Medium/large** issue → implement with a strong model (`openai-codex/gpt-5.5` or `anthropic/claude-opus-4-8`); review with the *other* strong family.
- Families in play: `openai-codex` (gpt-5.5), `anthropic` (opus-4-8), `glm`/zhipu (glm-5.2). Implementer family ≠ reviewer family, every time.
- **Subscription selectors only — never API-key providers.** Use `openai-codex/gpt-5.5` (Codex subscription), NOT `openai/gpt-5.5` (that is the pay-per-token API key: it bypasses subscription-quota tracking and spends real money). Likewise `anthropic/claude-opus-4-8` and `glm-5.2` via a discovered subscription provider (`opencode-go`, `cline-pass`, `neuralwatt`, `zai`) — never an API-key equivalent. Only dispatch a model that `omp usage` reports a subscription window for.
- **Subagents run the agent's own model.** Each agent's `--config` overlay pins `modelRoles.task` to its assigned model, so any subagent it spawns runs the same subscription model and correct family — not omp's default `task` model. Instruct the implementer to fan out to subagents for larger tasks. Caveat: fan-out multiplies burn on that one subscription, so when the chosen model's window is already >50% used, tell it to stay single-agent or fan out narrowly to protect the 25% headroom.
- Thinking: `high` by default; `xhigh` for large refactors or deep reviews.

Before assigning a model, check its quota; if it lacks headroom, choose another family or wait (see quota section).

## Per-issue lifecycle

Full command detail is in [references/herdr-omp-cli.md](references/herdr-omp-cli.md); spawn prompts are in [references/agent-prompts.md](references/agent-prompts.md).

Before creating anything for an issue, **check for existing state** (idempotency/resume): `gh pr list --head feature/<slug> --json number,state`, `git worktree list`, `herdr tab list --workspace <your-ws>`. If a branch/PR/worktree/tab already exists for the slug, resume it instead of creating a duplicate.

1. **Worktree.** `git worktree add <wt-path> -b feature/<slug> <base>` from the target repo (base = `main` unless the repo says otherwise). Both agents share this one worktree. If the repo needs heavy build artifacts to verify (JS `node_modules`, Rust `target`, Python `.venv`, native `*.node`), symlink them from the main checkout so verify does not reinstall from scratch — see the CLI reference.
2. **Tab.** `herdr tab create --workspace <your-ws> --cwd <wt-path> --label "<short>" --no-focus`. Parse `result.tab.tab_id` and `result.root_pane.pane_id`.
3. **Implementer pane.** Run interactive omp in the tab's root pane: `herdr pane run <root-pane> "omp --model <impl-model> --config <impl-overlay> --cwd <wt-path>"`, then `herdr agent rename <root-pane> "I<n>"`. The overlay pins the model, thinking level, and `tools.approvalMode: yolo` so the agent never stalls on a tool-approval prompt (do not depend on the operator's global approval setting).
4. **Reviewer pane.** `herdr agent start "R<n>" --tab <tab-id> --split right --cwd <wt-path> --no-focus -- omp --model <rev-model> --config <rev-overlay>`.
5. **Implement.** Wait until omp is ready for input (`herdr wait output <impl-pane> --match "<omp-ready marker>" --timeout <ms>`), then deliver the task by **file, not paste**: write the full prompt to a scratch file and send a one-liner — `herdr agent send <impl-pane> "read <prompt-file> and follow it exactly"`, then `herdr pane send-keys <impl-pane> Enter`. This avoids multi-line-paste and escaping failures in the TUI. The implementer uses the project `implement` skill if present, follows the required skills for the change type (React → `vercel-composition-patterns` + `vercel-react-best-practices`; shadcn project with frontend work → `shadcn`), fans out to subagents for larger tasks, works to acceptance, runs the repo verify command, and opens a **READY** PR against base. See [references/agent-prompts.md](references/agent-prompts.md).
6. **Wait, then find the PR.** Block on `herdr wait agent-status <impl-pane> --status idle --timeout <ms>`. Then get the PR deterministically: `gh pr list --head feature/<slug> --json number,url,state` — never scrape the pane. If no PR exists and the agent is idle/blocked/errored, read the pane and escalate to the operator; do not loop.
7. **Review.** Deliver the review prompt (same file-based method) for that PR in the same worktree. The reviewer uses `deep-code-review` and posts findings as a PR comment ending in `VERDICT: LGTM` or `VERDICT: BLOCKING`. **The verdict comment is the only gate** — do not use `gh pr review --approve`: both agents authenticate as the same GitHub user, so GitHub rejects self-approval.
8. **Loop.** Read only the verdict line from the PR (`read pr://<N>`):
   - `BLOCKING` or unresolved actionable items → send the **same implementer instance** a fix prompt: address every reviewer finding *and* any other GitHub bot/CI review on the PR, push with `--force-with-lease`, reply on the PR. Then send the **same reviewer instance** a re-review prompt — it re-reads the shared worktree, which already holds the fixes (no pull/reset). Repeat, capped at 3 cycles.
   - `LGTM` with no unresolved items → proceed to the docs pass.
9. **Docs.** Once implemented and reviewed, send the **same implementer instance** a docs prompt: update any docs the change requires (README, guides, usage docs, code comments, changelog) and push. On a doc-only change, have the **same reviewer instance** do a light re-check that docs match behavior — a doc-only change does not need a full deep review. If nothing needs updating, the implementer says so and you proceed.
10. **Merge.** Check `gh pr view <N> --json state,mergeable,mergeStateStatus`. If it is not `CLEAN` (e.g. `BEHIND`/`DIRTY` because a sibling issue merged first), send the implementer a rebase prompt (`git fetch && git rebase origin/<base>`, resolve, `--force-with-lease`) and re-check. Merge only when open/`MERGEABLE`/`CLEAN`: `gh pr merge <N> --squash` (no `--delete-branch`; the branch is checked out in the worktree).
11. **Teardown.** Send `/exit` to both panes (`agent send` + Enter), wait for each omp process to finish saving memory and exit (see cleanup in the CLI reference — it can take a while), then remove the panes and tab, remove the worktree, and delete the branch.

## Concurrency

Run at most **2 issues concurrently** (up to 4 agents), and only while quota headroom allows. Each issue is an independent tab. Honor `Blocked by`: do not dispatch an issue until the issue(s) it depends on have merged. When you would exceed the cap, queue the next issue and start it when a slot frees. Never let agent count or "how much I can finish" drive design — dispatch or queue, then end the turn on a blocking wait.

## Quota headroom (hard limit: keep 25% free)

Subscriptions are shared with other work, so **always leave 20–25% of every window available.** Treat a limit as unusable when `amount.usedFraction ≥ 0.75` on any binding window (`5h`, `7d`, …) for the account behind a model you want to use.

- Before assigning/using a model, run `omp usage --json` and check the windows for that model's provider. `≥ 0.75` used on any window → do not dispatch that model; pick another family or wait.
- Providers that report no window (listed under `accountsWithoutUsage`, or every limit `status: unknown`) can't be measured — proceed with them but flag "unmeasured quota" to the operator and rely on runtime quota errors to stop.
- If a model in flight crosses `0.75`, let the current turn finish, then park that agent at the turn boundary (do not `/exit` — you resume it later by sending its next prompt) and self-schedule resumption at the window's `resetsAt`.
- No idle spinning: compute the wait from `window.resetsAt`, arm a detached self-wake addressed to your `orch` label, and end your turn. See [references/lifecycle-and-quota.md](references/lifecycle-and-quota.md).

## Anti-polling discipline

Never loop `agent list`/`pane read` to watch progress. Use herdr's blocking waits and self-scheduling:

- Wait for an agent to finish its current turn: `herdr wait agent-status <pane> --status idle --timeout <ms>` (single blocking call). On timeout, take one `herdr agent get <pane>` snapshot — `blocked` or `error` means it needs help, so read the pane and escalate rather than re-waiting.
- Wait for full exit after `/exit`: see the cleanup recipe.
- Long time-based waits (quota reset): detached self-wake, then end the turn.

## Naming for mobile (Moshi)

You review from a phone, so keep labels short and issue-identifying:

- Tab label: `<n> <slug>` ≤ ~18 chars (e.g. `12 auth-login`).
- Implementer agent label `I<n>`, reviewer `R<n>` (e.g. `I12`, `R12`).
- PR title comes from the implementer per the repo's commit conventions.

## Reference selection

- [references/herdr-omp-cli.md](references/herdr-omp-cli.md) — verified herdr 0.7.1 + omp 16.3.6 commands: id formats, tab/agent/pane/wait/worktree, the `--config` model-overlay recipe, `omp usage --json` shape, interactive-omp drive/observe, and the teardown recipe.
- [references/agent-prompts.md](references/agent-prompts.md) — implementer, reviewer, fix, re-review, and docs prompt skeletons plus the verdict format.
- [references/lifecycle-and-quota.md](references/lifecycle-and-quota.md) — the full per-issue state machine, concurrency queueing, the 25%-headroom quota gate, and the detached self-wake scheduling pattern.

## Output contract

Each turn, report only operational state (redact secrets — account emails/ids, tokens, keys):

- issues in flight: tab, worktree, impl/rev models + families, PR number;
- what you dispatched or waited on this turn;
- verdict + unresolved items + fix-cycle count per PR;
- merges done or skipped, with mergeability evidence;
- quota state when it gated a decision (window, % used, reset time), plus any self-wake armed;
- blockers or operator decisions needed.
