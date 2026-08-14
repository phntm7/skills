# claude + codex + pi CLI reference

Verified against **claude 2.1.228**, **codex-cli 0.147.0**, and **pi 0.84.1** (flags checked live; the codex model/effort combination `gpt-5.6-luna` + `max` verified end-to-end). If versions differ, confirm with `--help`.

Both implementer and reviewer agents run as **interactive panes** (via `herdr agent start`) in **yolo mode** — no sandboxes, no approval prompts. Sandboxes caused constant breakage (blocked writes, blocked `gh`, stalled approvals); the operator's accepted tradeoff is: the worktree is not a security boundary — the protections are the reviewer gate, the oid-pinned merge gate, and secret discipline in the spawn prompts. Re-review is simply another `herdr agent prompt` to the same pane: no session-id capture, no resume machinery.

## claude (implementer or reviewer panes; the orchestrator itself)

### Interactive launch (inside a herdr pane, via `agent start --kind claude`)

```bash
claude --model <claude-opus-5|claude-fable-5> --effort <low|medium|high|xhigh|max> \
  --permission-mode bypassPermissions
```

- `--model` takes an alias (`opus`, `fable`) or full id (`claude-opus-5`, `claude-fable-5`). Prefer full ids in dispatch — aliases can drift across releases.
- `--effort` maps 1:1 to the benchmark's reasoning-effort axis: `low, medium, high, xhigh, max`. A reviewer pane gets its own `--effort` per the matrix, independent of the orchestrator's session.
- `--permission-mode bypassPermissions` is claude's yolo mode — it keeps an unattended agent from stalling on tool-approval prompts. Use it for implementer and reviewer panes alike.
- Family pinning is free: Claude Code subagents inherit the parent session's model, so an implementer's fan-out stays on its own family with no overlay mechanism. Tell claude implementers to fan out to subagents for larger tasks with independent chunks.
- A claude reviewer pane launches the same way, with the reviewer prompt from [agent-prompts.md](agent-prompts.md); it posts PR comments itself with `gh`.

### Headless (scripting fallback only)

```bash
claude -p "<prompt>" --model claude-opus-5 --effort high --permission-mode bypassPermissions
claude -p --continue "<follow-up>"       # or: --resume <session-id> / --session-id <uuid>
```

For one-shot scripting needs only — **never for reviews**; reviewers run as visible panes.

## codex (implementer or reviewer panes)

### Interactive launch (inside a herdr pane, via `agent start --kind codex`)

```bash
codex -m <gpt-5.6-sol|gpt-5.6-luna> -c model_reasoning_effort="<effort>" \
  --dangerously-bypass-approvals-and-sandbox
```

- Effort values: `low, medium, high, xhigh, max` (`max` is GPT-5.6-only; verified working). Remember the hard rules: luna only at `max`; sol never below `medium` in practice.
- `--dangerously-bypass-approvals-and-sandbox` is codex's yolo mode: no sandbox, no approval prompts. Do **not** use `--sandbox` modes (`workspace-write`, `read-only`) — the sandbox breaks tooling constantly (blocked temp files, blocked `gh`, blocked package managers) and is why this skill abandoned it.
- `-C <dir>` sets the working directory if the pane's cwd isn't already the worktree.
- Codex has no cross-family subagent fan-out; codex implementers work single-agent (sol is step-efficient, this is fine).
- A codex reviewer pane launches the same way, with the reviewer prompt; since it is unsandboxed it posts PR comments itself with `gh pr comment --body-file`. The reviewer prompt forbids code changes — discipline is contractual, backed by the oid-pinned merge gate.

## pi (implementer or reviewer panes — the budget workhorse families)

### Interactive launch (inside a herdr pane, via `agent start --kind pi`)

```bash
pi --model opencode-go/deepseek-v4-flash:max -a    # default bulk implementer / reviewer
pi --model opencode-go/deepseek-v4-pro:max -a      # reserve: smaller Go allowance, possible quality gain
pi --model xai/grok-4.6:high -a                    # scarce weekly pool; :high documents the vendor default
# z.ai lane parked — Coding Plan auto-routes GLM-5.2/5.1 to GLM-5.3 (429s as of 2026-08); do not dispatch zai/… until stable
```

- **Only these combos are approved.** DeepSeek supports `high|max`; use `max`. Grok supports `low|medium|high|xhigh`, but pi 0.84.1 cannot transmit its effort, so `:high` is documentary and the request uses xAI's current default `high`; `:xhigh` would not escalate it. **z.ai remains parked**: its Coding Plan routes GLM-5.2/5.1 to GLM-5.3, which rate-limited operator tests within minutes. Re-add it only after a clean retest.
- pi has **no approval or sandbox system at all** — every tool call (read, bash, edit, write) runs unprompted; it is inherently yolo. The only startup gate is project-local file trust: pass `-a` (`--approve`) so a fresh worktree pane never stalls on the trust dialog.
- Provider ↔ subscription ↔ codexbar mapping: `opencode-go/…` → OpenCode Go sub → `codexbar --provider opencodego`; `zai/…` → z.ai sub → `--provider zai`; `xai/…` → Supergrok shared weekly pool → `--provider grok`.
- No subagent fan-out; pi implementers work single-agent, like codex.
- Exit for teardown: `/quit` (pi has no `/exit`).
- Headless fallback (scripting only, never reviews): `pi -p "<prompt>"`; `pi -c "<follow-up>"` continues the previous session.

## codexbar (the quota gate)

```bash
codexbar usage --json --provider <codex|claude|opencodego|zai|grok>
```

One provider per call. Measured latencies (codexbar 0.49.4): opencodego ~0.3 s (local), grok ~1 s, zai ~2 s, **claude ~17 s** (claude.ai API), **codex ~20 s** (OpenAI web dashboard). Check the two slow ones as parallel background jobs:

```bash
codexbar usage --json --provider claude >"$TMP/claude.json" &
codexbar usage --json --provider codex  >"$TMP/codex.json"  &
wait
```

- **Never use `--provider all`/`both` for gating** — 30 s+ and the output includes every disabled provider as an error object.
- No cache flag: reuse this turn's results instead of re-fetching; re-check only the family you are about to spend.
- Verified shape — an array with one element per provider; up to three rate windows plus optional extras:

```jsonc
[{
  "provider": "opencodego", "source": "local",
  "usage": {
    "primary":   { "windowMinutes": 300,   "usedPercent": 11.1, "resetsAt": "2026-08-06T16:23:36Z" },
    "secondary": { "windowMinutes": 10080, "usedPercent": 4.9, "resetsAt": "…" },
    "tertiary":  { "windowMinutes": 43200, "usedPercent": 2.5, "resetsAt": "…" }  // windows may be null
  },
  "pace": { /* optional per-window projections; useful color, not the gate */ }
}]
// unmeasurable provider: {"provider": "…", "error": {"kind": "provider", "message": "…"}}
```

- Remaining % = `100 − usedPercent`. Normally classify by `windowMinutes`: `≤ 300` → the 20% short-window gate, larger → the 15% weekly/monthly gate. Grok's primary window may omit `windowMinutes`; treat it as weekly. See [lifecycle-and-quota.md](lifecycle-and-quota.md).
- `resetsAt` is ISO-8601 — compute self-wake seconds directly from it; no humanized-string parsing.
- The JSON carries account emails/ids — never echo it raw into reports; extract windows only.
- A provider whose element has `error` can't be measured: proceed, tell the operator its quota is unmeasured, and let runtime quota errors be the stop signal.

### cclimits (fallback when codexbar is unavailable)

```bash
cclimits --json --claude --codex            # live check
cclimits --json --claude --codex --cached   # cached ≤60s; --cache-ttl <s> to tune
```

Verified output shape:

```jsonc
{
  "claude": {
    "status": "ok",
    "five_hour": { "used": "8.0%", "remaining": "92.0%", "resets_in": "1h 47m" },
    "seven_day": { "used": "40.0%", "remaining": "60.0%", "resets_in": "2d 7h" }
  },
  "codex": {
    "status": "ok", "auth": "OAuth (ChatGPT)", "plan": "prolite",
    "secondary_window": { "used": "43%", "remaining": "57%", "window": "7d", "resets_in": "5d 0h" }
  }
}
```

- Credentials are auto-discovered (macOS Keychain for claude; `~/.codex/auth.json` for codex) — no setup in-session.
- Same gate rules as codexbar: gate on **whatever windows cclimits actually reports**; never assume fixed key names or window sets.
- `used`/`remaining`/`resets_in` are humanized strings — parse them (`"2d 7h"` → seconds) when computing a self-wake delay.
- cclimits does **not** cover opencode-go or grok: under this fallback, pi-side deepseek and grok quotas are unmeasured (z.ai is available via `--zai` if configured). A provider with `status` ≠ `ok` is likewise unmeasured — proceed, tell the operator, and let runtime quota errors be the stop signal.
