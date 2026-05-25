# Agent History And Memory Locations

Use these as known or suspect paths. Verify what exists locally before
assuming any source is available. Treat absences as data — note them in the
final report rather than failing.

## Codex

**Primary home**

- `$CODEX_HOME`, default `~/.codex`
- Windows: `%USERPROFILE%\.codex`, `%APPDATA%\codex`

**Session/history candidates**

- `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl`
- `$CODEX_HOME/archived_sessions/**/rollout-*.jsonl`
- `$CODEX_HOME/session_index.jsonl`
- `$CODEX_HOME/history.jsonl`
- `$CODEX_HOME/state_*.sqlite`

**Expected structure**

- Rollout/session files are JSONL.
- Look for session id, timestamp, `cwd`, source, model, user messages,
  assistant summaries, tool calls/results, compaction summaries, final
  summaries.
- For project scope, filter by cwd/workspace/root/repo evidence.

**Memory and instructions**

- `$CODEX_HOME/memories/`
- `$CODEX_HOME/config.toml`, especially `[features].memories`,
  `memories.use_memories`, `memories.generate_memories`
- `$CODEX_HOME/AGENTS.override.md`
- `$CODEX_HOME/AGENTS.md`
- project `AGENTS.override.md`
- project `AGENTS.md`
- fallback instruction filenames configured in
  `project_doc_fallback_filenames`

## Claude Code

**Primary home**

- `~/.claude`
- Windows: `%USERPROFILE%\.claude`

**Session/history candidates**

- `~/.claude/projects/<encoded-project-path>/<session-id>.jsonl`
- `~/.claude/projects/<encoded-project-path>/<session>/tool-results/`
- `~/.claude/history.jsonl`
- `~/.claude/file-history/<session>/`
- `~/.claude/tasks/`
- `~/.claude/plans/`
- `~/.claude/debug/`

**Memory and instructions**

- Enterprise memory:
  - macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`
  - Linux/WSL: `/etc/claude-code/CLAUDE.md`
  - Windows: `C:\ProgramData\ClaudeCode\CLAUDE.md`
- User memory: `~/.claude/CLAUDE.md`
- Project memory: `./CLAUDE.md` or `./.claude/CLAUDE.md`
- Deprecated local project memory: `./CLAUDE.local.md`
- Auto memory: `~/.claude/projects/<project>/memory/`
- Follow relevant `@path/to/import` references when safe.

## OpenCode

**Primary locations**

- `~/.config/opencode/opencode.json`
- project `opencode.json` or `opencode.jsonc`
- `~/.config/opencode/AGENTS.md`
- project `AGENTS.md`
- `~/.config/opencode/agent/`
- `.opencode/agent/`

**Session/history candidates**

- `~/.local/share/opencode/`
- Windows: `%APPDATA%\opencode\`, `%USERPROFILE%\.local\share\opencode\`
- `~/.local/share/opencode/log/`
- `~/.local/share/opencode/project/<project-slug>/storage/`
- `~/.local/share/opencode/project/global/storage/`
- `~/.local/share/opencode/opencode.db`
- `~/.local/share/opencode/storage/session/`

**Memory**

- Do not assume built-in durable memory.
- Inspect configured plugins and MCP servers.
- Look for memory plugins or stores such as `codexfi`, `opencode-mem`,
  `opencode-supermemory`, `memories.sh`, `mem9`, `open-mem`, or custom MCP
  memory servers.

## Factory Droid

**Primary locations**

- `~/.factory/`
- project `.factory/`
- `~/.factory/mcp.json`
- `.factory/mcp.json`
- `~/.factory/droids/`
- `.factory/droids/`
- `~/.factory/skills/`
- `.factory/skills/`
- `~/.factory/commands/`
- `.factory/commands/`

**Session/history candidates**

- `~/.factory/sessions/`
- `~/.factory/sessions/<repo>/`
- paths referenced by Factory settings, SpecStory, Entire, or session export
  tools

**Memory and instructions**

- project `AGENTS.md`
- `~/.factory/AGENTS.md`
- `.factory/config.json`
- `.factory/settings.json`
- `~/.factory/settings.json`
- MCP memory integrations
- plugin-provided memory systems
- custom droids and skills

## Pi Coding Agent

**Primary home**

- `~/.pi/agent/`

**Session/history candidates**

- `~/.pi/agent/sessions/--<path>--/<timestamp>_<uuid>.jsonl`
- custom session directory from `--session-dir`
- `PI_CODING_AGENT_SESSION_DIR`
- `sessionDir` in `~/.pi/agent/settings.json`
- project `.pi/settings.json`

**Expected structure**

- Sessions are JSONL.
- First line is usually a session header with `type: "session"`, `version`,
  `id`, `timestamp`, and `cwd`.
- Message entries may form a tree using `id` and `parentId`.

**Memory**

- Do not assume one built-in memory implementation.
- Inspect installed extensions/packages and MCP servers.
- Common memory plugin paths may include:
  - `~/.pi/agent/pi-hermes-memory/`
  - `~/.pi/agent/projects-memory/<project>/`
  - `~/.pi/agent/hermes-memory-config.json`
  - `~/.pi/agent/extensions/db0/`
  - `~/.pi/agent/db0.sqlite`
