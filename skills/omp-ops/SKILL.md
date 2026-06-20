---
name: omp-ops
description: >
  Oh My Pi, omp CLI, config, models/providers, credentials, sessions, spawning omp for reviews, and review loops. Use when configuring OMP settings, adding or troubleshooting model providers/API keys, inspecting model catalogs, running non-interactive omp review jobs, resuming sessions, or doing fix-and-rereview workflows with --continue or --resume.
---

# OMP Ops

Operate Oh My Pi (`omp`) safely as a terminal AI coding-agent CLI: configure it, manage models and credentials, run reviews, and continue review loops without leaking secrets or losing session state.

## What OMP is

OMP is Oh My Pi, a terminal AI coding agent CLI. It can run interactively or non-interactively, save sessions, resume previous work, and use configured models/providers for review and coding tasks.

Core paths and precedence:

- Global agent dir defaults to `~/.omp/agent`; `PI_CODING_AGENT_DIR` relocates it.
- `omp config path` prints the active agent dir.
- Global settings live at `~/.omp/agent/config.yml`.
- Project settings live at `<cwd>/.omp/config.yml` and load only when the current working directory has a non-empty `.omp/` directory.
- Settings precedence is: defaults <- global <- project <- `--config` overlays <- runtime flags/env.
- `/settings`, `omp config set`, and `omp config reset` write global config, not project config.
- Model/provider config lives at `~/.omp/agent/models.yml`.

## When to use

Use this skill when the user asks to:

- configure OMP settings or find the active OMP config path;
- add, inspect, refresh, or troubleshoot models/providers;
- set up credentials or `.env`-based API keys without exposing secrets;
- run `omp` as a reviewer from another agent or script;
- resume, continue, or re-review with saved sessions;
- choose between one-shot, persistent, and fix-and-rereview OMP workflows.

## Operating rules

- Treat this skill and its linked references as the OMP operating baseline; verify live state with `omp config`, `omp models`, or session commands when available.
- Preserve process environment precedence: process env > `<cwd>/.env` > `~/.omp/agent/.env` > `~/.omp/.env` > `~/.env`; process env is never overwritten.
- Use `authHeader: true` when an OpenAI-compatible provider needs `Authorization: Bearer <resolved key>`.
- For OpenAI-compatible chat providers, the common `api` value is `openai-completions`.
- Custom providers with non-empty `models` need `baseUrl`, `apiKey` unless `auth: none`, and provider-level or model-level `api`.
- Remember `omp config set` receives arrays/records as JSON strings.
- Prefer `omp -p` for non-interactive review jobs. Sessions save unless `--no-session` is used.
- Use `--continue` for the terminal breadcrumb or most recent session; use `--resume <id|path>` for a specific saved session by path or id prefix. A bare `--resume` picker is interactive.
- Use `--no-tools` only when the review must not touch tools; use `--no-session` only when the result must not be resumable.

## Quick commands

```bash
# Settings and paths
omp config path
omp config list
omp config get <key>
omp config set <key> '<json-or-scalar-value>'
omp config reset <key>

# Models and providers
omp models
omp models <provider>
omp models find <pattern>
omp models refresh
omp models canonical --json

# Non-interactive reviews and sessions
omp -p "Review the current diff for correctness and security."
omp -p --model <provider/model> "Review this change."
omp -p --slow --plan "Review the implementation plan before code changes."
omp -p --cwd <path> --config <overlay.yml> "Review this project."
omp -p --continue "Re-review after the fixes; focus on remaining issues."
omp -p --resume <session-id-or-path> "Re-review the latest fixes."
```

## Reference selection

- For config paths, precedence, settings writes, `.env` lookup order, provider schema, provider snippets, validation commands, and OpenAI-compatible model setup, read [references/config-and-models.md](references/config-and-models.md).
- For one-shot reviews, persistent review sessions, fix-and-rereview loops, prompt templates, `--continue`/`--resume`, and review safety boundaries, read [references/review-workflows.md](references/review-workflows.md).

## Output contract

When reporting OMP work to a user, include only what was actually checked or changed:

- config/model files touched, or state that none were modified;
- commands run and their meaningful result, with secrets redacted;
- chosen model/provider/session flags and why;
- session id/path only when useful for resume, never as a substitute for the review result;
- any blocker, missing credential, or unavailable provider with the next safe action.

## Do/Don't examples

Do:

- "Use `omp config path` first, then inspect the active global config before changing settings."
- "Set `apiKey: OPENAI_API_KEY` and export the actual key outside the repo."
- "Run `omp -p --resume abc123 'Re-review the fixes against the original findings.'` for a targeted loop."
- "Use `--no-tools` for an advisory-only review."

Don't:

- Do not assume project config is loaded unless `<cwd>/.omp/` exists and is non-empty.
- Do not tell users `omp config set` edits project config; it writes global config.
- Do not use a bare `--resume` in unattended automation because it opens an interactive picker.
- Do not use this skill for unrelated model selection with no OMP, `omp`, or review-loop context.
