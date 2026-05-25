# Skill Evaluation

Last verified: 2026-05-19

## Purpose

Evaluate skills with realistic prompts before treating them as reusable. The goal is not to prove perfection; it is to catch missing instructions, weak trigger descriptions, unnecessary context, and repeated work that should become a script or reference.

## Lightweight Default

For most personal skills:

1. Write 2-5 should-trigger prompts that resemble real user requests.
2. Write 2-3 near-miss prompts that share vocabulary but should not trigger the skill.
3. Run or mentally simulate at least one should-trigger prompt.
4. Check whether the agent would load the right references, use bundled scripts, and produce the expected output.
5. Revise the description and instructions from observed failures.

## Stronger Evaluation Loop

Use this when the skill has objective outputs, expensive consequences, or will be reused often:

- Compare output with and without the skill.
- Grade against concrete expectations.
- Ask the user to review qualitative outputs before optimizing.
- Track pass/fail, time, and token cost across iterations.
- Use blind comparisons when two skill versions both look plausible.

## Semantic Review

Before declaring a reusable skill ready, review the prompt text as an LLM-facing
instruction set, not just as Markdown. Run this as a manual checklist or with an
LLM reviewer when the skill is complex:

- **Contradictions**: instructions that pull the agent toward incompatible
  behavior, tools, formats, or safety boundaries.
- **Ambiguity**: vague terms, missing precedence, unclear scope, or undefined
  nouns such as "it", "the file", "the current repo", or "the output".
- **Persona and tone drift**: conflicting voice, authority level, verbosity, or
  collaboration style.
- **Cognitive load**: too many nested conditions, long exception lists, repeated
  rules in different sections, or decision trees that should become a table.
- **Semantic coverage**: missing paths for invalid input, missing files, absent
  tools, permission limits, failed validation, partial success, or user
  ambiguity.
- **Portable-skill fit**: host-specific assumptions, absolute local paths,
  platform-only fields, or commands that should be conditional.

For each issue, prefer a precise fix over broad rewriting. Preserve the skill's
intent and change only the section that caused the diagnostic.

## Composition Review

When `SKILL.md` links to `references/`, `scripts/`, or `assets/`, check the
composed skill rather than the entrypoint alone:

- Every referenced file exists and is linked directly from `SKILL.md`.
- `SKILL.md` states when to load each reference; references are not mandatory
  reading unless the task needs them.
- Reference files do not contradict the core workflow, frontmatter trigger, or
  repo conventions.
- Platform-specific notes stay in references unless the skill intentionally
  targets one runtime.
- Scripts named in prose have deterministic commands, clear inputs, and have
  been run or marked untested.

If two files conflict, fix the most durable source of truth first. In this repo,
`skills/<skill>/SKILL.md` is the portable entrypoint and root `AGENTS.md` defines
repo layout conventions.

## Trigger Evaluation

Good trigger queries are realistic and include context. Avoid trivial examples.

Should-trigger examples should cover:

- direct requests;
- indirect phrasing;
- typos or casual language;
- adjacent tasks where this skill should still win;
- file types, platform names, or tool names that matter.

Should-not-trigger examples should be near misses:

- shared keywords but different intent;
- adjacent domains owned by another skill;
- simple tasks that the base agent can handle without the skill.

Minimal trigger-eval template:

```yaml
should_trigger:
  - "Create a new skill for converting CSV files to JSON."
  - "Help me write a SKILL.md for deploy automation."
should_not_trigger:
  - "Edit the README of my project."
  - "Create a JSON file from this one-off data sample."
```

For reusable eval files, start from [../assets/trigger-eval-template.yaml](../assets/trigger-eval-template.yaml).

## Optional Eval Scaffold

For skills that will be published, delegated to other agents, or used in risky
workflows, keep reusable evals beside the repo rather than only in chat notes.
A lightweight structure is:

```text
evals/
  <skill-name>/
    eval.yaml
    tasks/
      should-trigger.yaml
      should-not-trigger.yaml
      edge-cases.yaml
    fixtures/      # optional files copied into test workspaces
    snapshots/     # optional expected files or diffs
```

Good eval tasks state:

- the user prompt or scenario;
- whether the skill should trigger;
- expected references, scripts, tools, or files touched;
- required output properties;
- forbidden behavior;
- validation commands or graders.

Useful grader categories include:

- **trigger**: the skill should or should not be selected for a prompt.
- **text/schema**: the output includes required fields, sections, or JSON shape.
- **file/diff**: expected files are created or edited.
- **tool/action sequence**: required or forbidden tools and command patterns.
- **behavior budget**: max tool calls, runtime, or excessive output length.
- **program/script**: run deterministic validators supplied by the skill.

Treat eval scaffolds as living regression tests. Keep initial suites small:
2-5 positive triggers, 2-3 near misses, and 1-3 edge cases that previously
failed or are costly to get wrong.

## Avoid Overfitting

- Do not add a rule that only fixes one eval unless the rule generalizes.
- Prefer explaining why a behavior matters over adding rigid "always/never" rules.
- If agents repeatedly write the same helper code, promote that code into `scripts/`.
- If agents repeatedly search for the same reference, promote that knowledge into `references/`.
- If a semantic diagnostic is noisy, improve the rubric or eval input instead of
  adding defensive prose to every skill.

## Sources

- Anthropic skill creator eval workflow: https://github.com/anthropics/skills/tree/main/skills/skill-creator
- OpenAI skill creator validation workflow: https://github.com/openai/skills/tree/main/skills/.system/skill-creator
- Agent Skills reference validator: https://github.com/agentskills/agentskills/tree/main/skills-ref
- Microsoft Chat Customizations Evaluations: https://github.com/microsoft/vscode-chat-customizations-evaluation
