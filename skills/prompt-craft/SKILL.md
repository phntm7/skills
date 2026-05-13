---
name: prompt-craft
description: >
  Create, review, and improve prompts, system instructions, agent skills,
  AGENTS.md, CLAUDE.md, tool descriptions, and model-facing guidance. Use when
  writing prompts for modern LLMs, adapting prompts for specific models, or
  applying universal prompting practices across coding agents and chat models.
metadata:
  kind: specialist
---

# Prompt Craft

Use this skill to write prompts that are clear, testable, and portable across modern LLMs. Start with the universal guidance below, then read a model-specific reference only when the prompt targets that model family or the user asks for model-specific tuning.

## Reference Selection

- OpenAI GPT-5.5 or GPT-5.4: read [references/openai-gpt-5.md](references/openai-gpt-5.md).
- Claude Opus 4.7 or Claude Code: read [references/claude-opus-4.7.md](references/claude-opus-4.7.md).
- Gemini 3 / Gemini 3.1 Pro: read [references/gemini-3.md](references/gemini-3.md).
- Kimi / Kimi K2.6: read [references/kimi.md](references/kimi.md).
- Qwen / Qwen3.6: read [references/qwen.md](references/qwen.md).
- Smaller or cheaper models: read [references/small-models.md](references/small-models.md).

Model-specific guidance changes quickly. When the user asks for the latest guidance, verify the primary docs before relying on these references.

## Universal Prompt Structure

Write prompts in this order unless the target model's guide says otherwise:

1. **Role and operating context**: The model's job, audience, authority level, and relevant environment.
2. **Goal**: The exact outcome the model should produce.
3. **Inputs and sources**: Clearly labeled documents, files, links, examples, or tool outputs.
4. **Constraints**: What must be preserved, avoided, assumed, cited, or verified.
5. **Workflow rules**: Tool use, planning, ambiguity handling, permission boundaries, and stopping rules.
6. **Output contract**: Required sections, schema, tone, length, citation style, and failure format.
7. **Examples**: Add one or two representative examples when format, style, or edge behavior matters.

Prefer Markdown headings or XML-style tags to separate instructions from data. Use stable labels such as `# Context`, `# Task`, `# Constraints`, and `# Output`.

## Prompting Principles

- State the desired outcome before process details. Add step-by-step procedure only when the path matters.
- Define "done": success criteria, acceptance checks, and when to stop, ask, retry, or abstain.
- Put critical restrictions close to the task or final instruction so they are less likely to be dropped.
- Separate data from instructions. Label user-provided content as context, source material, examples, or tool output.
- Prefer positive instructions and examples over long lists of prohibitions.
- Include enough context to remove ambiguity, but remove stale scaffolding, duplicate rules, and motivational filler.
- Use examples for formats, tone, tool routing, refusal/abstention behavior, and edge cases.
- For grounded work, state which sources are authoritative and what to do when the answer is not present.
- For tool-using agents, describe when to use tools, what side effects are allowed, retry limits, verification requirements, and what evidence must be returned.
- For long-running agents, define persistence, progress updates, compaction/state handoff, and escalation rules.

## Prompt Review Checklist

Before finalizing a prompt, check:

- The trigger, audience, and desired output are explicit.
- The model can distinguish instructions from supplied data.
- Critical constraints are concrete and testable.
- The output format can be validated by a human or parser.
- The prompt says how to handle uncertainty, missing information, and unsafe or high-impact actions.
- The amount of reasoning, verbosity, and autonomy matches the task risk.
- Model-specific API controls are not embedded as vague prose when configuration should handle them.
- The prompt is as short as it can be while preserving behavior.

## AGENTS.md, CLAUDE.md, and Skill Files

For repository or agent instruction files:

- Write durable operating rules, not one-off task notes.
- Prefer "when X, do Y" rules over broad personality traits.
- Name exact commands, validation gates, and file ownership boundaries when they matter.
- Avoid rules that fight the host agent's system instructions.
- Keep model-specific guidance in linked reference sections or comments rather than mixing it into universal repo policy.
- For skills, make `description` trigger-focused and keep detailed model notes in `references/`.

## Output Modes

When asked to create or improve a prompt, return:

```markdown
## Prompt

[final prompt]

## Notes

- [why the key changes matter]
- [model-specific assumptions or docs used]
```

When asked for a review, lead with the highest-impact issues and then provide a revised prompt only if useful.
