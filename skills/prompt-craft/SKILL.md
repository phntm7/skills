---
name: prompt-craft
description: >
  Write or review LLM prompts, system instructions, agent configurations,
  and model-specific guidance with clear outcomes and output contracts.
---

# Prompt Craft

Start with the task, audience, context, constraints, and definition of done.
Load a model reference only when targeting that family. Add instructions for
observed failures; remove duplicate rules and obsolete scaffolding before
adding more. Keep stable reusable context before changing inputs when caching
matters.

Checked: 2026-10-27 (Claude and OpenAI guidance). Other references carry their
own verification dates.

## Reference Selection

- GPT-6 Astra, GPT-6.1 Sol / Terra, or GPT-6 Luna: read
  [references/openai-gpt-6.md](references/openai-gpt-6.md).
- Claude Opus 5.5 (`claude-opus-5-5`), including Claude Code on Opus: read
  [references/claude-opus-5-5.md](references/claude-opus-5-5.md).
- Claude Fable 5.1 (`claude-fable-5-1`): read
  [references/claude-fable-5-1.md](references/claude-fable-5-1.md).
- Claude Sonnet 5.5: use the universal guidance here and fetch its
  [official model guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
  for model-specific controls; Opus and Fable settings are not interchangeable.
- Claude Haiku 5.5 or other lightweight models: read
  [references/small-models.md](references/small-models.md); check Haiku's
  [official model guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5)
  before setting effort or thinking controls.
- DeepSeek V4.1 Flash: read [references/deepseek.md](references/deepseek.md).
  Model names are current; its older API behavior notes need rechecking.
- Qwen3.8 / Qwen: read [references/qwen.md](references/qwen.md).
- Kimi K3.1 Pro / Kimi: read [references/kimi.md](references/kimi.md).
- Gemini: read [references/gemini-3.md](references/gemini-3.md).
- GLM-5.3 / GLM-5.3-Flash, MiMo 2.6 Pro / Flash, Muse Spark, and families
  without a dedicated reference: use the universal guidance and verify the
  target provider's controls before giving version-specific advice.
- Mini, nano, flash, local, or cost-optimized models: read
  [references/small-models.md](references/small-models.md). A tier label alone
  does not establish capability or API compatibility.

For current model-specific advice, fetch primary docs and preserve the exact
requested model. A dated reference is a starting point, not proof that a newer
version supports the same settings.

## Prompt Structure

Use the sections the task needs:

1. **Role and context:** job, audience, authority, relevant environment.
2. **Outcome:** deliverable and observable completion criteria.
3. **Inputs:** authoritative files, documents, examples, and tool results.
4. **Constraints:** scope, preservation requirements, evidence, action boundaries.
5. **Workflow:** dependencies, tool rules, recovery, and stopping conditions.
6. **Output:** format, tone, length, citations, and how to report missing inputs.
7. **Examples:** representative cases when format or behavior needs demonstration.

Use Markdown for structure and XML or labeled blocks to separate instructions
from source material and untrusted input. Large documents can precede the task;
put the actual request and relevant constraints after them.

## Prompting Principles

- Describe the result before prescribing a procedure. Use ordered steps when
  dependencies or completeness require them.
- Define done in observable terms: covered items, deliverables, and required
  checks. Identify real blockers and when further work would add no value.
- State each rule once. Use calm, direct language; reserve hard requirements
  for actual invariants. Capitalization and motivational pressure add little.
- Explain the reason for constraints when it helps the model generalize.
- Give each section one job and keep related rules together.
- State desired behavior positively where practical. Keep explicit prohibitions
  for real boundaries, such as excluded files or unauthorized actions.
- Use examples for schemas, style, tool routing, abstention, or difficult edges.
  Retain examples that encode product requirements or correct measured gaps.
- Specify authoritative sources and how to handle absent or conflicting evidence.
- Separate reasoning effort from final-answer length. Ask for evidence or a
  concise rationale when useful, rather than a transcript of internal reasoning.
- Set API controls from the target model's docs; prompt text cannot repair an
  incompatible tool loop, chat template, or request schema.
- Evaluate one change at a time on representative tasks. A newer model may need
  fewer instructions, but keep domain rules and hard acceptance criteria.

## Tools and Autonomy

Describe when a tool is useful, its inputs, output shape, side effects, and
retry safety. Include an example only when the interface needs one. Expose
only tools relevant to the task.

For an agent prompt, specify the boundaries that matter:

- What the request authorizes, what requires user input, and which decisions
  the agent can make independently. Honor authorization already given.
- Which prerequisites must resolve before dependent actions. Batch independent
  reads when supported; sequence dependent operations and mutations.
- When to retry an empty or failed lookup, how to report failure, and when to
  stop. Retry bounds should fit the service and failure mode.
- Which checks the task requires. Scale validation to the change; after required
  checks pass, repeat or broaden them only for new failures or evidence.
- When delegation is permitted and useful, and its cost or concurrency limits.
  A reviewer is a workflow choice, not a default addition to every task.

Avoid universal mandates to use tools, ask permission, run every test, or spawn
verifiers. Name required project checks directly when they are part of done.

## Long Context and Long Tasks

Label source documents with stable IDs, titles, dates, and provenance. For
evidence-heavy tasks, request citations to those IDs or actual tool results.

State what should survive compaction: completed work, scope and constraints,
active decisions, exact identifiers, file paths, tool outcomes, blockers, and
next steps. Describe real persistence capabilities rather than promising
unlimited context or runtime.

Configure progress updates for the client and model. Check whether the UI
renders them before adding narration prompts. Report only work supported by
actual results. A final answer should explain the outcome to someone who did
not see intermediate updates.

## Repository Instructions and Skills

Use `agents-md-init` to create project instruction files, `agents-md-maintain`
to audit existing ones, and `skill-create` for portable skill structure.

- Put durable repository rules in `AGENTS.md` or `CLAUDE.md`, one-task details
  in chat, and reusable workflows in skills.
- Make skill descriptions short and specific about when to load the skill.
- Keep the root skill a focused router; link optional branches to references
  and scripts rather than loading every workflow on every invocation.
- Link a document with its use condition: architecture for boundary changes,
  deployment docs for deployment work. Avoid a mandatory reading stack for
  every edit.
- Document unwritten conventions and reasons; avoid duplicating discoverable
  package scripts, config, and CLI help.
- Keep model-specific behavior in references. Guidance useful for a smaller
  model can overconstrain a stronger model using the same repository.
- Respect host instruction priorities and user authorization; avoid adding
  approval requirements the workflow does not actually need.

## Review Checklist

- The trigger, audience, outcome, scope, and completion criteria are clear.
- Instructions, examples, and source data are distinguishable.
- Rules do not conflict or repeat across prompt, skills, and repository files.
- Output format, evidence, and missing-input behavior match the task.
- Tool and action boundaries allow authorized work to finish.
- Validation is concrete and proportionate to the task.
- Model controls and source dates have been checked for the exact target.
- Each retained instruction adds domain knowledge or changes needed behavior.

## Output Modes

For creation or revision, return the copyable prompt followed by brief notes
on consequential changes and model assumptions. Keep commentary outside the
prompt itself.

For review, lead with actionable findings, ordered by impact. Give each issue,
its consequence, and a concrete fix; include a revised prompt when useful.

## Current Primary Sources

- [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [OpenAI latest-model guide](https://developers.openai.com/api/docs/guides/latest-model)
- [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
