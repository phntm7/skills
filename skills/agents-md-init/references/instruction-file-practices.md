# AGENTS.md and CLAUDE.md Practices

Last verified: 2026-05-13

## Core Model

Treat `AGENTS.md` and `CLAUDE.md` as repository instruction files with
equivalent purpose: durable guidance for coding agents. `AGENTS.md` is the
portable cross-agent default; `CLAUDE.md` is Claude Code's conventional project
memory file.

Default repository setup:

```text
AGENTS.md  # canonical shared instructions
CLAUDE.md  -> AGENTS.md
```

Use separate files only when the user asks, symlinks are unsuitable, or one tool
needs truly different syntax. Keep most content universal even when the files are
separate.

## What Belongs In The File

Include project-specific, durable instructions an agent cannot reliably infer
from code alone:

- repo layout and ownership boundaries;
- setup, build, test, lint, typecheck, format, and deploy commands;
- package-manager and task-runner preferences;
- testing strategy, focused test commands, and when full suites are required;
- code style that differs from language/framework defaults;
- architectural constraints, data flow, generated-code rules, and public API
  compatibility requirements;
- security, secrets, migrations, and production-safety rules;
- PR, commit, release, or review expectations;
- known gotchas and repeated failure modes.

Leave out:

- one-off task instructions;
- generic "be careful" guidance;
- stale architecture diagrams or unchecked command lists;
- broad model personality prompts;
- long copies of README content;
- instructions that fight system/developer prompts or local permission models.

## Quality Rubric

Score candidate files against these dimensions:

| Criterion | Weight | Check |
| --- | --- | --- |
| Commands/workflows | High | Are exact build/test/lint/dev commands present? |
| Architecture clarity | High | Can the agent locate key modules and entry points? |
| Non-obvious patterns | Medium | Are gotchas and "why this way" rules captured? |
| Conciseness | Medium | Is every section useful and non-redundant? |
| Currency | High | Do paths, commands, and tools match the repo now? |
| Actionability | High | Can instructions be followed without guessing? |

## Recommended Sections

Use only sections that matter for the project:

```markdown
# <Project Name>

## Project Overview

## Repository Layout

## Setup

## Development Commands

## Testing

## Code Style

## Architecture Notes

## Environment

## Security

## Workflow

## Pull Requests

## Known Gotchas
```

## Prompting Guidance To Encode

Modern coding agents perform better when durable instructions provide:

- role and responsibility boundaries for this repository;
- exact tool/command expectations where the path matters;
- verification gates and done criteria;
- source-of-truth files for architecture and generated artifacts;
- concise output expectations for repo workflows;
- guidance for asking, escalating, or abstaining when information is missing.

Do not request hidden reasoning or chain-of-thought. Request visible artifacts:
plans, checks, diffs, test output summaries, citations to files, and concise
rationale.

## Discovery Notes

Codex discovers `AGENTS.md` from global and project scopes, walking from the
project root to the current directory; closer files override earlier guidance.
Claude Code loads `CLAUDE.md` memories across enterprise, project, user, and
local scopes, and supports project files such as `./CLAUDE.md` or
`./.claude/CLAUDE.md`. For this repository's convention, keep `AGENTS.md`
canonical and use `CLAUDE.md` as a symlink unless there is a reason not to.

## Sources

- AGENTS.md open format: https://agents.md/
- OpenAI Codex AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
- OpenAI prompt engineering for GPT-5 coding agents: https://developers.openai.com/api/docs/guides/prompt-engineering#coding
- Anthropic Claude Code memory docs: https://docs.claude.com/en/docs/claude-code/memory
- Anthropic Claude Code best practices: https://code.claude.com/docs/en/best-practices
- GitHub awesome-copilot create-agentsmd skill: https://github.com/github/awesome-copilot/blob/main/skills/create-agentsmd/SKILL.md
- Anthropic claude-md-improver skill: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-md-management/skills/claude-md-improver/SKILL.md
- Karpathy guidelines skill: https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
