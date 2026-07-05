# Lifecycle, concurrency, quota headroom, and self-scheduling

This is the orchestrator's state machine and the two disciplines that keep it correct: never overspend a subscription, and never busy-poll. Command detail lives in [herdr-omp-cli.md](herdr-omp-cli.md); prompts in [agent-prompts.md](agent-prompts.md).

## Per-issue state machine

Each issue moves through fixed states. Between states you either block on a herdr wait or end your turn on a self-wake — never spin.

```mermaid
graph TD
  Q[queued] --> A[assign models + check quota]
  A -->|headroom ok| S[worktree + tab + 2 agents]
  A -->|no headroom| W[self-wake at resetsAt]
  W --> A
  S --> IMPL[implementer: build + verify + open PR]
  IMPL --> REV[reviewer: deep-code-review + verdict]
  REV -->|BLOCKING| FIX[same implementer: fix + push + reply]
  FIX --> RER[same reviewer: re-review]
  RER -->|BLOCKING, cycles<3| FIX
  RER -->|BLOCKING, cycles=3| ESC[surface to operator]
  REV -->|LGTM| DOCS[same implementer: docs pass if needed]
  RER -->|LGTM| DOCS
  DOCS --> MERGE[verify mergeable + squash merge]
  MERGE --> TD[/exit both, wait exit, remove panes/tab/worktree/branch]
  TD --> DONE[done]
```

- **Reuse the two agents.** The implementer instance handles the first build and every fix cycle; the reviewer instance handles the first review and every re-review. You resume them by sending a new prompt to the same pane — never launch a third omp for an issue.
- **Gate on the verdict, not on finding text.** Read only the `VERDICT:` line and whether unresolved actionable items remain. The PR comment is the implementer↔reviewer handoff; do not relay findings yourself.
- **Fix-cycle cap = 3.** After the 3rd BLOCKING verdict, escalate to the operator and leave the agents alive.

## Concurrency

- At most **2 issues in flight** (≤ 4 agents), and only while quota headroom allows.
- Each issue is its own tab in your workspace. When both slots are full, queue the rest.
- Free a slot only after full teardown (merge + panes/tab/worktree/branch removed).
- Prefer to advance one gating step at a time: block on the agent you need next; when that wait returns, take a single `herdr agent list` snapshot to catch the other issue's progress, act, then block again. That is event-driven, not polling.

## Quota headroom — keep 25% free

Subscriptions are shared with other work. **Never let a window fall below 20–25% remaining because of this orchestrator.** Concretely: a model is unusable when `amount.usedFraction >= 0.75` on any of its binding windows (`5h`, `7d`, monthly…).

Gate at three points:

1. **Before assigning a model to an issue.** Run `omp usage --json`, match the candidate model's `provider` to its report, and check every window. If any is `>= 0.75` used, pick a different family (still opposite to the paired agent) or, if none qualifies, queue the issue and self-wake at the soonest relevant `resetsAt`. If the provider reports no window (it appears under `accountsWithoutUsage`, or every limit is `status: unknown`), you cannot measure it — proceed but tell the operator this model's quota is unmeasured, and let a runtime quota error be the stop signal.
2. **Before each fix/re-review dispatch.** Re-check the two models already assigned to that issue. If one has crossed `0.75`, do not send its next turn; wind it down (see below) and self-wake at `resetsAt`.
3. **When a run fails on a provider quota error.** Treat it as exhausted, read `omp usage --json` for the real `resetsAt`, and self-wake.

Graceful wind-down of an in-flight agent: let its current turn finish (block on `herdr wait agent-status <pane> --status idle`), then leave it parked (do not `/exit` — you will resume it after reset by sending its next prompt). Record which issue/PR and which model is parked and why.

Never print raw account identifiers from `omp usage`; report `provider`, window label, `% used`, and reset time only.

## Self-scheduling (no busy-wait for long waits)

herdr and omp have **no native scheduler** — only `herdr wait` (blocking) and `herdr notification`. For short waits (an agent finishing a turn), block on `herdr wait agent-status`. For long waits (a quota window that resets in hours), do **not** hold a blocking call and do **not** poll. Arm a detached self-wake that re-prompts your own orchestrator pane at the reset time, then end your turn:

```bash
# RESETS_AT_MS is epoch ms from window.resetsAt. Address yourself by the "orch"
# label set in preflight — pane ids compact, the label is stable.
secs=$(( (RESETS_AT_MS - $(date +%s)000) / 1000 ))
[ "$secs" -lt 30 ] && secs=30
nohup sh -c "sleep $secs; \
  herdr agent send orch 'RESUME: quota window reset — re-run omp usage --json and resume dispatch for the parked issues.'; \
  herdr pane send-keys orch Enter" >/dev/null 2>&1 &
```

The detached process outlives your turn; when it fires it injects a prompt into your own omp TUI (via the stable `orch` label), which wakes you to re-check quota and resume. After arming it, report what you parked and the wake time, then end the turn. Optionally `herdr notification show "quota wait" --body "resumes in ${secs}s" --sound done` so the operator knows.

If several windows are blocking different issues, arm one self-wake at the **soonest** relevant `resetsAt`; on wake, re-evaluate all parked issues.

## Turn checklist

Before ending a turn, confirm:

- every in-flight agent is either being waited on (blocking) or parked with a self-wake armed;
- no issue is silently stalled;
- the output-contract state (SKILL.md) is reported with secrets redacted;
- nothing is waiting on a busy-poll loop.
