---
name: agents-md-maintain
description: >
  Maintain, update, audit, refactor, clean up, merge, or synchronize AGENTS.md
  and CLAUDE.md project instruction files. Use when a user asks to add a rule,
  remove stale guidance, improve project memory, review agent instructions,
  manage CLAUDE.md, manage AGENTS.md, or keep both files in sync.
---

# AGENTS.md Maintain

Use this skill to improve existing coding-agent instruction files while
preserving their intent. Treat `AGENTS.md` and `CLAUDE.md` as equivalent
instruction files: prefer shared universal content, keep `AGENTS.md` canonical
when possible, and keep `CLAUDE.md` as an `@AGENTS.md` import wrapper unless the
user wants separate files.

## When To Use

- The user asks to add, change, remove, refactor, reorganize, clean up, audit,
  or optimize `AGENTS.md`, `CLAUDE.md`, or project memory.
- Existing instruction files are stale, duplicated, too verbose, contradictory,
  missing commands, or out of sync.
- The user wants `AGENTS.md` and `CLAUDE.md` to be reconciled or converted to a
  canonical import setup.

If the project has no instruction file and the user wants one created from
scratch, use the initialization workflow instead.

## Load References

Read [references/maintenance-rubric.md](references/maintenance-rubric.md) when
you need the quality rubric, cleanup rules, report format, or source links.

## Related Skills

When evaluating phrasing quality or rewriting rules, also use the `prompt-craft`
skill for general prompting principles: motivating constraints, "when X, do Y"
rules, output contracts, and anti-patterns. `AGENTS.md` and `CLAUDE.md` are
additions to the system prompt, so prompting guidance applies.

## Maintenance Workflow

1. **Discover instruction files**
   - Find root and nested `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`,
     `.claude/CLAUDE.md`, `.claude/rules/`, and `CLAUDE.local.md`.
   - For audit work, account for Claude Code's full memory scope: managed policy
     files (`/Library/Application Support/ClaudeCode/CLAUDE.md`,
     `/etc/claude-code/CLAUDE.md`, or
     `C:\Program Files\ClaudeCode\CLAUDE.md`), project files,
     `~/.claude/CLAUDE.md`, and local gitignored `CLAUDE.local.md`.
   - Determine whether `CLAUDE.md` imports `@AGENTS.md`, is a symlink, is
     duplicated content, divergent, or intentionally separate.

2. **Classify the request**
   - **Add**: insert a durable project rule, command, gotcha, or workflow note.
   - **Refactor/clean up**: reduce duplication, improve headings, remove stale
     or generic guidance, and tighten wording.
   - **Audit**: score quality and recommend targeted changes.
   - **Synchronize**: merge universal content into `AGENTS.md` and make
     `CLAUDE.md` import `@AGENTS.md` when appropriate.
   - **Split**: keep files separate only when the user requests it or a tool
     genuinely needs different syntax.

3. **Ground changes in the project**
   - Verify commands, paths, package names, CI workflows, and architecture notes
     against the repository before adding or keeping them.
   - Prefer authoritative project files over memories or old instructions.
   - When asked to add user-supplied guidance, integrate it with the existing
     structure instead of appending a disconnected note.

4. **Edit conservatively**
   - Preserve useful existing conventions and section order.
   - Remove or rewrite stale, generic, contradictory, or one-off content.
   - Keep most instructions universal for both `AGENTS.md` and `CLAUDE.md`.
   - Place file-specific notes under small explicit headings only when needed,
     for example `Claude Code Notes` or `Codex Notes`.
   - Move Claude-only path-scoped rules to `.claude/rules/` with `paths`
     frontmatter when that keeps the main file smaller.
   - If a rule must execute at a fixed lifecycle point, prefer a hook over a
     memory-file instruction. If a workflow is task-specific, prefer a skill.
   - Avoid unrelated rewrites. Every changed line should trace to the user's
     request or to keeping the instruction files accurate.

5. **Synchronize files**
   - Preferred state:

     ```text
     AGENTS.md
     CLAUDE.md  # contains @AGENTS.md plus optional Claude-specific notes
     ```

   - If both files contain useful divergent content, merge universal guidance
     into `AGENTS.md`, preserve truly Claude-specific notes under `## Claude
     Code`, then reduce `CLAUDE.md` to an import wrapper.
   - Use a symlink only when the user explicitly prefers it, there is no
     Claude-specific content, and the OS supports symlinks without elevated
     privileges. On Windows, use `@AGENTS.md` instead.

6. **Verify**
   - Confirm imports, symlinks, and target content resolve as intended.
   - Re-run or at least inspect commands affected by the edit. If a listed
     command was not validated, say so.
   - Review the diff before finalizing and ensure no unrelated content changed.

## Audit Report

When the user asks for a review or audit, report findings before edits unless
they explicitly asked you to directly fix the file.

Use this compact format:

```markdown
## Instruction File Audit

### Summary
- Files found: X
- Canonical state: AGENTS.md / CLAUDE.md imports @AGENTS.md / separate files
- Score: N/100, grade A-F
- Main risks: ...

### Findings
- [critical|important|minor] [file]: [problem] -> [specific fix]

### Proposed Changes
- [target file]: [change and why it helps future sessions]
```

## Writing Rules

- Prefer precise, executable guidance: exact commands, paths, ownership
  boundaries, and verification gates.
- Keep the file short enough to be read every session. Move long background
  material to referenced docs; target under 200 lines for each loaded
  instruction file.
- Use "when X, do Y" rules and short rationale for unusual constraints.
- Remove generic prompt boilerplate, motivational language, duplicated rules,
  stale command lists, and large README copies.
- Do not ask agents for hidden chain-of-thought. Ask for plans, checks, file
  citations, diffs, and concise rationale.
- Do not encode local secrets, personal preferences, or machine-specific paths
  in shared repo files. Put personal notes in the appropriate local/user memory
  file instead.

## Output Contract

After making changes, report:

- files changed and whether import/canonical state changed;
- whether `CLAUDE.md` imports `@AGENTS.md`, is a symlink, or is separate;
- what guidance was added, removed, or reorganized;
- validation performed;
- unresolved assumptions or commands not run.

## Examples

Good:

- "Add a note to AGENTS.md that migrations must be reversible."
- "Clean up CLAUDE.md and remove stale commands."
- "Audit our project memory and make AGENTS.md the canonical file."
- "Keep CLAUDE.md in sync with AGENTS.md."

Near miss:

- "Create AGENTS.md for this new repo." Use the initialization skill.
