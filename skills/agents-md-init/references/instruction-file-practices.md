# AGENTS.md and CLAUDE.md Practices

Last verified: 2026-07-13

## Core Model

Treat `AGENTS.md` and `CLAUDE.md` as repository instruction files with
equivalent purpose: durable guidance for coding agents. `AGENTS.md` is the
portable cross-agent default; `CLAUDE.md` is Claude Code's conventional project
memory file. Claude Code reads `CLAUDE.md`, not `AGENTS.md`, so use
`CLAUDE.md` to import the canonical shared instructions.

Both files become part of the agent's system prompt and load every session.
Every line spends context on every task, so each addition must solve a real,
observed problem — a command the agent keeps getting wrong, a convention it
keeps missing — not a theoretical concern about what an agent might need.

Default repository setup:

```text
AGENTS.md  # canonical shared instructions
CLAUDE.md  # imports @AGENTS.md, then adds Claude-specific notes if needed
```

Use this `CLAUDE.md` shape by default:

```markdown
@AGENTS.md

## Claude Code

[Claude-specific notes, only when needed.]
```

Use a symlink only when the user explicitly prefers it, there is no
Claude-specific content, and the OS supports symlinks without elevated
privileges. On Windows, use the `@AGENTS.md` import because symlinks usually
require Administrator privileges or Developer Mode. Use separate full files only
when the user asks or one tool needs truly different syntax. Keep most content
universal even when the files are separate.

## What Belongs In The File

Include project-specific, durable instructions an agent cannot reliably infer
from code alone:

- a short project map: purpose, key directories, entry points, and any
  non-standard organizational choices (DDD, microservices, generated code);
- setup, build, test, lint, typecheck, format, and deploy commands;
- package-manager and task-runner preferences;
- custom tools and scripts with usage examples, when to invoke them, and
  whether `--help` documentation exists;
- MCP server usage constraints (which channels/targets are allowed, rate
  limits, what not to use the server for);
- testing strategy, focused test commands, and when full suites are required;
- code style that differs from language/framework defaults;
- architectural constraints, data flow, generated-code rules, and public API
  compatibility requirements;
- security, secrets, migrations, and production-safety rules;
- standard workflows: when to investigate first, when a plan is required, and
  how effectiveness will be tested;
- PR, commit, release, or review expectations;
- known gotchas and repeated failure modes.

Keep each loaded instruction file under 200 lines when possible. Longer files
consume context and reduce adherence. If instructions keep growing, move
task-specific workflows to skills, path-specific rules to `.claude/rules/`,
and long background material to separate Markdown files referenced from the
instruction file.

Leave out:

- one-off task instructions;
- generic "be careful" guidance;
- stale architecture diagrams or unchecked command lists;
- broad model personality prompts;
- long copies of README content;
- instructions that fight system/developer prompts or local permission models;
- API keys, credentials, connection strings, or detailed vulnerability
  information — the file ships with the repo and enters every prompt, so treat
  it as potentially public.

## Writing For Current Frontier Models

Current frontier models (GPT-5.6, Claude Fable 5, Claude Opus 4.8) follow
instruction contracts closely. This changes what a good instruction file looks
like:

- Contradictory or redundant rules destabilize behavior more than missing
  detail. State each rule once; audit for conflicts between sections.
- Reserve absolute language (ALWAYS, NEVER, must, only) for true invariants:
  safety rules, prohibited actions, required gates. For judgment calls, give a
  decision rule ("prefer X when Y") instead.
- A brief instruction steers a whole behavior class; do not enumerate every
  case a capable model already handles.
- State autonomy boundaries once: what agents may do without asking (in-scope
  edits, non-destructive validation) and what needs confirmation (migrations,
  external writes, dependency changes). Repeating "ask first" across sections
  causes unnecessary approval pauses.
- Give the reason for unusual constraints; a one-line "because" lets the model
  generalize correctly to cases you did not enumerate.
- Remove scaffolding written for older models — forced interim status updates,
  step-by-step procedures for behavior the model performs reliably, long lists
  of prohibitions. Trim one group at a time and re-check behavior.

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

## Architecture Notes
```

Add `Code Style`, `Environment`, `Security`, `Workflow`, or `Known Gotchas` only
when those sections contain project-specific guidance.

## Prompting Guidance To Encode

Modern coding agents perform better when durable instructions provide:

- role and responsibility boundaries for this repository;
- exact tool/command expectations where the path matters;
- verification gates and done criteria;
- source-of-truth files for architecture and generated artifacts;
- concise output expectations for repo workflows;
- guidance for asking, escalating, or abstaining when information is missing.

Do not request hidden reasoning or chain-of-thought, and never instruct a model
to echo or transcribe its internal reasoning as response text — on models with
summarized thinking (Claude Fable 5) this can trigger refusals. Request visible
artifacts: plans, checks, diffs, test output summaries, citations to files, and
concise rationale.

## Codex Discovery Notes

Codex builds its instruction chain once per run (once per TUI session):

- **Global scope**: in `CODEX_HOME` (default `~/.codex`), Codex reads
  `AGENTS.override.md` if present, otherwise `AGENTS.md` — the first non-empty
  file only.
- **Project scope**: Codex walks from the project root (typically the Git
  root) down to the current working directory. In each directory it checks
  `AGENTS.override.md`, then `AGENTS.md`, then any names in
  `project_doc_fallback_filenames` — at most one file per directory.
- **Merge order**: files concatenate root-down; files closer to the working
  directory appear later and override earlier guidance. Place overrides as
  close to specialized work as possible (e.g. `services/payments/AGENTS.md`).
- **Size cap**: Codex stops adding files once the combined size reaches
  `project_doc_max_bytes` (32 KiB default). Raise the limit or split
  instructions across nested directories when guidance gets truncated.
- `AGENTS.override.md` is for temporary overrides without deleting the base
  file; empty files are skipped.
- To verify what loaded, ask Codex to summarize its current instructions, or
  inspect the TUI log / session `.jsonl`.

## Claude Code Discovery Notes

Claude Code loads `CLAUDE.md` memories across enterprise, project, user, and
local scopes, and supports project files such as `./CLAUDE.md` or
`./.claude/CLAUDE.md`. For this repository's convention, keep `AGENTS.md`
canonical and make `CLAUDE.md` import `@AGENTS.md` unless there is a reason not
to.

Mechanics to account for:

- `CLAUDE.md` can import files with `@path` syntax. Relative imports resolve from
  the file containing the import, and imports can recurse up to five hops.
- `./CLAUDE.md`, `./.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`,
  `./CLAUDE.local.md`, and managed policy files can all contribute memory.
  Managed policy locations are `/Library/Application Support/ClaudeCode/CLAUDE.md`
  on macOS, `/etc/claude-code/CLAUDE.md` on Linux/WSL, and
  `C:\Program Files\ClaudeCode\CLAUDE.md` on Windows.
- `CLAUDE.local.md` is for private project-specific preferences and should be
  gitignored.
- `.claude/rules/` supports modular and path-scoped rules with `paths`
  frontmatter. Use it for instructions that only apply to certain files.
- Claude Code's `/init` generates or improves `CLAUDE.md`; when an `AGENTS.md`
  exists, it reads it and incorporates relevant parts. `CLAUDE_CODE_NEW_INIT=1`
  enables a multi-phase init that can set up memories, skills, and hooks. Treat
  `/init` output as a starting point; iterate with the `#` key when the user
  finds themselves repeating an instruction.
- Block-level HTML comments in `CLAUDE.md` are stripped before being injected
  into context; they are useful for maintainer notes that should not spend
  context.
- In monorepos, `claudeMdExcludes` can skip irrelevant ancestor memory files or
  rules.
- Auto memory is separate from user-written `CLAUDE.md`; Claude writes it under
  `~/.claude/projects/<project>/memory/`.
- Root `CLAUDE.md` remains loaded after `/compact`; nested files that load on
  demand may need to be re-read. Put critical rules in root project memory.
- Repetitive prompts belong in custom slash commands (`.claude/commands/*.md`,
  with `$ARGUMENTS`/`$1` placeholders), not in project memory.
- If a rule must run at a fixed lifecycle point, use a Claude Code hook. If a
  task-specific procedure does not need to load every session, use a skill. If
  a rule must be at system-prompt level for a scripted invocation, use
  `--append-system-prompt` or related CLI flags.

## Sources

- AGENTS.md open format: https://agents.md/
- OpenAI Codex AGENTS.md configuration guide: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
- Anthropic "Using CLAUDE.md files": https://claude.com/blog/using-claude-md-files
- Anthropic Claude Code memory docs: https://code.claude.com/docs/en/memory
- Anthropic Claude Code best practices: https://code.claude.com/docs/en/best-practices
- Anthropic Claude Code skills: https://code.claude.com/docs/en/skills
- Anthropic Claude Code hooks: https://code.claude.com/docs/en/hooks-guide
- Anthropic Claude Code CLI reference: https://code.claude.com/docs/en/cli-reference
- GitHub awesome-copilot create-agentsmd skill: https://github.com/github/awesome-copilot/blob/main/skills/create-agentsmd/SKILL.md
- Anthropic claude-md-improver skill: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-md-management/skills/claude-md-improver/SKILL.md
- Karpathy guidelines skill: https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
