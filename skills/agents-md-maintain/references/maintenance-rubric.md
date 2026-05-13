# Instruction File Maintenance Rubric

Last verified: 2026-05-13

## Functional Equivalence

Treat `AGENTS.md` and `CLAUDE.md` as equivalent repository instruction files.
Prefer `AGENTS.md` as the canonical cross-agent file. Use `CLAUDE.md` as a
symlink to `AGENTS.md` unless the user requests separate files or the project has
a concrete compatibility reason.

## Quality Criteria

| Criterion | Weight | Good State |
| --- | --- | --- |
| Commands/workflows | High | Exact current commands with when-to-run context |
| Architecture clarity | High | Key directories, entry points, and boundaries are findable |
| Non-obvious patterns | Medium | Gotchas, generated code, migrations, and compatibility constraints are captured |
| Conciseness | Medium | Dense, non-redundant, no generic agent advice |
| Currency | High | Paths, tools, and workflows match the current repo |
| Actionability | High | Rules can be followed and verified |
| Synchronization | Medium | `AGENTS.md` and `CLAUDE.md` are symlinked or intentionally aligned |

## Maintenance Decision Tree

1. **Is the requested change durable?**
   - Yes: add or update the instruction file.
   - No: keep it in chat or suggest a local/user memory file.

2. **Is it project-specific?**
   - Yes: shared `AGENTS.md` is appropriate.
   - Personal or machine-specific: use user/local memory, not the shared repo
     file.

3. **Is the current file too long?**
   - Remove generic prompt boilerplate and duplicated rules first.
   - Link to existing docs instead of copying large docs.
   - Keep the main file operational; move deep background elsewhere.

4. **Do `AGENTS.md` and `CLAUDE.md` differ?**
   - If divergence is accidental, merge and symlink.
   - If divergence is intentional, label the tool-specific parts and keep shared
     content consistent.

## Cleanup Targets

Remove or rewrite:

- stale commands and paths;
- TODO placeholders;
- repeated rules under different headings;
- "always be careful" style instructions without concrete behavior;
- broad claims that are not true for the repo;
- one-off task history;
- copied README sections that do not guide agent behavior;
- model-specific advice mixed into universal project policy without a reason.

Preserve:

- exact setup, test, lint, typecheck, build, release, and deploy commands;
- non-obvious architecture decisions;
- generated-code and migration rules;
- security, secrets, and production safety constraints;
- PR/commit/review conventions that the team actually follows.

## Symlink Handling

Preferred command from the repo root:

```bash
ln -s AGENTS.md CLAUDE.md
```

Before replacing a real `CLAUDE.md`, preserve useful content by merging it into
`AGENTS.md` and review the diff. Do not delete a non-symlink file without clear
approval when it contains content not already represented elsewhere.

If symlinks are not viable, copy the canonical content and add a short note such
as:

```markdown
<!-- Keep this file synchronized with AGENTS.md. -->
```

## Source-Informed Best Practices

- `AGENTS.md` is standard Markdown with no required fields; it works best as a
  predictable "README for agents".
- Codex loads global and project `AGENTS.md` files in precedence order; closer
  project files override broader guidance.
- Claude Code uses `CLAUDE.md` as persistent memory and recommends specific,
  concise, structured instructions.
- Current OpenAI GPT-5 coding guidance emphasizes explicit role/workflow
  guidance, structured tool use, testing/validation, and clean Markdown.
- Good coding-agent guidance defines success criteria, asks for verifiable
  outputs, and avoids hidden chain-of-thought requests.

## Sources

- AGENTS.md open format: https://agents.md/
- OpenAI Codex AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
- OpenAI prompt engineering for GPT-5 coding agents: https://developers.openai.com/api/docs/guides/prompt-engineering#coding
- Anthropic Claude Code memory docs: https://docs.claude.com/en/docs/claude-code/memory
- Anthropic Claude Code best practices: https://code.claude.com/docs/en/best-practices
- Anthropic claude-md-improver quality criteria: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-md-management/skills/claude-md-improver/references/quality-criteria.md
- GitHub awesome-copilot create-agentsmd skill: https://github.com/github/awesome-copilot/blob/main/skills/create-agentsmd/SKILL.md
- Karpathy guidelines skill: https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
