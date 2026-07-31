# herdr CLI reference (0.7.5)

Verified against **herdr 0.7.5**. Commands and flags below were checked live via `--help` and real invocations; JSON shapes marked "confirm on first use" were not exercised — read the actual output the first time and adapt. If your herdr version differs, confirm with `--help` before relying on a flag.

## Id formats (do not guess)

herdr uses compact live ids that **compact when things close** — always re-read them from the latest `list`/`create` JSON, never reuse a remembered id:

- workspace: `w2`, `w9`
- tab: `w2:t1` (`<ws>:t<n>`)
- pane: `w2:p2` (`<ws>:p<n>`)

Most subcommands print JSON (`{"id":...,"result":{...}}`); `pane read`/`agent read` print text. Agent subcommands accept either a pane id or the agent's label as `<TARGET>` — prefer labels (`orch`, `i12`), they survive id compaction.

## Find yourself

Your own pane id is in `$HERDR_PANE_ID` (herdr sets it in every pane's environment). Resolve it into a variable before use — never pass a possibly-empty `$HERDR_PANE_ID` to a command:

```bash
pane="${HERDR_PANE_ID:-$(herdr pane current | jq -r .result.pane.pane_id)}"   # confirm the jq path on first use
herdr agent rename "$pane" "orch"
```

Self-address by the `orch` label thereafter. Do **not** identify yourself via `"focused":true` in `pane list` — focus is UI-global and another client (or the operator's phone) can own it.

**Agent names must match `^[a-z][a-z0-9_-]{0,31}$`** — start with a lowercase letter, lowercase/digits/`-`/`_` only. `herdr agent start "I12" ...` fails with `invalid_agent_name`; use `i12`.

## Worktree workspaces (one per issue)

herdr models a worktree as its own **workspace**: `worktree create` makes the git worktree (checkout under `~/.herdr/worktrees/<repo>/<branch>/` by default) and opens it as a new workspace in one call.

```bash
# Create (from anywhere; --cwd points at the source repo):
herdr worktree create --cwd <repo-root> --branch feature/<slug> --base <ref> \
  --label "<n> <slug>" --no-focus --json
# Result includes the new workspace id — read it from the JSON (confirm shape on first use).
# --path <PATH> overrides the checkout location if needed.

# Inspect (keyed to a source repo; run with --cwd <repo-root> to scope it):
herdr worktree list --cwd <repo-root> --json
# result.worktrees[]: {branch, path, label, open_workspace_id, is_linked_worktree, is_prunable, ...}
# result.source: {repo_root, source_workspace_id, ...}

# Reopen a closed one:
herdr worktree open ...

# Teardown (removes the checkout AND closes its workspace):
herdr worktree remove --workspace <ws> --force
```

`worktree remove` does not delete the branch — after the PR is merged, also run `git -C <repo-root> branch -D feature/<slug>`.

### Worktree setup (env + deps, before launching the agent)

A fresh worktree is missing everything gitignored: env files and installed dependencies. Set both up right after `worktree create`, or the agent's verify step fails on missing config or spends its first minutes reinstalling blind.

```bash
MAIN=<repo-root>; WT=<wt-path>       # wt-path from worktree list/create JSON

# 1. Copy untracked env/config files (root; repeat for monorepo packages that
#    carry their own — read the repo docs / .env.example locations):
for f in .env .env.local .env.*.local; do
  [ -f "$MAIN/$f" ] && cp "$MAIN/$f" "$WT/$f"
done

# 2. Install dependencies with the repo's declared package manager:
#    pnpm install / npm ci / bun install / cargo fetch / uv sync / composer install ...
#    Global stores and caches make this fast.
```

Do **not** symlink `node_modules`/`target`/`.venv` from the main checkout: if the task changes dependencies, the install mutates the main checkout through the symlink and corrupts both trees.

## Find the workspace's pane, launch the implementer

The new workspace opens with a shell pane. Find it:

```bash
herdr pane list          # filter result.panes[] by workspace_id from worktree create
```

If the workspace has no pane at a shell (or you need another), create a tab in it: `herdr tab create --workspace <ws> --cwd <wt-path> --label "<short>" --no-focus` (also supports `--env K=V`).

Then start the agent **in that existing pane** — herdr runs the canonical executable, passes your extra args, and waits for interactive readiness (no ready-marker scraping):

```bash
herdr agent start "i<n>" --kind claude --pane <pane-id> --timeout 60000 -- \
  --model claude-opus-5 --effort high --permission-mode bypassPermissions

herdr agent start "i<n>" --kind codex --pane <pane-id> --timeout 60000 -- \
  -m gpt-5.6-sol -c model_reasoning_effort="high" --sandbox workspace-write -a never
```

- `--kind` supports `claude`, `codex` (among ~20 kinds); herdr detects the agent process and tracks its status.
- The pane must be sitting at an interactive shell prompt.
- Default readiness timeout 30000 ms, max 300000.
- See [agent-clis.md](agent-clis.md) for what the per-CLI args mean and why.
- If detection misbehaves, `herdr agent explain <target>` shows the detection state.

## Deliver prompts (no send-keys dance)

`agent prompt` submits text and can wait for the settled state in one call:

```bash
herdr agent prompt <target> "<text>" --wait --timeout <ms>
```

**Omit `--until`.** The default match is `idle|done|blocked` — exactly the settled states you want. An explicit `--until idle` matches *only* `idle`, so a turn that finishes as `done` (finished-but-unviewed) or stops at `blocked` (a question for you) would burn the whole timeout. After the wait returns, classify the state with `herdr agent get <target>`.

Semantics worth knowing: after submission from a non-working state, `--wait` requires an observed state change within 5000 ms, else it returns `agent_prompt_stalled` (the prompt likely didn't land — investigate with `agent read`, don't blindly resend). It does not track turns: if the agent was already working, the current turn's completion may match.

**File-based delivery for long prompts:** multi-line task briefs risk TUI paste/escaping issues. Write the full prompt to a scratch file and send a one-liner:

```bash
herdr agent prompt i12 "Read <prompt-file> and follow it exactly." --wait --timeout 3600000
```

## Wait and observe

```bash
# Wait on an already-working agent (single blocking call; never loop list/read):
herdr agent wait <target> --timeout <ms>       # default match: idle|done|blocked
# states: idle | working | blocked | done | unknown   (done = finished but unviewed)

# One snapshot after a timeout — blocked/error means it needs help:
herdr agent get <target>

# Read what an agent is doing (text output):
herdr agent read <target> --source recent --lines 60

# Wait for specific pane text (e.g. shell prompt after the agent exits):
herdr pane wait-output <pane-id> --match "<text>" --timeout <ms>
```

## Teardown recipe (per issue, after merge)

```bash
# 1. Exit the implementer CLI:
herdr agent prompt i<n> "/exit"        # claude
herdr agent prompt i<n> "/quit"        # codex   (if rejected, try Ctrl+D via: herdr pane send-keys <pane> C-d)

# 2. Wait for the pane to return to a shell, then CONFIRM the agent is gone
#    before any forced teardown — do not proceed on the wait alone:
herdr pane wait-output <pane-id> --match "<your-shell-prompt>" --timeout 120000 || true
herdr agent get i<n>                   # must be absent/undetected; if still present, escalate

# 3. Remove the worktree workspace and the branch:
herdr worktree remove --workspace <ws> --force
git -C <repo-root> branch -D feature/<slug>
```

## Notifications (optional)

```bash
herdr notification show "<title>" --body "<text>" --sound done
```

Use sparingly to flag operator-blocking states (quota wait armed, PR needs a human decision).
