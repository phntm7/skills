---
name: skill-create
description: >
  Create, review, or improve portable Agent Skills for Codex, Claude Code,
  OpenCode, skills.sh, and other SKILL.md-compatible agents. Use when building
  a new skill, updating an existing skill, designing trigger descriptions,
  adding scripts/references/assets, validating skill structure, or turning a
  repeated workflow into reusable agent instructions.
---

# Skill Create

Use this skill to create portable skills that work across agents instead of locking the skill to one runtime. Start with the shared `SKILL.md` contract, then add platform-specific metadata only when the user explicitly needs that platform behavior.

## Reference Selection

- For the portable skill contract, naming rules, frontmatter, and resource layout, read [references/portable-skill-format.md](references/portable-skill-format.md).
- For Codex, Claude Code, OpenCode, and `skills.sh` compatibility notes, read [references/platform-notes.md](references/platform-notes.md).
- For testing, trigger evals, and iteration, read [references/evaluation.md](references/evaluation.md).

## Related Skills

When writing the skill `description`, the `SKILL.md` body, or any other prose
the host agent will read, also use the `prompt-craft` skill for prompting
principles: front-loading trigger words, output contracts, and anti-patterns.
`SKILL.md` is LLM-facing prose.

## Default Output Location

In this repo, create or update skills under `skills/<skill-name>/`. Do not create duplicate canonical copies under `.agents/skills`, `.claude/skills`, or `.opencode/skills` unless the user asks for a platform-local install test.

Use `scripts/init_skill.py` to scaffold a new skill when starting from scratch. It creates `agents/openai.yaml` by default for Codex UI metadata; use `--no-codex-metadata` when the user wants the portable minimum only.

## Creation Workflow

1. **Capture intent from examples**: Identify the repeated workflow, target users, likely user phrasing, expected outputs, required tools, and failure modes. Extract examples from the conversation before asking new questions.
2. **Check overlap**: Inspect existing skills before creating a new one. If a skill overlaps heavily, update it instead of adding a near-duplicate.
3. **Choose the resource shape**:
   - Use only `SKILL.md` for short procedural guidance.
   - Add `references/` for long docs, schemas, platform notes, or variant-specific guidance.
   - Add `scripts/` when repeated code, deterministic validation, or fragile file manipulation would otherwise be rewritten each run.
   - Add `assets/` for templates, images, boilerplate, data files, or files copied into outputs.
4. **Draft the skill**: Write frontmatter, then concise instructions. Keep `SKILL.md` focused on the core workflow and link to references for details.
5. **Add metadata**: Add `agents/openai.yaml` for Codex UI metadata in this repo. Add Claude/OpenCode-specific fields only when needed and documented in platform notes.
6. **Validate**: Run `python3 scripts/validate_skill.py <skill-dir>` from this skill directory or an equivalent validator.
7. **Test with real prompts**: Create 2-5 realistic prompts that should trigger the skill and at least 2 near-miss prompts that should not.
8. **Iterate**: Improve from observed failures. Do not overfit to one example; generalize the underlying pattern.

## Frontmatter Rules

Use the portable minimum by default:

```yaml
---
name: <kebab-case-name>
description: >
  <What the skill does>. Use when <specific trigger contexts and user phrasing>.
---
```

- `name` must match the folder name, use lowercase letters/digits/hyphens, avoid leading/trailing hyphens, avoid repeated hyphens, and stay under 64 characters.
- `description` is the trigger surface. Include both capability and when to use it. Name specific artifacts, file types, platforms, and user phrasing that should trigger the skill.
- Keep descriptions under 1024 characters. Front-load the most important trigger words.
- Avoid platform-only frontmatter in the default path. Put platform-specific behavior in references or add it only when the user asks.

## Writing Guidance

- Make the skill actionable, not narrative. Write procedures, decision rules, templates, and guardrails.
- Explain why important constraints exist so the receiving agent can generalize.
- Match specificity to risk: broad guidance for judgment-heavy work, exact commands for fragile workflows.
- Put long examples, API docs, schemas, and model-specific advice in references. Link each reference from `SKILL.md` with clear loading criteria.
- Do not include general docs such as README, changelog, installation notes, or design-history files inside a skill unless they are actively used by the skill.
- Prefer stable commands and local scripts over instructions that make every agent reinvent the same code.
- Keep all paths with forward slashes.

## Description Checklist

Before finalizing `description`, check:

- Would an agent know when to use this skill from `name` and `description` alone?
- Does it include common user phrases, indirect phrasing, and relevant file/tool names?
- Does it avoid claiming adjacent work that belongs to another skill?
- Does it include near-boundaries where the skill should not trigger if those boundaries matter?
- Is it concise enough to survive truncation in a large skill catalog?

## Review Checklist

Before declaring the skill done:

- `SKILL.md` has valid frontmatter and a body that can stand alone.
- Every linked `references/` file exists and is directly linked from `SKILL.md`.
- Every script is executable or has a clear command, and representative scripts have been run.
- Placeholder text has been removed.
- Optional platform metadata matches the skill content.
- At least one realistic prompt has been mentally or actually run against the skill.
- The validator passes.

## Useful Commands

From this skill directory:

```bash
python3 scripts/init_skill.py <skill-name> --path ../../skills --resources references
python3 scripts/validate_skill.py ../../skills/<skill-name>
```

From the repo root:

```bash
DISABLE_TELEMETRY=1 npx --yes skills add . --list
```

## Sources

- Agent Skills Specification: https://agentskills.io/specification
- Anthropic skill creator: https://github.com/anthropics/skills/tree/main/skills/skill-creator
- OpenAI skill creator: https://github.com/openai/skills/tree/main/skills/.system/skill-creator
- Codex skills: https://developers.openai.com/codex/skills/
- Codex plugins: https://developers.openai.com/codex/plugins/build
- Claude Code skills: https://code.claude.com/docs/en/skills
- Claude Code plugins: https://code.claude.com/docs/en/plugins
- OpenCode skills: https://opencode.ai/docs/skills/
- skills CLI: https://www.skills.sh/docs/cli
