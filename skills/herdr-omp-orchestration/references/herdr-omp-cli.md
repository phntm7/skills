# herdr + omp CLI reference

Verified against **herdr 0.7.1** and **omp 16.3.6**. Commands and JSON shapes below were observed live; if your versions differ, confirm with `--help` before relying on a flag.

## herdr id formats (do not guess)

herdr 0.7.1 uses compact live ids that **compact when things close** — always re-read them from the latest `list`/`create` JSON, never reuse a remembered id:

- workspace: `w2`, `w9`
- tab: `w2:t1` (`<ws>:t<n>`)
- pane: `w2:p2` (`<ws>:p<n>`)

Most `herdr` subcommands print JSON on success (`{"id":...,"result":{...}}`). `pane read`/`agent read` print text. `tab create` prints JSON but rejects `--json` (it is implied). `worktree list/create` and `pane list` accept `--json`.

## Find yourself

```bash
herdr pane list          # result.panes[]: {pane_id, tab_id, workspace_id, agent, agent_status, cwd, focused, terminal_id}
```

Your pane is the one with `"focused":true`. Its `workspace_id` is where all issue tabs go. Rename yourself once — `herdr agent rename <your-pane> "orch"` — and self-address by the `orch` label thereafter, since pane ids compact when panes close.

```bash
herdr workspace list     # result.workspaces[]: {workspace_id, label, number, active_tab_id, tab_count, pane_count, agent_status}
```

## Worktree (use plain git, not `herdr worktree create`)

`herdr worktree create` spins up its **own new workspace** (label = branch, checkout under `~/.herdr/worktrees/<repo>/<branch>/`). That breaks the "one tab per issue in the orchestrator's workspace" layout, so create the worktree with git and open tabs yourself:

```bash
cd <repo-root>
git worktree add <wt-path> -b feature/<slug> <base>     # base is usually main
```

Choose `<wt-path>` outside the repo (e.g. `~/.herdr/worktrees/<repo>/<slug>` or `../<repo>-wt/<slug>`). Teardown:

```bash
git worktree remove <wt-path> --force
git branch -D feature/<slug>        # only after the PR is merged
```

### Share build artifacts (so verify doesn't reinstall)

A fresh `git worktree` has no `node_modules`, `target`, `.venv`, or built native addons, so the agent's verify step would reinstall/rebuild from scratch. Symlink the heavy outputs from the main checkout before launching agents (adapt to the stack; skip what doesn't apply):

```bash
MAIN=<repo-root>; WT=<wt-path>
ln -snf "$MAIN/node_modules" "$WT/node_modules"   # JS
ln -snf "$MAIN/target"       "$WT/target"         # Rust
ln -snf "$MAIN/.venv"        "$WT/.venv"          # Python
```

Link only build outputs — never a whole tracked directory the PR might modify.

## Tab per issue

```bash
herdr tab create --workspace <ws> --cwd <wt-path> --label "<short>" --no-focus
# result.tab.tab_id, result.root_pane.pane_id
herdr tab rename <tab-id> "<short>"
herdr tab close <tab-id>
herdr tab list --workspace <ws>     # result.tabs[]
```

A freshly created tab already has one **root pane** (a shell at `--cwd`). Reuse it for the implementer; split for the reviewer.

## Launch interactive omp agents in panes

omp runs **interactively** (a TUI) so the operator can watch. Two ways to place an agent:

```bash
# Implementer: reuse the tab's root pane
herdr pane run <root-pane> "omp --model <impl-model> --config <impl-overlay> --cwd <wt-path>"
herdr agent rename <root-pane> "I<n>"

# Reviewer: split the same tab to the right
herdr agent start "R<n>" --tab <tab-id> --split right --cwd <wt-path> --no-focus -- \
  omp --model <rev-model> --config <rev-overlay>
# result.agent.pane_id, result.agent.name, result.agent.tab_id
```

`herdr agent start <name> --tab <id> [--split right|down] --cwd <path> [--env K=V] --no-focus -- <argv...>` starts `<argv>` in a new pane of that tab and returns `result.agent.pane_id`. Without `--split` it still creates a new pane; with `--split right` it creates the side-by-side sibling. herdr auto-detects the omp process as an agent; `agent rename` sets the label shown on mobile.

## The model overlay (enforces opposite-model review)

omp's `task` subagent uses `modelRoles.task`; `--model` alone does **not** change it. Since implementer and reviewer share one worktree, project `.omp/config.yml` cannot differentiate them — use a **per-process `--config` overlay** (highest precedence except runtime flags, never persisted). Write one overlay per agent before launch:

```bash
cat > <impl-overlay> <<'YAML'
modelRoles:
  default: <impl-model>
  task: <impl-model>
  slow: <impl-model>
  plan: <impl-model>
defaultThinkingLevel: high
tools:
  approvalMode: yolo
YAML
```

Do the same with `<rev-model>` for the reviewer's overlay. This keeps every subagent (including `deep-code-review`'s fan-out) on that agent's own family, and lets the implementer fan out to subagents for larger tasks without leaving the subscription. Selectors are exact `<provider>/<model>` (model ids may contain `/`, e.g. `cline-pass/cline-pass/glm-5.2`). Use **subscription** providers only — `openai-codex/gpt-5.5`, never the `openai/gpt-5.5` API key. Put overlays in a temp dir; delete them at teardown.

## Drive and observe an agent

```bash
# Send a prompt to an interactive omp pane, then submit it:
herdr agent send <pane> "<full prompt text>"     # writes literal text, no Enter
herdr pane send-keys <pane> Enter                # submit

# Read what an agent is doing:
herdr agent read <pane> --source recent --lines 60      # or: recent-unwrapped, visible
```

Prefer **file-based delivery** for real task prompts: write the prompt to a scratch file and send a one-liner — `herdr agent send <pane> "read <file> and follow it exactly"` then `send-keys Enter`. It sidesteps multi-line paste, shell-quoting, and escaping issues in the TUI; reserve inline `agent send` for short instructions. Before the first prompt, wait until omp has booted and shows its input box (`herdr wait output <pane> --match "<omp-ready marker>" --timeout <ms>`), or early keystrokes are lost. Use `pane run` only for launching omp itself (text-plus-Enter in one shot).

## Wait without polling

```bash
# Block until an agent finishes its current turn (returns immediately when idle):
herdr wait agent-status <pane> --status idle --timeout <ms>
# statuses: idle | working | blocked | done | unknown  (done = finished but unviewed)

# Block until specific text appears (e.g. a shell prompt after exit):
herdr wait output <pane> --match "<text>" [--regex] [--source recent] --timeout <ms>
```

Never loop `agent list` / `pane read` to watch progress; use these blocking waits (single calls) and, for long time-based waits, self-scheduling (see lifecycle-and-quota.md).

## omp usage (the quota gate)

```bash
omp usage --json                 # all providers
omp usage --json --provider <id> # one provider
omp usage --redact               # human view, safe for screenshots
```

`--json` shape:

```jsonc
{
  "generatedAt": 1783249720450,
  "reports": [
    {
      "provider": "openai-codex",
      "fetchedAt": 1783249478447,
      "limits": [
        {
          "id": "openai-codex:primary",
          "label": "5 hours",
          "scope": { "provider": "openai-codex", "accountId": "f3*", "tier": "prolite", "windowId": "5h", "shared": true },
          "window": { "id": "5h", "label": "5 hours", "durationMs": 18000000, "resetsAt": 1783256549000 },
          "amount": { "used": 4, "limit": 100, "remaining": 96, "usedFraction": 0.04, "remainingFraction": 0.96, "unit": "percent" },
          "status": "ok"          // ok | warning (>=0.80) | exhausted (>=1.0) | unknown
        }
      ]
    }
  ],
  "accountsWithoutUsage": [],
  "capacity": []
}
```

For quota decisions use `amount.usedFraction` and `window.resetsAt` (epoch ms). Your headroom stop threshold is `usedFraction >= 0.75` (keep 25% free) — this is stricter than omp's own `warning` (0.80). Redact `scope.accountId` / emails in any report you print.

## Teardown recipe (per issue, after merge)

```bash
# 1. Ask both agents to exit (they save memory on /exit — can take a while):
herdr agent send <impl-pane> "/exit"; herdr pane send-keys <impl-pane> Enter
herdr agent send <rev-pane>  "/exit"; herdr pane send-keys <rev-pane>  Enter

# 2. Wait for each omp process to actually exit. It is done when herdr no longer
#    detects an agent on that pane (the pane returns to a shell). Use a bounded
#    output wait for your shell prompt, then confirm via a single agent-get:
herdr wait output <impl-pane> --match "<your-shell-prompt>" --regex --timeout 180000 || true
herdr agent get <impl-pane>        # agent should be absent/undetected

# 3. Remove panes and tab, worktree, branch, and the temp overlays:
herdr pane close <rev-pane>
herdr tab close <tab-id>           # closes the tab and its remaining root pane
git -C <repo-root> worktree remove <wt-path> --force
git -C <repo-root> branch -D feature/<slug>
rm -f <impl-overlay> <rev-overlay>
```

If you used `herdr worktree create` anyway, tear it down with `herdr worktree remove --workspace <ws> --force` (this also closes that workspace).

## Notifications (optional)

```bash
herdr notification show "<title>" --body "<text>" --sound done
```

Use sparingly to flag operator-blocking states (quota wait armed, PR needs a human decision).
