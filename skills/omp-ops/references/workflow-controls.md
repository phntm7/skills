# Workflow Controls, Handoffs, and Autonomous Tools

Use this reference to configure cost-saving model handoffs (Prewalk, Plan-yolo), trigger magic keywords, establish approval guardrails, and operate autonomous watchdogs (Advisor, Cleanse, Goal mode).

## 1. Cost-Saving Model Handoffs

Strong frontier models (Opus, Fable, GPT-5.6) plan best, while fast/cheap models (Luna, MiMo, Flash) implement mechanical code at a fraction of the cost. OMP provides two automated handoff mechanics:

### Prewalk: Plan on Strong, Implement on Smol

How it works:
1. Arming Prewalk injects a system directive forcing the strong model to write an explicit plan and a 5–9 item todo list.
2. A state machine monitors turns; once the todo list exists **and** the first `edit`/`write` fires, OMP automatically swaps the active model to the target (default `@smol`) and injects an implementation checklist.

| Invocation | Scope & Effect |
|---|---|
| `omp --prewalk` | Arm for this CLI session (target `@smol`). |
| `omp --prewalk-into <model>` | Arm and specify target model. |
| `omp --no-prewalk` | Force off even if configured in settings. |
| `/prewalk` | Arm mid-session from TUI prompt. |
| `omp config set prewalk.enabled true` | Make Prewalk the persistent global default. |
| `task.prewalk: true` | Arm Prewalk on the generic `task` subagent. |
| `task.agentPrewalk: {"Agent": "on"}` | Override Prewalk per subagent. |

*When to use:* Refactors, CRUD endpoints, and standard bug fixes where architectural decisions are easy to lay out but editing is repetitive.

### Plan-yolo: Hands-Off Planned Execution

How it works:
1. Boots the session into forced read-only plan mode (the strong model can only read files and write the plan).
2. On the model's first plan-approval call, OMP auto-approves the plan, restores full tool access, swaps to the target model, and injects an "implement-exactly" prompt.

```bash
# Arm plan-yolo into default @smol target
omp --plan-yolo

# Arm plan-yolo with explicit target model
omp --plan-yolo --plan-yolo-into openai/gpt-5.6-luna
```

*Difference from Prewalk:* Prewalk waits for the first edit tool call; Plan-yolo strictly forces read-only plan mode first and swaps immediately upon plan approval.

## 2. Magic Keywords

OMP scans user prompt prose for standalone keywords at turn start (Unicode word boundaries; code spans and markdown fences ignored). When detected, OMP raises thinking effort or injects special turn directives:

| Keyword | Single-Turn Effect |
|---|---|
| `ultrathink` | Raises thinking/reasoning effort to maximum (`max` / `xhigh`) for this turn only. |
| `orchestrate` | Turns the current turn into an orchestrator: enforces task decomposition, dispatches parallel subagents via `task`, and forbids early yield. |
| `workflowz` | Instructs the model to author a deterministic multi-agent pipeline using `eval` runtime primitives (`parallel`, `pipeline`, `agent`, `completion`). |

*Escaping Keywords:* Wrap the word in backticks (e.g. `` `orchestrate` ``) to mention it without triggering the keyword directive.
*Master Switch:* Disable via `omp config set magicKeywords.enabled false`.

## 3. Approval Modes and Security Guardrails

OMP provides granular control over tool execution safety:

### Approval Modes (`--approval-mode <mode>`)

OMP classifies tools into three capability tiers:
- **`read`**: Reads files or workspace state (`read`, `grep`, `glob`, `lsp`).
- **`write`**: Mutates files or workspace state without running arbitrary code (`edit`, `write`).
- **`exec`**: Executes code, commands, browser actions, or spawns agents (`bash`, `eval`, `computer`, `browser`, `task`). Undeclared tools default to `exec`.

| Mode | Auto-Approves | Prompts For | Notes |
|---|---|---|---|
| `yolo` | `read`, `write`, `exec` | *(None)* | **Default mode**. Auto-approves all tool calls without prompting. Forced by `--yolo` or `--auto-approve`. |
| `write` | `read`, `write` | `exec` | Allows file inspection and edits unattended; prompts before shell/exec/subagent calls. |
| `always-ask` | `read` | `write`, `exec` | Auto-approves safe reads; prompts before file mutations or execution. Recommended for delegated/untrusted automation. |

*Important:* `tools.approvalMode` defaults to `yolo`. In unattended scripts (`omp -p`), always pass `--approval-mode always-ask` or `--approval-mode write` if you intend to restrict execution.
### Per-Tool Approval Policies (`config.yml`)
Per-tool settings override the global approval mode:
```yaml
tools:
  approvalMode: write
  approval:
    bash: prompt
    eval: prompt
    read: allow
    edit: allow
```

### Safety Hooks
OMP supports pre-execution TypeScript hooks (`--hook <file>`):
- `beforeToolCall`: Runs before execution; can inspect arguments, rewrite parameters, or reject calls.
- `beforeModelCall`: Pre-model gate receiving finalized context; can return `{ stop: true, reason: "..." }` to abort the turn before burning LLM tokens.

## 4. Autonomous Watchdogs & Cleanse

### The Advisor (Shadow Watchdog)
Pairs a second model as a persistent shadow session. It observes conversation turns incrementally, performs independent read-only inspection (`read`, `grep`, `glob`), and speaks only via an `advise` tool with severities: `nit` (aside), `concern`, or `blocker` (interrupts the main agent).

```bash
# Enable advisor at startup
omp --advisor

# Interactive TUI toggle
/advisor on
/advisor off
/advisor status
```
*Tuning:* `omp config set advisor.syncBacklog 3` (pauses main agent up to 30s if advisor falls 3 turns behind).

### Cleanse (`omp cleanse`)
Autonomous project diagnostic and lint repair engine:
```bash
# Detect project linters/typecheckers and repair diagnostics across subagents
omp cleanse

# Target a specific repair intent
omp cleanse "fix broken import paths"
```
*Supported checkers:* oxlint, golangci-lint, mypy, basedpyright, Clippy, stylelint, vue-tsc, actionlint. Splits repairs across subagents bounded by `task.maxConcurrency`.

### Goal Mode (`/goal`)
Autonomous multi-turn goal pursuit:
- `/goal set <objective>`: Establishes a persistent objective the agent pursues across turns under a hard spend budget, blocking plan and vibe modes until achieved or dropped.
