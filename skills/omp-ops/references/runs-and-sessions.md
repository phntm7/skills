# Running OMP Non-Interactively and Managing Sessions

Use this reference to drive Oh My Pi (`omp`) in automated pipelines, scripts, external agent loops (e.g. code-review loops), and multi-turn workflows.

## 1. Execution Modes

| Goal | Command Pattern | Output / Characteristics |
|---|---|---|
| **One-Shot Plain Text** | `omp -p --cwd /path/to/repo --model <sel> '<prompt>'` | Assistant text directly to stdout; clean for shell pipes. |
| **One-Shot Structured JSONL** | `omp -p --mode json --cwd /path/to/repo --model <sel> '<prompt>'` | Streaming JSONL events. Authoritative complete text is in the final `message_end` event. |
| **Standard ACP Protocol** | `omp acp` | Standard Agent Client Protocol server running over stdio. |
| **RPC Embedding** | `omp --mode rpc` / `omp --mode rpc-ui` | Interactive line-based RPC protocol for host editor integration. |

*Note on `-p` and `--mode json`:* In modern OMP, combining `-p` and `--mode json` is the standard way to run structured non-interactive jobs.

## 2. Headless Automation & Multi-Turn Loops

### The Standard Headless Loop Pattern

1. **Start the session and capture session ID**:
   ```bash
   omp -p --mode json --cwd /path/to/project --model openai/gpt-5.6 '<task prompt>' | tee /tmp/omp-session.jsonl
   
   # Extract the session ID from the session header
   session_id=$(jq -r 'select(.type=="session") | .id' /tmp/omp-session.jsonl)
   ```
   *Session Header Semantics:* Persisted sessions emit a `{"type":"session","id":"..."}` header as the very first JSONL line. Passing `--no-session` suppresses this header completely.

2. **Extract the authoritative assistant response**:
   ```bash
   # Extract the finalized text from the message_end event
   jq -r 'select(.type=="message_end" and .message.role=="assistant") | .message.content[] | select(.type=="text") | .text' /tmp/omp-session.jsonl
   ```

3. **Perform verification or code edits in caller**:
   The calling script or agent inspects the feedback, makes necessary adjustments, runs project test suites, and drafts follow-up instructions.

4. **Resume the exact session**:
   ```bash
   omp -p --cwd /path/to/project --resume "$session_id" '<follow-up prompt>'
   ```
   Or continue the ambient session in the same terminal/directory:
   ```bash
   omp -p --cwd /path/to/project --continue '<follow-up prompt>'
   ```

## 3. External Code-Review Recipe

When an external coding agent or CI script invokes OMP to perform an in-depth code review:

```bash
# 1. Read-only review with explicit cwd and strict approval boundary
omp -p \
  --cwd /path/to/repo \
  --model anthropic/claude-opus-5 \
  --approval-mode always-ask \
  "Review the staged changes in this repository against standards and spec. Report critical bugs, security flaws, and architectural regressions with file and line references."

# 2. Maximum isolation advisory run (disables all tools)
omp -p \
  --cwd /path/to/repo \
  --model openai/gpt-5.6 \
  --no-tools \
  "$(git diff main...HEAD)"
```

### Safety Rules for Delegated Runs
- Default to `--approval-mode always-ask` or `--no-tools` to prevent unattended external edits.
- Pass `--cwd` on every command so OMP targets the exact intended project.
- For long-running runs, supply `--max-time <duration>` (e.g. `--max-time 10m`) to prevent runaway API spend.

## 4. Multi-Root Workspaces

OMP natively supports multi-directory workspaces:
- Launch seed: `omp --cwd /primary/repo --add-dir /shared/lib --add-dir /docs/specs`
- Interactive mid-session: `/add-dir <path>`, `/remove-dir <path>`, `/dirs` (list active roots).

All tools (`read`, `grep`, `glob`, `lsp`, `edit`) operate across all attached workspace roots.

## 5. Session Lifecycle Commands

| Command | Transcript Retained | Cache / Provider State | Use Case |
|---|---|---|---|
| `/fresh` | **Retained in full** | **Reset** | Cleans up a wedged provider stream, stale cache, or drifted conversation ID without losing visible context. |
| `/clear` | Cleared on disk | Reset | Clean slate for conversation turns; marks a `reset_boundary` for subsequent compactions; drops pending queues. |
| `/drop` | **Deleted** | Reset | Destroys the session file and local state completely. |
| `/new` | None | Reset | Starts a clean empty session. |
| `/tree` | Navigable | Intact | Visual tree navigation across turns and branches within the active session file. |
| `/branch` | Forked in-session | Cloned | Creates a new branch from a chosen message *inside the current session*. |
| `/fork` | Cloned to new file | Cloned | Copies the conversation into a brand-new session file. |

## 6. Context Compaction & Memory Optimization

As conversations grow, OMP manages token limits via layered compaction strategies:

### Zero-Cost Pruning: `/shake`
- `/shake` or `/shake elide`: Replaces bulky historical tool output blocks with `artifact://<id>` references without making any LLM call. Tool results remain recoverable if needed, but active token count drops dramatically.
- `/shake images`: Strips image blocks to free vision token overhead.

### In-Place Compaction: `/handoff`
- `/handoff [focus instructions]`: Writes an in-place handoff document and commits it into the active session file as a compaction entry. Retains prompt cache and session identity (does not fork into a new file).

### Compaction Modes
Configured via `compaction.strategy` or manual `/compact <mode> [focus]`:
- `remote`: Uses provider-native compaction endpoints (e.g. OpenAI `/responses/compact`).
- `soft`: Local summarization using the active model.
- `snapcompact`: Serializes conversation history onto dense bitmap images read by vision-capable models (zero LLM summarization tokens).
