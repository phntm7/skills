# Subagents, Delegation, and the Hub System

Use this reference to understand and configure Oh My Pi (`omp`) multi-agent delegation (`task` tool), worktree isolation, custom agent definitions, peer messaging, and long-running process supervision (`hub` tool).

## 1. Multi-Agent Delegation via `task`

The `task` tool is OMP's delegation surface. It supports dispatching subagents individually or in parallel batches via a `tasks[]` array.

### Batch Spawning Schema

```json
{
  "context": "Shared background, project invariants, and interfaces rendered into every subagent's system prompt.",
  "tasks": [
    {
      "name": "AuthScout",
      "agent": "scout",
      "task": "Investigate authentication token refresh flows in src/auth/",
      "effort": "hi",
      "isolated": false
    },
    {
      "name": "MigrateSchema",
      "agent": "task",
      "task": "Add user preferences table migration and updated models",
      "isolated": true,
      "outputSchema": {
        "type": "object",
        "properties": {
          "migrationFile": { "type": "string" },
          "status": { "type": "string" }
        },
        "required": ["migrationFile", "status"]
      },
      "schemaMode": "permissive"
    }
  ]
}
```

### Task Parameters & Contracts
- `context`: Shared string rendered into all child prompts in the batch.
- `name`: Stable identifier for peer messaging (CamelCase, $\le 32$ chars).
- `agent`: Agent type to spawn (omitting selects default `task` agent).
- `effort`: Optional reasoning effort (`"lo" | "med" | "hi"`); requires `task.enableEffort: true`.
- `isolated`: When `true`, runs the subagent in an isolated copy-on-write worktree.
- `outputSchema`: JSON Schema to constrain the subagent's structured output.
- `schemaMode`: `"permissive"` (default; accepts fallback text on validation retry exhaustion) or `"strict"` (fails if invalid).

### Built-in Agent Types

| Agent | Characteristics | Best For |
|---|---|---|
| `task` | Full capabilities, editable tools, default worker. | Multi-step implementation, coding, test writing. |
| `scout` | Read-only tools (`read`, `grep`, `glob`, `lsp`), runs **inline/blocking**. | Fast codebase exploration, architecture mapping. |
| `reviewer` | Read-only analysis and code quality evaluation. | Standards compliance, spec verification, security audits. |
| `librarian` | Researches external libraries and APIs by reading source. | Definitive API contract verification. |
| `sonic` | Low-reasoning agent for mechanical sweeps. | Bulk renames, lint fixes, mechanical boilerplate. |

*(Note: The legacy `designer` agent was removed in v18.1.5).*

## 2. Worktree Isolation

When subagents perform risky changes or work on overlapping files in parallel, `isolated: true` executes the child session in an isolated worktree.

### Configuration Settings (v18.1.5 Schema)

| Setting Key | Type | Default | Description |
|---|---|---|---|
| `task.isolation.enabled` | boolean | `false` | Master toggle for worktree isolation (`false` by default in pristine schema). |
| `isolation.backend` | enum | `auto` | Backend: `auto`, `apfs`, `btrfs`, `zfs`, `reflink`, `overlayfs`, `projfs`, `block-clone`, `rcopy`, or `worktree`. |
| `task.isolation.merge` | enum | `patch` | Result return mechanism: `patch` (diff captured as patch) or `branch` (committed to `omp/task/<id>` branch). |

Isolated workspaces live under `~/.omp/wt/`. When finished, isolated subagents are torn down; their transcripts stay readable at `history://<id>`.

## 3. Custom Agent Definitions

Define custom agents as Markdown files with YAML frontmatter.

### Discovery Order
1. Project-level: `<cwd>/.omp/agents/<name>.md`
2. User-level: `~/.omp/agent/agents/<name>.md`
3. Plugin-level: `<pluginRoot>/agents/<name>.md`
4. Bundled agents

First match by exact `name` wins.

### Custom Agent Template (`.omp/agents/db-specialist.md`)

```markdown
---
name: db-specialist
description: PostgreSQL and database migration expert.
tools: read, grep, bash, lsp
spawns: ""
model: anthropic/claude-opus-5
prewalk: openai/gpt-5.6-luna
---

You are a database architect. Inspect migrations in `db/migrations` and enforce schema conventions.
```

- `spawns`: Controls sub-delegation permissions (`"*"` for any, `""` for none, or comma-separated names).
- `prewalk`: Model to swap into at the first edit (e.g. plan on strong model, implement on fast model).

## 4. The Unified `hub` Surface

The `hub` tool consolidates peer messaging, background jobs, and project process supervision into a single interface. (It replaced legacy `irc`, `job`, and `launch` tools in v17.0.0).

### Peer Messaging & Subagent Coordination

Subagents that complete their tasks enter `idle` state; after `task.agentIdleTtlMs` (default 7 minutes), they transition to `parked`.

```bash
# List all live, idle, and parked peers
hub op="list"

# Send a fire-and-forget message (wakes idle/parked agents)
hub op="send" to="AuthScout" message="Did you find any refresh token race conditions?"

# Send a message and wait for recipient's reply
hub op="send" to="AuthScout" message="Check line 42 of auth.ts" await=true

# Wait for the next incoming peer message or background job completion
hub op="wait" timeoutMs=60000

# Drain queued messages from inbox
hub op="inbox"
```

### Process Supervision (`hub start`)

Run and monitor long-running services, test watchers, debuggers, or REPLs shared across the workspace:

```bash
# Start a dev server with readiness criteria
hub op="start" name="web" application="bun" args=["run", "dev"] ready='{"port": 3000, "log": "Ready on http", "timeout": 30}'

# Inspect live process status across the project
hub op="ps"

# Read recent logs
hub op="logs" name="web" lines=50 follow=true

# Send input to process stdin
hub op="send" name="web" text="rs" enter=true

# Stop a supervised process tree gracefully
hub op="stop" name="web" timeout=5
```

### Background Job Control

```bash
# Snapshot all running and recently settled jobs
hub op="jobs"

# Cancel a hung or unnecessary background job
hub op="cancel" ids=["bash_3f8a1"]
```

## 5. Subagent Tuning Settings

| Setting Key | Default | Purpose |
|---|---|---|
| `task.maxConcurrency` | `32` | Maximum concurrent subagents running at once. |
| `task.maxRecursionDepth` | `2` | Nesting depth limit for subagents spawning child subagents. |
| `task.maxRuntimeMs` | `0` | Wall-clock execution timeout per spawn (`0` = disabled). |
| `task.agentIdleTtlMs` | `420_000` | Idle time (ms) before an idle subagent is parked (7 mins). |
| `task.prewalk` | `false` | Enable Prewalk handoff on the generic `task` agent. |
| `task.agentPrewalk` | `{}` | Record of per-agent prewalk overrides (`{"AgentName": "on"}`). |
| `task.agentModelOverrides` | `{}` | Record of per-agent model overrides (`{"AgentName": "provider/model"}`). |
