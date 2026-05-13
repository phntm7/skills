---
name: agents-md-init
description: >
  Initialize AGENTS.md and CLAUDE.md project instruction files. Use when a user
  asks to create, bootstrap, generate, scaffold, initialize, or set up
  AGENTS.md, CLAUDE.md, agent instructions, project memory, repository guidance,
  or coding-agent context files for a project.
---

# AGENTS.md Init

Use this skill to analyze a project and create practical, current instructions
for coding agents. Treat `AGENTS.md` and `CLAUDE.md` as equivalent instruction
files: prefer `AGENTS.md` as the canonical file and make `CLAUDE.md` a symlink
to it unless the user explicitly wants separate files.

## When To Use

- The user asks for `/init`-style project instructions, project memory, or a
  repository guide for AI coding agents.
- The project has no useful `AGENTS.md` or `CLAUDE.md`, or the user wants to
  replace a starter/template file with project-specific guidance.
- The user asks to support both Codex-style `AGENTS.md` and Claude-style
  `CLAUDE.md` instructions.

If the user asks to edit an existing mature file, use the maintenance workflow
instead.

## Load References

Read [references/instruction-file-practices.md](references/instruction-file-practices.md)
when you need the quality rubric, recommended sections, symlink rules, or source
links.

## Initialization Workflow

1. **Discover current state**
   - Check for `AGENTS.md`, `CLAUDE.md`, `AGENTS.override.md`, nested
     instruction files, and relevant `.gitignore` entries.
   - Use `ls -l` or equivalent to determine whether `CLAUDE.md` already points
     to `AGENTS.md`.
   - Do not overwrite a non-empty existing instruction file without preserving
     its content or getting explicit approval.

2. **Analyze the project**
   - Identify languages, frameworks, package managers, task runners, test
     frameworks, build tools, lint/format tools, CI workflows, deployment
     hints, and monorepo/package boundaries.
   - Prefer authoritative files: `README*`, package manifests, lockfiles,
     Makefiles, task configs, CI files, Docker files, test configs, and existing
     docs.
   - Run cheap read-only inspection commands first. Run validation commands only
     when they are safe and appropriate for the repo.

3. **Choose the file plan**
   - Default: create `AGENTS.md` at the repository root and create `CLAUDE.md`
     as a relative symlink to `AGENTS.md`.
   - If `CLAUDE.md` exists but `AGENTS.md` does not, create `AGENTS.md` from the
     existing content plus project analysis, then convert `CLAUDE.md` to a
     symlink only after preserving the original content and when the user has
     not requested separate files.
   - If both files exist and are not symlinked, inspect both, merge universal
     guidance into `AGENTS.md`, and ask before replacing either file or
     converting to a symlink.
   - Create separate files only when the user asks, a tool requires materially
     different syntax, or local policy makes symlinks unsuitable. Keep shared
     guidance duplicated or imported from one canonical source, and isolate
     file-specific notes in small labeled sections.

4. **Draft `AGENTS.md`**
   - Start with the project name and a one-paragraph purpose only if it helps an
     agent orient quickly.
   - Include only relevant sections. Favor these headings when applicable:
     `Project Overview`, `Repository Layout`, `Setup`, `Development Commands`,
     `Testing`, `Code Style`, `Architecture Notes`, `Environment`, `Security`,
     `Workflow`, `Pull Requests`, and `Known Gotchas`.
   - Use exact commands from the repo, with short explanations of when to run
     them. Mark commands as required, preferred, expensive, or optional when
     that distinction matters.
   - Document durable project-specific behavior, not one-off task notes or
     generic advice every coding agent should already know.
   - Put universal instructions first. Add `AGENTS.md`-specific or
     `CLAUDE.md`-specific notes only when the tools truly differ.

5. **Create the files**
   - Write `AGENTS.md`.
   - Unless the user wanted separate files, create `CLAUDE.md` as a relative
     symlink:

     ```bash
     ln -s AGENTS.md CLAUDE.md
     ```

   - If the platform cannot use symlinks, copy `AGENTS.md` to `CLAUDE.md` and
     add a short maintenance note in both files explaining that they should stay
     synchronized.

6. **Verify**
   - Confirm both paths resolve and contain the intended content:

     ```bash
     test -s AGENTS.md
     test -L CLAUDE.md && test "$(readlink CLAUDE.md)" = "AGENTS.md"
     ```

   - Validate every documented command as far as feasible. If a command was not
     run, say why.
   - Run `git diff -- AGENTS.md CLAUDE.md` or equivalent and review the result
     before finalizing.

## Writing Rules

- Be concise, specific, and operational. A short accurate file beats a broad
  policy document.
- Use Markdown headings and bullets. Keep commands in backticks or fenced code
  blocks.
- Prefer "when X, run Y" instructions over personality traits or slogans.
- Include success criteria and verification gates for common workflows.
- Avoid asking agents to reveal chain-of-thought. Ask for conclusions, checks,
  evidence, diffs, or concise rationale instead.
- Avoid instructions that conflict with host-agent system messages, sandbox
  rules, approval policies, or tool availability.
- Do not copy large sections from `README.md`; link or summarize only what an
  agent needs during code work.

## Output Contract

After initializing, report:

- files created or changed;
- whether `CLAUDE.md` is a symlink, separate file, or copied fallback;
- the main commands and conventions captured;
- validation performed and any commands not run.

## Examples

Good:

- "Initialize AGENTS.md and CLAUDE.md for this repo."
- "Create project memory for Codex and Claude Code."
- "Analyze the project and generate a best-practice AGENTS.md."

Near miss:

- "Add this testing note to AGENTS.md." Use the maintenance skill.
