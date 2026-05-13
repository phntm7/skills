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
when possible, and keep `CLAUDE.md` symlinked to `AGENTS.md` unless the user
wants separate files.

## When To Use

- The user asks to add, change, remove, refactor, reorganize, clean up, audit,
  or optimize `AGENTS.md`, `CLAUDE.md`, or project memory.
- Existing instruction files are stale, duplicated, too verbose, contradictory,
  missing commands, or out of sync.
- The user wants `AGENTS.md` and `CLAUDE.md` to be reconciled or converted to a
  symlink/canonical-file setup.

If the project has no instruction file and the user wants one created from
scratch, use the initialization workflow instead.

## Load References

Read [references/maintenance-rubric.md](references/maintenance-rubric.md) when
you need the quality rubric, cleanup rules, report format, or source links.

## Maintenance Workflow

1. **Discover instruction files**
   - Find root and nested `AGENTS.md`, `CLAUDE.md`, `AGENTS.override.md`,
     `.claude/CLAUDE.md`, and related local variants.
   - Resolve symlinks before editing. If `CLAUDE.md` points to `AGENTS.md`,
     edit the target once.
   - Identify whether files are canonical/symlinked, duplicated, divergent, or
     intentionally separate.

2. **Classify the request**
   - **Add**: insert a durable project rule, command, gotcha, or workflow note.
   - **Refactor/clean up**: reduce duplication, improve headings, remove stale
     or generic guidance, and tighten wording.
   - **Audit**: score quality and recommend targeted changes.
   - **Synchronize**: merge universal content and make `CLAUDE.md` a symlink to
     `AGENTS.md` when appropriate.
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
   - Avoid unrelated rewrites. Every changed line should trace to the user's
     request or to keeping the instruction files accurate.

5. **Synchronize files**
   - Preferred state:

     ```text
     AGENTS.md
     CLAUDE.md -> AGENTS.md
     ```

   - If both files contain useful divergent content, merge universal guidance
     into `AGENTS.md`, preserve any truly file-specific notes, then ask before
     deleting/replacing a non-symlink `CLAUDE.md`.
   - If symlinks are unsuitable, keep the two files textually aligned and add a
     brief maintenance note.

6. **Verify**
   - Confirm symlinks and target content resolve as intended.
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
- Canonical state: AGENTS.md / CLAUDE.md symlink / separate files
- Main risks: ...

### Findings
- [severity] [file]: [problem] -> [specific fix]

### Proposed Changes
- [target file]: [change and why it helps future sessions]
```

## Writing Rules

- Prefer precise, executable guidance: exact commands, paths, ownership
  boundaries, and verification gates.
- Keep the file short enough to be read every session. Move long background
  material to referenced docs.
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

- files changed and whether symlink/canonical state changed;
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
