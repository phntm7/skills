# claude + codex CLI reference

Verified against **claude 2.1.220** and **codex-cli 0.146.0** (flags checked live; the codex model/effort combination `gpt-5.6-luna` + `max` verified end-to-end). If versions differ, confirm with `--help`.

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

## cclimits (the quota gate)

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
- The operator's codex plan has **weekly limits only** (no 5h window) — cclimits may report it under a key like `secondary_window`. Gate on **whatever windows cclimits actually reports** for each provider; never assume fixed key names or window sets.
- Gate rules (details in [lifecycle-and-quota.md](lifecycle-and-quota.md)): any codex window `remaining ≤ 15%` → gated (unless its reset is ≤ ~12 h away); claude 5h `remaining ≤ 20%` → gated (unless reset ≤ ~30 min).
- `used`/`remaining`/`resets_in` are humanized strings — parse them (`"2d 7h"` → seconds) when computing a self-wake delay.
- A provider with `status` ≠ `ok` can't be measured: proceed but tell the operator its quota is unmeasured, and let runtime quota errors be the stop signal.
