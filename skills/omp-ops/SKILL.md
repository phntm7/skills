---
name: omp-ops
description: >
  Use when configuring Oh My Pi (`omp`) settings, model providers, and credentials, running
  headless or non-interactive sessions, delegating via subagents and hub, resolving internal
  URLs, or controlling cost-saving handoffs (Prewalk, Plan-yolo).
---

# OMP Ops

Operate Oh My Pi (`omp`) safely as a terminal AI coding agent CLI: configure settings, manage model providers and credentials, run headless non-interactive sessions (e.g. external reviews), delegate across subagents, supervise long-running processes via `hub`, resolve internal `scheme://` URLs, and control model handoffs.

## What OMP Is

OMP is a high-performance terminal AI coding agent harness with a native Rust core, multi-agent coordination, LSP/DAP integration, virtual filesystem protocols, and automated context compaction.

## Primary Entry Points

| Entry Point | Command Form | Best For |
|---|---|---|
| **Plain Print** | `omp -p '<prompt>'` | Quick one-shot plain text answer directly to stdout. |
| **Structured JSON** | `omp -p '<prompt>' --mode json` | Headless automation; emits session header (if persisted) then events. Parse `message_end` for final output. |
| **ACP Server** | `omp acp` | Standard Agent Client Protocol server over stdio. |
| **RPC Mode** | `omp --mode rpc` / `--mode rpc-ui` | Long-lived programmatic driver / RPC with extension UI frames. |
| **Interactive TUI** | `omp` | Full interactive terminal interface. |

Common CLI flags:
- `-c, --continue`: Resume the active or most recent session in the current terminal split.
- `-r, --resume <id>`: Resume an explicit session by ID prefix or path.
- `--cwd <path>`: Set working directory (defaults to process cwd).
- `--add-dir <path>`: Add extra workspace root (repeatable).
- `--model <provider>/<model>`: Select concrete model.
- `--approval-mode <always-ask|write|yolo>`: Override tool execution permissions.

## Inviolable Operating Rules

1. **Verify active agent root first**: Run `omp config path` before editing configuration files. Global settings live in that directory (`config.yml`, `models.yml`).
2. **Use exact model selectors**: Always pass `<provider-id>/<model-id>` in automation (e.g. `openai/gpt-5.6`, `novita/minimax/minimax-m3`).
3. **Use native internal URLs and virtual devices**: When inspecting subagent outputs, transcripts, spilled buffers, GitHub PR diffs, or virtual tools, use `agent://`, `history://`, `artifact://`, `pr://`, `vault://`, or `xd://` instead of shell hacks or file scraping.
4. **Never leak secrets in transcripts**: Set `apiKey: ENV_VAR_NAME` or `apiKey: "!command"` in `models.yml`. Never print, log, or commit actual Bearer tokens, cookies, or private keys.
5. **Honor config precedence**: Defaults $\to$ Global (`~/.omp/agent/config.yml`) $\to$ Project (`<cwd>/.omp/config.yml`) $\to$ `--config` overlays $\to$ CLI runtime flags.

## Reference Selection

Load the dedicated reference file for detailed workflows and schemas:

- **Config, models, credentials, and auth**: Read [references/config-and-models.md](references/config-and-models.md) for `models.yml` syntax, the 7-tier credential resolution order, model roles, `omp models`, `omp bench`, `auth-broker`, and `auth-gateway`.
- **Headless runs, reviews, and session lifecycle**: Read [references/runs-and-sessions.md](references/runs-and-sessions.md) for headless JSON parsing, automated code-review recipes, multi-root setups, `/fresh` vs `/clear` vs `/drop`, `/tree` vs `/branch`, and `/shake` vs `/handoff`.
- **Subagents, delegation, and hub supervision**: Read [references/subagents-and-hub.md](references/subagents-and-hub.md) for `task` batch schemas, worktree isolation, custom `.omp/agents/*.md`, and `hub` peer messaging and process daemons.
- **Internal URLs and virtual devices**: Read [references/internal-urls-and-devices.md](references/internal-urls-and-devices.md) for `agent://`, `history://`, `artifact://`, `local://`, `pr://`, `ssh://`, `vault://`, and `xd://` tool invocation.
- **Workflow controls and power features**: Read [references/workflow-controls.md](references/workflow-controls.md) for Prewalk, Plan-yolo, magic keywords (`ultrathink`, `orchestrate`, `workflowz`), approval modes, and the Advisor watchdog.

## Documentation & Sources

- **Official Site & Docs**: [omp.sh](https://omp.sh/) | [omp.sh/docs](https://omp.sh/docs)
- **Unofficial Documentation**: [nibblebot.github.io/oh-my-pi](https://nibblebot.github.io/oh-my-pi/)
- **Upstream Repository**: [github.com/can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)
