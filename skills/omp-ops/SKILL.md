---
name: omp-ops
description: >
  Oh My Pi, omp CLI, config, models/providers, credentials, sessions, spawning omp for reviews, and review loops. Use when configuring OMP settings, adding or troubleshooting model providers/API keys, inspecting model catalogs, running non-interactive omp review jobs, resuming sessions, or doing fix-and-rereview workflows with --continue or --resume.
---

# OMP Ops

Operate Oh My Pi (`omp`) safely as a terminal AI coding-agent CLI: configure it, manage models and credentials, run reviews, and continue review loops without leaking secrets or losing session state.

## What OMP is

OMP is Oh My Pi, a terminal AI coding-agent CLI. It can save sessions, resume previous work, and use configured models/providers for review and coding tasks.

Entry points agents actually use:

- `omp`: interactive TUI.
- `omp -p "<prompt>"`: one-shot print mode; writes final assistant text to stdout.
- `omp --mode json "<prompt>"`: one-shot JSONL event stream; the first line is the session header with the session id when sessions are enabled.
- `omp --mode rpc` / `omp acp`: stdio protocols for embedders. `--mode rpc-ui` is also available.
- Node SDK: `@oh-my-pi/pi-coding-agent`.

`--mode` accepts `text`, `json`, `rpc`, `acp`, and `rpc-ui`. Use `-p` alone for plain text and `--mode json` alone for JSONL; do not combine them.

Core paths and precedence:

- Global agent dir defaults to `~/.omp/agent`; `PI_CODING_AGENT_DIR` in the process environment relocates it.
- Profiles (`omp --profile <name>`, `--alias`, or `OMP_PROFILE`/`PI_PROFILE`) relocate the user base under `~/.omp/profiles/<name>/agent/`.
- `omp config path` prints the active agent dir.
- Global settings live at `~/.omp/agent/config.yml`.
- Project settings live at `<cwd>/.omp/config.yml` and load only when the current working directory has a non-empty `.omp/` directory.
- Settings precedence is: defaults <- global <- project <- `--config` overlays <- runtime overrides (in-memory).
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

- Treat this skill and its linked references as the OMP operating baseline; verify live state with `omp config path` and `omp models` when available.
- Preserve `.env` resolution order: process env > `<cwd>/.env` > `~/.omp/agent/.env` > `~/.omp/.env` > `~/.env`; process env is never overwritten.
- The `OMP_` -> `PI_` mirror applies only inside `.env` files, where `OMP_X` mirrors to and overrides `PI_X`. Process-env vars are not mirrored; prefer canonical `PI_*` for shell exports and avoid conflicting `PI_*`/`OMP_*` values.
- Use `authHeader: true` when an OpenAI-compatible provider needs `Authorization: Bearer <resolved key>`.
- For OpenAI-compatible chat providers, the common `api` value is `openai-completions`.
- Custom providers with non-empty `models` need `baseUrl`, `apiKey` unless `auth: none` is correct, and provider-level or model-level `api`; `auth` modes are `apiKey`, `none`, and `oauth`.
- For `models.yml` custom models, `auth: oauth` is accepted by the schema but does not waive the `apiKey` requirement.
- Model selection supports fuzzy matching, but automation should pass the exact `<provider-id>/<model-id>` selector.
- Remember `omp config set` writes global config and receives arrays/records as single JSON strings.
- Prefer `omp -p` for plain-text non-interactive review jobs. Sessions save unless `--no-session` is used.
- For long reviews, keep sessions enabled, capture the session id from the `--mode json` session header, and resume with `--resume <id-prefix>` if an outer runner times out.
- Use `--continue` for the terminal breadcrumb or most recent session; use `--resume <id-prefix|path>` for a specific saved session. A bare `--resume` picker is interactive.
- Use `--no-tools` only when the review must not touch tools; use `--no-session` only when the result must not be resumable.

## Relationship to deep-code-review

omp-ops covers operating, driving, and resuming `omp`. The `deep-code-review` skill owns review methodology: lenses, severity scale (Blocker/Major/Minor/Nit), findings schema, synthesis, and verdict.

When running an `omp` review and `deep-code-review` is available, prompt `omp` to use that skill's lenses, severity scale, and findings schema (`severity`, `lens`, `location`, `problem`, `why`, `remedy`). Keep `omp` read-only by default; this matches deep-code-review's review-only stance.

OMP's built-in `/review` uses P0-P3; do not conflate that TUI scale with deep-code-review's severity scale.

## Quick commands

```bash
# Settings and paths: common actions are list|get|set|reset|path
omp config path
omp config list
omp config get <key>
omp config set <key> '<json-or-scalar-value>'
omp config reset <key>

# Models and providers
omp models
omp models --json
omp models <provider>
omp models find <pattern>
omp models refresh
omp models canonical --json

# Non-interactive reviews and sessions
omp -p "Review the current diff for correctness and security."
omp --mode json "Review this change."
omp -p --model <provider-id>/<model-id> "Review this change."
omp -p --model <provider-id>/<model-id> --thinking high "Review the implementation plan before code changes."
omp -p --cwd <path> --config <overlay.yml> "Review this project."
omp -p --continue "Re-review after the fixes; focus on remaining issues."
omp -p --resume <id-prefix-or-path> "Re-review the latest fixes."
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
- "Set `apiKey: OPENAI_API_KEY` or `apiKey: \"!op read op://team/openai/api-key\"` and keep the actual key outside the repo."
- "Run `omp -p --resume abc123 'Re-review the fixes against the original findings.'` for a targeted loop."
- "Use `--no-tools` for an advisory-only review."

Don't:

- Do not assume project config is loaded unless `<cwd>/.omp/` exists and is non-empty.
- Do not tell users `omp config set` edits project config; it writes global config.
- Do not use a bare `--resume` in unattended automation because it opens an interactive picker.
- Do not use this skill for unrelated model selection with no OMP, `omp`, or review-loop context.
- Do not use this skill as a code-review methodology; `deep-code-review` owns the lenses, severity scale, and findings schema.
