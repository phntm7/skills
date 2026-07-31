# claude + codex CLI reference

Verified against **claude 2.1.220** and **codex-cli 0.146.0** (flags checked live; the codex model/effort combination `gpt-5.6-luna` + `max` verified end-to-end). If versions differ, confirm with `--help`.

## claude (implementer panes; the orchestrator itself)

### Interactive launch (inside a herdr pane, via `agent start --kind claude`)

```bash
claude --model <claude-opus-5|claude-fable-5> --effort <low|medium|high|xhigh|max> \
  --permission-mode bypassPermissions
```

- `--model` takes an alias (`opus`, `fable`) or full id (`claude-opus-5`, `claude-fable-5`). Prefer full ids in dispatch — aliases can drift across releases.
- `--effort` maps 1:1 to the benchmark's reasoning-effort axis: `low, medium, high, xhigh, max`.
- `--permission-mode bypassPermissions` keeps an unattended implementer from stalling on tool-approval prompts (the worktree is disposable; the reviewer gate catches bad changes). Do not depend on the operator's global settings.
- Family pinning is free: Claude Code subagents inherit the parent session's model, so an implementer's fan-out stays on its own family with no overlay mechanism. Tell claude implementers to fan out to subagents for larger tasks with independent chunks.

### Claude-side reviewer — a subagent, not a pane

The orchestrator is itself a Claude Code session: spawn the reviewer with the **Agent tool** (`model: "opus"` per the matrix; `fable` for the hardest reviews), running the review prompt from [agent-prompts.md](agent-prompts.md). Continue the **same instance** for re-reviews via **SendMessage** — do not spawn a fresh reviewer per cycle. Run it in the background so you can keep orchestrating; its findings land as a PR comment, so you only read the verdict.

### Headless (fallback / scripting)

```bash
claude -p "<prompt>" --model claude-opus-5 --effort high --permission-mode bypassPermissions
claude -p --continue "<follow-up>"       # or: --resume <session-id> / --session-id <uuid>
```

Useful when a claude one-shot is needed outside the subagent mechanism (e.g. from a script). `--output-format json` gives machine-readable results.

## codex (implementer panes; headless reviewer)

### Interactive launch (inside a herdr pane, via `agent start --kind codex`)

```bash
codex -m <gpt-5.6-sol|gpt-5.6-luna> -c model_reasoning_effort="<effort>" \
  --sandbox workspace-write -a never
```

- Effort values: `low, medium, high, xhigh, max` (`max` is GPT-5.6-only; verified working). Remember the hard rules: luna only at `max`; sol never below `medium` in practice.
- `--sandbox workspace-write` allows edits in the worktree; `-a never` (approval policy) prevents stalls on approval prompts. Avoid `--dangerously-bypass-approvals-and-sandbox` — workspace-write is enough for implementation.
- `-C <dir>` sets the working directory if the pane's cwd isn't already the worktree.
- Codex has no cross-family subagent fan-out; codex implementers work single-agent (sol is step-efficient, this is fine).

### Headless reviewer (`codex exec`, read-only)

```bash
codex exec -m gpt-5.6-sol -c model_reasoning_effort="xhigh" \
  --sandbox read-only --skip-git-repo-check -C <wt-path> \
  "$(cat <review-prompt-file>)" 2>/dev/null
```

- `read-only` sandbox: the reviewer physically cannot mutate the shared worktree. It can still write the PR comment because `gh` calls the GitHub API — if the sandbox blocks network, have the reviewer print the full review to stdout and post the comment yourself verbatim (you are relaying bytes, not writing the review).
- `2>/dev/null` suppresses thinking tokens on stderr — but capture stderr to a file instead when you need the **session id** for resume (it appears in the startup banner): `2><stderr-file>`.
- Run it as a background Bash task; a review at `xhigh` can take 10–25 minutes.

### Re-review via resume

```bash
codex exec resume <SESSION_ID> "$(cat <re-review-prompt-file>)" 2>/dev/null
# or: codex exec resume --last "<prompt>"
```

- Prefer the explicit `SESSION_ID` (UUID from the first run's banner). `--last` picks the most recent recorded session — racy when two issues have codex sessions in flight.
- Do not repeat model/effort flags on resume; the session keeps its original configuration.

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
- Codex plans have **weekly limits only** (no 5h window) — cclimits may report it under a key like `secondary_window`; check every window key present, not fixed names.
- Gate rules (details in [lifecycle-and-quota.md](lifecycle-and-quota.md)): codex weekly `remaining ≤ 15%` → gated (unless reset ≤ ~12 h); claude 5h `remaining ≤ 20%` → gated (unless reset ≤ ~30 min).
- `used`/`remaining`/`resets_in` are humanized strings — parse them (`"2d 7h"` → seconds) when computing a self-wake delay.
- A provider with `status` ≠ `ok` can't be measured: proceed but tell the operator its quota is unmeasured, and let runtime quota errors be the stop signal.
