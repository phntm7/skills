---
name: skill-create
description: >
  Create new agent skills following the Agent Skills open standard and Claude Code conventions.
  Use when creating a new skill from scratch, adding a skill directory, or when the user asks
  to build a reusable capability for AI agents.
metadata:
  kind: leaf
---

# Skill Create

Create a new skill that follows the Agent Skills open standard, Claude Code conventions, and this project's structure. Skills must be grounded in real expertise, concise, and tested against real tasks.

## Preflight

1. **Clarify intent**: Confirm the skill's purpose, target audience (user-invoked, model-invoked, or both), and whether it runs inline or in a subagent (`context: fork`).
2. **Duplicate check**: List `.agents/skills/` and read `.agents/skills/README.md`. If a skill with overlapping functionality exists, prefer updating it (via `skill-adapt` or direct edit) over creating a new one.
3. **Symlink awareness**: `.claude/skills/` is a symlink to `.agents/skills/` in this repository. Create files under `.agents/skills/`. Either path resolves to the same location.

## Skill Anatomy

A skill is a directory with `SKILL.md` as the entrypoint:

```
<skill-name>/
├── SKILL.md           # Required: frontmatter + instructions
├── references/        # Optional: detailed docs, loaded on demand
├── scripts/           # Optional: executable code
└── assets/            # Optional: templates, data files
```

### Frontmatter

YAML frontmatter between `---` markers at the top of `SKILL.md`. Two fields are critical:

- **`name`** (required by Agent Skills spec): Lowercase letters, numbers, hyphens only. Max 64 chars. Must match the parent directory name. No consecutive hyphens, no leading/trailing hyphens.
- **`description`** (required): Max 1024 chars. This is how agents decide whether to activate the skill. Write in third person. Include both what the skill does and when to use it with specific trigger keywords.

Optional fields (Claude Code extensions):

- `metadata.kind`: Skill taxonomy — `leaf` (default), `orchestrator`, `router`, `specialist`, `delegate`
- `metadata.invokes`: Space-delimited list of skills this skill calls
- `metadata.called_by`: Space-delimited list of skills/workflows that call this one
- `disable-model-invocation`: `true` to prevent automatic activation (manual `/name` only)
- `user-invocable`: `false` to hide from `/` menu (background knowledge only)
- `allowed-tools`: Space-delimited list of pre-approved tools
- `context`: `fork` to run in an isolated subagent
- `agent`: Subagent type when `context: fork` is set (`Explore`, `Plan`, `general-purpose`, or custom)
- `model`: Override the model when skill is active
- `argument-hint`: Autocomplete hint, e.g. `[issue-number]`
- `hooks`: Hooks scoped to the skill lifecycle

### Body Content

The markdown body after frontmatter contains the skill instructions. Keep `SKILL.md` under 500 lines / ~5000 tokens. Move detailed reference material to separate files.

## Writing Effective Skills

### Description Is Everything for Discovery

The `description` carries the entire burden of triggering. Agents load only `name` + `description` at startup. If the description doesn't convey when the skill is useful, the agent won't reach for it.

- Write in **third person** ("Processes PDFs..." not "I can help you..." or "Use this to...")
- Use **imperative trigger phrasing**: "Use when..." to tell the agent when to act
- Include **specific keywords** users would naturally say, including indirect phrasings
- Be **specific about scope**: what it does AND what it does not do
- Keep under 1024 characters

Good:

```yaml
description: >
  Analyze CSV and tabular data files — compute summary statistics, add derived
  columns, generate charts, and clean messy data. Use when the user has a CSV,
  TSV, or Excel file and wants to explore, transform, or visualize the data,
  even if they don't explicitly mention "CSV" or "analysis."
```

Bad:

```yaml
description: Helps with documents
```

### Conciseness — Context Is a Public Good

The context window is shared with system prompt, conversation history, other skills, and the user's request. Every token in your skill competes for attention.

- **Add what the agent lacks, omit what it knows.** Don't explain what a PDF is. Do explain your project's specific API patterns.
- **Provide defaults, not menus.** Pick one recommended approach. Mention alternatives briefly only when needed.
- **Challenge each piece:** "Would the agent get this wrong without this instruction?" If no, cut it.

### Match Specificity to Fragility

- **High freedom** (multiple valid approaches): Use descriptive guidelines
- **Medium freedom** (preferred pattern exists): Use pseudocode or parameterized examples
- **Low freedom** (fragile/destructive operations): Use exact commands, no deviation

### Favor Procedures Over Declarations

Teach the agent _how to approach_ a class of problems, not _what to produce_ for a specific instance. The approach should generalize even when individual details are specific.

### Ground Skills in Real Expertise

Do not generate skill content from general LLM knowledge alone. Effective skills come from:

- Extracting patterns from real completed tasks (steps that worked, corrections made, context provided)
- Synthesizing from project-specific artifacts (runbooks, schemas, code review comments, incident reports)
- Iterating after real execution: run the skill, read traces, revise

## Progressive Disclosure

Structure skills so context loads incrementally:

1. **Metadata** (~100 tokens): `name` + `description` — loaded at startup for all skills
2. **Instructions** (<5000 tokens): Full `SKILL.md` body — loaded when skill activates
3. **Resources** (as needed): Reference files — loaded only when required

Reference supporting files from `SKILL.md` so the agent knows _when_ to load each:

```markdown
## References

- For API error handling patterns, see [references/api-errors.md](references/api-errors.md)
- For field mapping templates, see [assets/field-template.json](assets/field-template.json)
```

Keep file references **one level deep** from `SKILL.md`. Avoid nested reference chains.

For reference files over 100 lines, include a table of contents at the top.

## String Substitutions

Skills support dynamic values in content:

- `$ARGUMENTS` — all arguments passed when invoking
- `$ARGUMENTS[N]` or `$N` — positional argument (0-based)
- `${CLAUDE_SESSION_ID}` — current session ID
- `${CLAUDE_SKILL_DIR}` — directory containing the skill's `SKILL.md`

Dynamic context injection: `` !`command` `` runs shell commands before content is sent to the agent. Output replaces the placeholder.

## Creation Procedure

1. **Create directory**: `.agents/skills/<name>/`
2. **Write `SKILL.md`** with frontmatter and body following the structure above
3. **Add supporting files** if needed (references, scripts, assets)
4. **Update index**: Add the new skill to `.agents/skills/README.md` if it exists
5. **Update AGENTS.md**: If the skill should appear in the Skill Taxonomy or session skill list, add it to `AGENTS.md` under the appropriate section
6. **Test**: Invoke the skill against a real task. Check that it triggers on relevant prompts and does not trigger on irrelevant ones

### Structural Template

```yaml
---
name: <kebab-case-name>
description: >
  <What it does>. Use when <trigger conditions>,
  <additional trigger keywords or contexts>.
metadata:
  kind: leaf
---

# <Title>

<One-paragraph overview of what the skill does and the approach it takes.>

## Procedure

1. **Step one**: ...
2. **Step two**: ...

## Guardrails

- <Constraint or boundary>
- <What the skill must NOT do>

## Related Skills

- `<related-skill-name>`
```

## Patterns Worth Using

- **Checklists** for multi-step workflows — helps the agent track progress
- **Validation loops** — do work, run validator, fix, repeat until clean
- **Plan-validate-execute** — create intermediate plan, validate against source of truth, then execute
- **Templates** for output format — agents pattern-match concrete structures better than prose descriptions
- **Input/output examples** — show expected behavior, like few-shot prompting
- **Bundled scripts** — if the agent reinvents the same logic each run, write a tested script once

## Guardrails

- **No narratives**: Keep it actionable. No "In this session we decided..."
- **No time-sensitive content**: Use "current method" / "legacy method" sections instead of dates
- **Consistent terminology**: Pick one term per concept and use it throughout
- **No deeply nested references**: All reference files link directly from `SKILL.md`
- **Forward slashes only**: Use `scripts/helper.py`, not `scripts\helper.py`
- **Preserve project conventions**: Skills must not contradict `AGENTS.md` or project norms

## Reference

- Agent Skills Specification: https://agentskills.io/specification
- Best Practices for Skill Creators: https://agentskills.io/skill-creation/best-practices
- Optimizing Skill Descriptions: https://agentskills.io/skill-creation/optimizing-descriptions
- Using Scripts in Skills: https://agentskills.io/skill-creation/using-scripts
- Claude Code Skills: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Claude Skill Authoring Best Practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- OpenAI Codex Skills: https://developers.openai.com/codex/skills/
