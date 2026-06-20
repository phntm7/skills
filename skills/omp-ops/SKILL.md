---
name: omp-ops
description: >
  Operate the Oh My Pi (omp) CLI. Use when users need to configure omp settings/config path, add/inspect/troubleshoot model providers and API keys/.env, inspect model catalogs, run omp non-interactively from another agent or script (one-shot or resumable session, e.g. as a reviewer or other delegated task), or resume/continue sessions (-p, --mode json, --continue, --resume).
---

# OMP Ops
Operate Oh My Pi (`omp`) safely as a terminal AI coding-agent CLI: configure it, manage models and credentials, run omp non-interactively from another agent or script (e.g. as a reviewer), and continue sessions without leaking secrets or losing state.
## What OMP is
OMP is Oh My Pi, a terminal AI coding-agent CLI. It can save sessions, resume previous work, and use configured models/providers for coding-agent tasks.
Entry points agents use:
- `omp`: interactive TUI.
- `omp -p "<prompt>"`: one-shot print mode; final assistant text to stdout.
- `omp --mode json "<prompt>"`: one-shot JSONL; first line is the session header with id when sessions are enabled.
- `omp --mode rpc` / `omp --mode rpc-ui` / `omp acp`: stdio protocols for embedders.
- Node SDK: `@oh-my-pi/pi-coding-agent`.
`--mode` accepts `text`, `json`, `rpc`, `acp`, and `rpc-ui`. Use `-p` alone for plain text and `--mode json` alone for JSONL; do not combine them.
Core paths and precedence:
- Global agent dir defaults to `~/.omp/agent`; `PI_CODING_AGENT_DIR` in process env relocates it.
- Profiles (`omp --profile <name>`, `--alias`, or `OMP_PROFILE`/`PI_PROFILE`) relocate the user base under `~/.omp/profiles/<name>/agent/`.
- `omp config path` prints the active agent dir; global settings live at `~/.omp/agent/config.yml`.
- Project settings live at `<cwd>/.omp/config.yml` and load only when `<cwd>/.omp/` exists and is non-empty.
- Settings precedence: defaults <- global <- project <- `--config` overlays <- runtime overrides (in-memory).
- `/settings`, `omp config set`, and `omp config reset` write global config, not project config.
- Model/provider config lives at `~/.omp/agent/models.yml`.
## Operating rules
- Treat this skill and its references as the OMP operating baseline; verify live state with `omp config path` and `omp models` when available.
- Preserve `.env` order: process env > `<cwd>/.env` > `~/.omp/agent/.env` > `~/.omp/.env` > `~/.env`; process env wins and is not mirrored. The `OMP_` -> `PI_` mirror applies only inside `.env` files; prefer canonical `PI_*` for shell exports.
- For OpenAI-compatible chat providers, use `api: openai-completions`; set `authHeader: true` when the provider needs `Authorization: Bearer <resolved key>`. Custom providers with non-empty `models` need `baseUrl`, `apiKey` unless `auth: none`, and provider-level or model-level `api`; `auth: oauth` does not waive `apiKey` for `models.yml` custom models.
- Automation should pass the exact `<provider-id>/<model-id>` selector even though interactive selection supports fuzzy matching. `omp config set` writes global config and receives arrays/records as one shell-quoted JSON string.
- Prefer `omp -p` for plain-text non-interactive jobs. Sessions save unless `--no-session`; for long runs, keep sessions enabled, capture the session id from the `--mode json` header, and resume with `--resume <id-prefix>`.
- Use `--continue` for the terminal breadcrumb or most recent session; use `--resume <id-prefix|path>` for a specific saved session; bare `--resume` opens an interactive picker. Use `--no-tools` only when the run must not touch tools; use `--no-session` only when the result must not be resumable.
## Quick commands
```bash
# Settings and paths: list|get|set|reset|path
omp config path
omp config list
omp config get <key>
omp config set <key> '<json-or-scalar-value>'
omp config reset <key>
# Models and providers
omp models --json
omp models <provider>
omp models find <pattern>
omp models refresh
omp models canonical --json
# Non-interactive runs and sessions
omp -p '<task prompt>'
omp --mode json '<task prompt>'
omp -p --model <provider-id>/<model-id> '<task prompt>'
omp -p --cwd <path> --config <overlay.yml> '<task prompt>'
omp -p --continue '<task prompt>'
omp -p --resume <id-prefix-or-path> '<task prompt>'
```
## Reference selection
- For config paths, precedence, settings writes, `.env` lookup order, provider schema, provider snippets, validation commands, and OpenAI-compatible model setup, read [references/config-and-models.md](references/config-and-models.md).
- For non-interactive runs (one-shot vs persistent), session capture/resume loops, `--continue`/`--resume`, and safety boundaries, read [references/runs-and-sessions.md](references/runs-and-sessions.md).
## Output contract
- State config/model files touched, or that none were modified.
- List commands run and meaningful results; redact secrets to names, paths, or `<redacted>`.
- Include chosen model/provider/session flags, useful session id/path for resume, and any blocker with the next safe action.
## Do/Don't examples
Do:
- "Use `omp config path` first, then inspect the active global config before changing settings."
- "Set `apiKey: OPENAI_API_KEY` or `apiKey: \"!op read op://team/openai/api-key\"` and keep the actual key outside the repo."
- "Run `omp -p --resume abc123 '<task prompt>'` for a targeted loop."
Don't:
- Do not assume project config is loaded unless `<cwd>/.omp/` exists and is non-empty.
- Do not tell users `omp config set` edits project config; it writes global config.
- Do not use a bare `--resume` in unattended automation because it opens an interactive picker.
- Do not use this skill for unrelated model selection with no OMP, `omp`, provider, config, model-catalog, or session context.
