# Instruction File Maintenance Rubric

Last verified: 2026-05-13

## Functional Equivalence

Treat `AGENTS.md` and `CLAUDE.md` as equivalent repository instruction files.
Prefer `AGENTS.md` as the canonical cross-agent file. Use `CLAUDE.md` as an
import wrapper containing `@AGENTS.md` plus optional Claude-specific content
unless the user requests separate files or the project has a concrete
compatibility reason.

## Quality Criteria

Score audits on a 100-point scale:

| Criterion | Points | Full credit |
| --- | ---: | --- |
| Commands/workflows | 20 | Essential build, test, lint, deploy, and common workflow commands are documented with context |
| Architecture clarity | 20 | Key directories, module relationships, entry points, and relevant data flow are clear |
| Non-obvious patterns | 15 | Gotchas, quirks, workarounds, edge cases, and unusual "why" decisions are captured |
| Conciseness | 15 | Dense, valuable content with no filler, duplicated rules, or obvious restatements |
| Currency | 15 | Commands work, paths exist, file references are accurate, and stack details are current |
| Actionability | 15 | Instructions are concrete, executable, and verifiable |

Use partial scores of 75%, 50%, 25%, or 0% for each criterion when the file is
incomplete. Assign grades with `A` = 90-100, `B` = 80-89, `C` = 70-79,
`D` = 60-69, and `F` below 60. Report synchronization/import state separately
from the score because it is a packaging concern, not instruction quality.

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
   - If divergence is accidental, merge universal content into `AGENTS.md` and
     make `CLAUDE.md` import it.
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
- personal preferences or machine-specific paths in the shared file;
- model-specific advice mixed into universal project policy without a reason.

Preserve:

- exact setup, test, lint, typecheck, build, release, and deploy commands;
- non-obvious architecture decisions;
- generated-code and migration rules;
- security, secrets, and production safety constraints;
- PR/commit/review conventions that the team actually follows.

## CLAUDE.md Import Handling

Preferred `CLAUDE.md` content from the repo root:

```markdown
@AGENTS.md

## Claude Code

[Claude-specific notes, only when needed.]
```

Before replacing a real `CLAUDE.md`, preserve useful universal content by
merging it into `AGENTS.md`, preserve truly Claude-specific content under
`## Claude Code`, and review the diff.

Use a symlink only when the user explicitly prefers it, there is no
Claude-specific content, and the OS supports symlinks without elevated
privileges:

```bash
ln -s AGENTS.md CLAUDE.md
```

On Windows, use `@AGENTS.md` instead of copying content or relying on symlinks.
Block-level HTML comments in `CLAUDE.md` are stripped before context injection,
so they can hold maintainer notes without spending context.

## Source-Informed Best Practices

- `AGENTS.md` is standard Markdown with no required fields; it works best as a
  predictable "README for agents".
- Codex loads global and project `AGENTS.md` files in precedence order; closer
  project files override broader guidance.
- Claude Code uses `CLAUDE.md` as persistent memory and recommends specific,
  concise, structured instructions under 200 lines per file.
- Claude Code imports files with `@path`, supports `./.claude/CLAUDE.md`,
  `CLAUDE.local.md`, and `.claude/rules/`, and can exclude irrelevant files in
  monorepos with `claudeMdExcludes`.
- Claude Code auto memory is separate from user-written `CLAUDE.md` and lives at
  `~/.claude/projects/<project>/memory/`.
- Current OpenAI GPT-5 coding guidance emphasizes explicit role/workflow
  guidance, structured tool use, testing/validation, and clean Markdown.
- Good coding-agent guidance defines success criteria, asks for verifiable
  outputs, and avoids hidden chain-of-thought requests.
- Rules that must run at fixed lifecycle points belong in hooks. Task-specific
  procedures that should not load every session belong in skills. Scripted
  system-level behavior can use `--append-system-prompt`.

## Sources

- AGENTS.md open format: https://agents.md/
- OpenAI Codex AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
- OpenAI prompt engineering for GPT-5 coding agents: https://developers.openai.com/api/docs/guides/prompt-engineering#coding
- Anthropic Claude Code memory docs: https://code.claude.com/docs/en/memory
- Anthropic Claude Code best practices: https://code.claude.com/docs/en/best-practices
- Anthropic Claude Code skills: https://code.claude.com/docs/en/skills
- Anthropic Claude Code hooks: https://code.claude.com/docs/en/hooks-guide
- Anthropic Claude Code CLI reference: https://code.claude.com/docs/en/cli-reference
- Anthropic claude-md-improver quality criteria: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-md-management/skills/claude-md-improver/references/quality-criteria.md
- GitHub awesome-copilot create-agentsmd skill: https://github.com/github/awesome-copilot/blob/main/skills/create-agentsmd/SKILL.md
- Karpathy guidelines skill: https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
