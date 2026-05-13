# Portable Skill Format

Last verified: 2026-05-13

## Skill Anatomy

```text
<skill-name>/
  SKILL.md       # required
  references/    # optional, loaded on demand
  scripts/       # optional, executable helpers
  assets/        # optional, templates or static files
  agents/        # optional, platform UI metadata
```

`SKILL.md` is the portable entrypoint. Other files must support the skill directly.

## Frontmatter

Portable minimum:

```yaml
---
name: <skill-name>
description: >
  <Capability>. Use when <trigger conditions>.
---
```

Rules:

- `name` is required, must be lower-case kebab-case, and should match the parent directory.
- `description` is required and should stay under 1024 characters.
- `compatibility` is optional and must stay under 500 characters when present.
- `allowed-tools` is an optional experimental field in the Agent Skills spec. Use it only when the target agents support it.
- `metadata` is optional and may hold key-value metadata. Treat metadata as advisory unless a target platform explicitly documents a consumer.
- Write descriptions for discovery. Agents see descriptions before they load the skill body.
- Use optional fields sparingly. Different agents support different extensions.

## Body

Good skill bodies include:

- a concise overview;
- a procedure or decision tree;
- guardrails and failure handling;
- references to bundled resources and when to load them;
- output contracts or examples when format matters.

Avoid:

- long background narratives;
- implementation history;
- redundant README-style installation docs;
- platform-specific instructions in the universal path;
- deeply nested reference chains.

## Progressive Disclosure

Design for three loading levels:

1. `name` and `description` for discovery.
2. `SKILL.md` for core operating instructions.
3. `references/`, `scripts/`, and `assets/` only when the task needs them.

Keep `SKILL.md` under 500 lines and roughly 5000 tokens where possible. Keep file references one level deep from `SKILL.md`; if it grows, move variant-specific detail into directly linked references.

## Resources

Use `scripts/` when a task needs deterministic behavior or repeated code. Test scripts before shipping them.

Use `references/` for long context that should be loaded only when relevant: API docs, schemas, style guides, eval rubrics, platform notes, or model-specific guidance.

Use `assets/` for files that are copied or used in outputs: templates, sample data, logos, fonts, boilerplate, or document shells.

## Naming

- Normalize titles to lowercase hyphen-case.
- Prefer short names that describe the action or domain.
- Avoid names that collide with common built-in skills unless intentionally replacing one.
- Keep names stable after publishing; renaming breaks explicit invocation habits.

## Sources

- Agent Skills Specification: https://agentskills.io/specification
- Agent Skills reference validator: https://github.com/agentskills/agentskills/tree/main/skills-ref
- Codex skills: https://developers.openai.com/codex/skills/
- Claude Code skills: https://code.claude.com/docs/en/skills
- OpenCode skills: https://opencode.ai/docs/skills/
