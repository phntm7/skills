# Subagents, Peer Messaging, and Process Supervision

Verified against installed OMP 18.13.0 on 2026-10-27. Use `task` for delegation, `write agent://<id>` for peer messages, `proc://` for jobs/services, and `wait()` when no independent work remains. Agent Hub is the human-facing TUI (`Alt+A`), not a model-callable tool.

## 1. Delegation via `task`

With `task.batch` enabled (default), call with required shared `context` and per-agent `tasks[]`. With it disabled, pass one flat item; `context` and `tasks` are rejected. Children do not inherit conversation history; supply self-contained instructions. Ordinary children share the parent's `local://` root.

```json
{
  "context": "Inspect authentication and migration conventions. Do not change git state.",
  "tasks": [
    {
      "name": "AuthScout",
      "agent": "scout",
      "task": "Investigate token refresh in src/auth/ and report concrete risks without edits.",
      "solutionSpace": "Refresh race causes open; investigation only"
    },
    {
      "name": "MigrationCheck",
      "agent": "reviewer",
      "task": "Inspect db/migrations/ and report schema inconsistencies without edits.",
      "solutionSpace": "Check existing migrations against repository conventions",
      "outputSchema": {
        "type": "object",
        "properties": { "status": { "type": "string" } },
        "required": ["status"]
      },
      "schemaMode": "strict"
    }
  ]
}
```

Use agent names actually discovered in the current session; local definitions can override bundled names.

- `name`: Optional stable registry/message ID; use CamelCase, at most 32 characters, unique within a batch. Reused names may be suffixed; use the returned ID thereafter.
- `agent`: Agent definition name. Always choose explicitly for model-family-sensitive work. Ordinary task items do not accept a worker `model` override; route through the agent definition/role. The special `seance` agent has separate source/model fields.
- `task`: Required complete instructions.
- `solutionSpace`: Required advertised field describing what remains open about the problem/design; it feeds automatic effort classification, not the task's volume.
- `effort`: Conditional `"lo" | "med" | "hi"`, exposed only by `task.enableEffort: true` (default false). It overrides the tuned agent level, maps to the model's lowest/middle/highest supported level, and is clamped by `task.maxEffort`. Omit unless deliberately overriding; this Mac keeps the field off.
- `isolated`: Available only when `task.isolation.enabled` is true and plan mode is off. Opt-in per item; false/omitted shares the parent checkout.
- `outputSchema`: Per-item JSON Schema, ahead of agent `output` and inherited schema.
- `schemaMode`: `permissive` (default; may accept invalid output after retries) or `strict` (fails instead).

With `async.enabled=true`, ordinary task items become background jobs. An agent declaring `blocking: true` runs inline even in a mixed batch whose other items run asynchronously. Completion auto-delivers to the parent; inspect the full result at `agent://<returned-id>` and transcript at `history://<returned-id>`.

Bundled definitions include `task`, `scout`, `reviewer`, `security-reviewer`, `librarian`, and `sonic`; project/user/plugin definitions take precedence. Read the actual selected definition before relying on its tools, model, or role.

## 2. Isolation and Lifecycle

| Setting | Schema default | Purpose |
|---|---|---|
| `task.isolation.enabled` | `false` | Expose per-item `isolated`; does not isolate all spawns automatically. |
| `isolation.backend` | `auto` | Select backend with native fallback: `apfs`, `btrfs`, `zfs`, `reflink`, `overlayfs`, `projfs`, `block-clone`, or `rcopy`. |
| `task.isolation.merge` | `patch` | Capture/apply patches, or use `branch` mode with `omp/task/<id>` commits and cherry-pick integration. |
| `task.isolation.apply` | Inspect active setting | Determines whether successful captured changes are applied to the parent. |

Use disjoint file ownership or isolation for concurrent writers; select a merge mode compatible with the user's git permissions. Inspect the active settings rather than assuming schema defaults match this Mac.

Finished kept-alive agents become `idle`, then `parked` after `task.agentIdleTtlMs` (default 420,000 ms). Messaging revives parked/killed agents when the retained session is recoverable. Kept-alive isolated agents can retain their workspace through parking/revival; explicit release captures final changes and cleans it up. The bundled task docs warn that an older follow-up template still calls isolated runs non-resumable: check the actual registry/result instead of assuming either lifecycle from a hint alone.

## 3. Custom Agent Definitions

First exact-name match wins: project `<cwd>/.omp/agents/`, user `~/.omp/agent/agents/`, OMP extension-package roots, Claude marketplace plugin agents (project before user), then bundled definitions. Direct `.claude/agents`, `.codex/agents`, and `.gemini/agents` roots are skipped.

```markdown
---
name: db-specialist
description: PostgreSQL and database migration expert.
tools: read, grep, bash, write, lsp
spawns: ""
model: "@task"
thinkingLevel: high
prewalk: "@smol"
---

Inspect db/migrations and enforce repository schema conventions.
Consult Main via write agent://Main when scope or interfaces are ambiguous.
```

- `tools`: CSV or array; include `write` for outbound peer messaging. Inbound steering does not require it.
- `spawns`: `"*"` permits any agent, `""` none, or CSV names restrict children.
- `model`: Selector, prioritized CSV/list, or role alias such as `@task`. Read active `config.yml` and agent files; prefer configured subscription selectors over paid API substitutions. Explicit agent model pins outrank the generic task role.
- `thinkingLevel`: Canonical frontmatter key; this Mac's live definitions use it. Common values include `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, and `auto`, subject to model support. Do not copy legacy hyphenated spellings from older prose examples.
- `output`: JSON Schema string/object for structured output.
- `blocking`: Force inline completion even with async tasks enabled.
- `advisor`: Opt in to a subagent advisor; keep off unless needed.
- `read-summarize`: `false` disables structural read summaries (normalized to `readSummarize`).
- `prewalk`: `true` for the configured smol role, or a role/selector for a custom handoff at first edit/write.

Use the actual resolved provider/model in `history://<id>` to enforce cross-family review after retries/fallbacks.

## 4. Peer Messaging and Discovery

These are OMP tool calls, not shell commands:

```text
read(path="history://")
read(path="history://AuthScout")
read(path="agent://AuthScout")
write(path="agent://AuthScout", content="Check refresh-token races in src/auth/session.ts; report evidence.")
write(path="agent://Main", content="Need a decision on the token storage interface.")
write(path="agent://all", content="The shared brief is /tmp/auth-audit/brief.md; read it before proceeding.")
wait()
```

Take peer IDs verbatim from the roster or task result. `history://` lists registered/retained transcripts, including parked agents; reading a transcript/output does not revive it. `agent://<id>` reads the latest published output, or status/progress before publication; successful follow-ups may replace the output. Treat review inputs as separately versioned immutable artifacts when required.

Direct writes steer a running agent or prompt/revive an idle, parked, or killed agent. `agent://all` is a write-only broadcast to visible live peers; it does not enumerate or revive all historical agents. Messaging is available when the caller has `write` and peers to message. Outbound child messaging is disabled in plan-mode task restrictions.

Messages and job results auto-deliver. `wait` has no arguments and returns on a result, incoming message, or steering interrupt; it has a fixed 30-minute safety cap, not a caller timeout or target selector. With no pending work/reply it returns “Nothing to wait for”. A direct message to a running peer can establish a pending reply; a broadcast does not. There is no separate send-and-await option or inbox-drain call to copy from older examples.

## 5. Jobs and Supervised Services

Start long-running services through `bash` with `name` (requires `launch.enabled`, default true):

```text
bash(command="bun run dev", name="web", ready={"port":3000,"log":"Ready","timeout":30})
read(path="proc://")
read(path="proc://web")
write(path="proc://web", content="rs")
write(path="proc://web/kill")
```

`ready` accepts a port and/or log regex; all supplied conditions must pass. Named services reject `async: true` and any top-level `timeout`; use `ready.timeout` for readiness. A readiness timeout leaves the process running. Reusing a live name restarts it with the new spec. New services have session lifetime by default.

`proc://<service>` writes send stdin, appending Enter unless newline-terminated; empty content sends Enter. Stopping/cancelling requires the explicit `/kill` suffix, whose `content` is optional and ignored. Service `/mode` accepts `persist`, `session`, or `detached`; `detached` restarts without a PTY and persists beyond the broker.

For a finite background command, use `bash(command="bun test", async=true)` when `async.enabled` exposes the field. Read `proc://<returned-job-id>` for status/output without consuming delivery; `write(path="proc://<returned-job-id>/kill")` cancels it. A finite command's timeout still applies after backgrounding. Continue independent work or call `wait()`; do not poll.

Human-facing commands:

```bash
omp ps --plain
omp ps logs web --lines 50
omp ps logs web --follow
omp ps stop web --timeout 5
omp ps kill web
omp ps restart web
```

In the TUI, `/jobs` snapshots running/recently settled tool jobs; `/jobs kill <id>|all` cancels jobs. `Alt+A` opens Agent Hub for live agent inspection/steering/revive/kill. These UI/CLI surfaces do not create a model-facing supervision tool.

## 6. Tuning

| Setting | Schema default | Purpose |
|---|---|---|
| `task.maxConcurrency` | `32` | Shared session semaphore across task calls; `0` means unlimited. This Mac currently sets `8`; provider caps may require less. |
| `task.maxRecursionDepth` | `2` | Child nesting cap; negative disables the cap. |
| `task.maxRuntimeMs` | `0` | Per-spawn deadline; `0` disables it. Read active config for a local override. |
| `task.agentIdleTtlMs` | `420000` | Idle time before parking; non-positive disables parking. |
| `task.agentPrewalk` | `{}` | Per-agent handoff overrides. |
| `task.agentAdvisor` | `{}` | Per-agent advisor pairings. |
| `task.agentModelOverrides` | `{}` | Per-agent model overrides. |

Read current model policy and configured lanes before fan-out: GLM lanes share one z.ai plan cap (one job at a time); MiMo lanes share one Xiaomi pool (no wide fan-out).

Authoritative bundled docs: `omp://tools/task.md`, `omp://task-agent-discovery.md`, `omp://tools/write.md`, `omp://tools/wait.md`, `omp://tools/bash.md`, `omp://bash-tool-runtime.md`, `omp://tools/read.md`, and `omp://agent-hub.md`. From the shell use `omp read <URI>` and `omp ps --help`.
