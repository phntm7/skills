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
files: prefer `AGENTS.md` as the canonical shared file and make `CLAUDE.md`
import it with `@AGENTS.md` unless the user explicitly wants another setup.

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
when you need the quality rubric, recommended sections, import/symlink rules, or
source links.

## Initialization Workflow

1. **Discover current state**
   - Check for `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`,
     `CLAUDE.local.md`, `AGENTS.override.md`, `.claude/rules/`, nested
     instruction files, and relevant `.gitignore` entries.
   - Determine whether `CLAUDE.md` imports `@AGENTS.md`, is a symlink, is
     duplicated content, or is intentionally separate.
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
     containing `@AGENTS.md`, followed by any Claude-specific notes.
   - If `CLAUDE.md` exists but `AGENTS.md` does not, create `AGENTS.md` from the
     existing content plus project analysis, then reduce `CLAUDE.md` to an
     import wrapper with any truly Claude-specific content preserved.
   - If both files exist but are not aligned, inspect both, merge universal
     guidance into `AGENTS.md`, and keep `CLAUDE.md` as an import wrapper unless
     the user wants separate files.
   - Use a symlink only when the user explicitly prefers it, there is no
     Claude-specific content to add, and the operating system supports symlinks
     without elevated privileges. On Windows, use `@AGENTS.md` instead.
   - Create separate full files only when the user asks or a tool requires
     materially different syntax. Keep shared guidance in `AGENTS.md` and
     isolate file-specific notes in small labeled sections.

4. **Draft `AGENTS.md`**
   - Start with the project name and a one-paragraph purpose only if it helps an
     agent orient quickly.
   - Include only relevant sections and target under 200 lines for each loaded
     instruction file. Favor a compact core: `Project Overview`,
     `Repository Layout`, `Setup`, `Development Commands`, `Testing`, and
     `Architecture Notes`. Add `Security`, `Environment`, `Workflow`, or
     `Known Gotchas` only when they contain project-specific guidance.
   - Use exact commands from the repo, with short explanations of when to run
     them. Mark commands as required, preferred, expensive, or optional when
     that distinction matters.
   - Document durable project-specific behavior, not one-off task notes or
     generic advice every coding agent should already know.
   - Put universal instructions first. Add `AGENTS.md`-specific or
     `CLAUDE.md`-specific notes only when the tools truly differ.
   - For Claude-only instructions that apply only to certain paths, prefer
     `.claude/rules/` with `paths` frontmatter instead of bloating the main
     file.

5. **Create the files**
   - Write `AGENTS.md`.
   - Unless the user requested separate files, write `CLAUDE.md` as an import
     wrapper:

     ```markdown
     @AGENTS.md

     ## Claude Code

     [Claude-specific notes, only when needed.]
     ```

   - If running inside Claude Code, this skill replaces or extends the built-in
     `/init` flow with a portable `AGENTS.md`-first variant. Claude Code's
     built-in `/init` can also read an existing `AGENTS.md`, and
     `CLAUDE_CODE_NEW_INIT=1` enables its interactive multi-phase init flow.

6. **Verify**
   - Confirm both paths resolve and contain the intended content:

     ```bash
     test -s AGENTS.md
     test -s CLAUDE.md
     grep -q '^@AGENTS.md$' CLAUDE.md || test -L CLAUDE.md
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
- If a rule must run at a fixed lifecycle point, document or create a hook
  instead of relying only on an instruction file.
- For task-specific procedures that do not need to load every session, create a
  skill instead of adding more content to `AGENTS.md` or `CLAUDE.md`.
- Avoid asking agents to reveal chain-of-thought. Ask for conclusions, checks,
  evidence, diffs, or concise rationale instead.
- Avoid instructions that conflict with host-agent system messages, sandbox
  rules, approval policies, or tool availability.
- Do not copy large sections from `README.md`; link or summarize only what an
  agent needs during code work.

## Output Contract

After initializing, report:

- files created or changed;
- whether `CLAUDE.md` imports `@AGENTS.md`, is a symlink, or is separate;
- the main commands and conventions captured;
- validation performed and any commands not run.

## Examples

Good:

- "Initialize AGENTS.md and CLAUDE.md for this repo."
- "Create project memory for Codex and Claude Code."
- "Analyze the project and generate a best-practice AGENTS.md."

Near miss:

- "Add this testing note to AGENTS.md." Use the maintenance skill.
