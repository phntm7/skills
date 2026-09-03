---
name: prompt-craft
description: >
  Use when writing or reviewing LLM prompts, system instructions, agent
  configurations, or model-specific guidance; it produces concise, testable prompts with clear contracts.
---

# Prompt Craft

Use this skill to write prompts that are clear, testable, and portable across modern LLMs. Start with the universal guidance below, then read a model-specific reference only when the prompt targets that model family or the user asks for model-specific tuning.

## Context Mindset

Prompting is context engineering: choose the smallest set of high-signal tokens that makes the desired behavior likely. Every section must earn its place. Start minimal, add instructions only for observed failure modes, and keep stable reusable content before dynamic task-specific context when caching matters.

Frontier models (GPT-5.6 Sol, Claude Fable 5.1, Claude Opus 5) follow prompt contracts closely: contradictory or redundant rules destabilize them more than missing detail, and a brief instruction steers a whole behavior class without enumerating each case. When migrating a working prompt to a newer model, simplify first — remove one group of instructions, examples, or tools at a time and re-test — before adding anything new.

## Reference Selection

- OpenAI GPT-5.6 (Sol, Terra, Luna), GPT-5.5, or GPT-5.4: read [references/openai-gpt-5.md](references/openai-gpt-5.md).
- Claude Fable 5.1 / Claude Fable 5 / Claude Mythos 5.1: read [references/claude-fable-5.md](references/claude-fable-5.md).
- Claude Opus 5 (flagship) or Claude Opus 4.8 / Claude Code: read [references/claude-opus-5.md](references/claude-opus-5.md).
- Claude Sonnet 5 / Claude Sonnet 4.6: read [references/claude-fable-5.md](references/claude-fable-5.md) for universal Claude 5 behavior, or [references/claude-opus-5.md](references/claude-opus-5.md).
- Claude Haiku 4.5 or lightweight Claude models: read [references/small-models.md](references/small-models.md) (note: Haiku 4.5 does not support the `effort` parameter).
- Gemini 3 / Gemini 3.1 Pro: read [references/gemini-3.md](references/gemini-3.md).
- Kimi / Kimi K2.6: read [references/kimi.md](references/kimi.md).
- Qwen / Qwen3.6: read [references/qwen.md](references/qwen.md).
- DeepSeek V4: read [references/deepseek.md](references/deepseek.md).
- GLM, MiniMax, and other capable open models without a dedicated reference: apply the universal guidance in this file; borrow from [references/kimi.md](references/kimi.md) and [references/qwen.md](references/qwen.md) for open-model conventions.
- Mini, nano, flash, local, or cost-optimized models: read [references/small-models.md](references/small-models.md).

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

Use Markdown headings for ordinary structure. Use XML tags when separating instructions from untrusted/user-supplied data, examples, or multiple documents.

## Prompting Principles

- State the desired outcome before process details. Add step-by-step procedure only when the path matters.
- Define "done" with a completion criterion that is both checkable and demanding. Clarity lets the model tell done from not-done; a vague bound ("understanding reached") invites premature completion when later steps are visible. Demand drives legwork: "every modified model accounted for" forces thorough work where "produce a change list" does not. If a step is still rushed after the bound is sharpened, hide the later steps across a real context boundary (a subagent dispatch); an inline "do X then Y" leaves Y in view.
- Say when to stop, ask, retry, or abstain.
- Reserve absolute language (ALWAYS, NEVER, must, only) for true invariants such as safety rules, required fields, and prohibited actions. For judgment calls — when to search, ask, iterate, or delegate — give decision rules instead.
- Give the reason behind the request, not only the request. Intent context ("I'm working on X for Y; they need Z") lets the model connect the task to relevant information instead of inferring intent.
- Explain important constraints. A short reason helps the model generalize the rule to cases you did not enumerate.
- Keep the right altitude: avoid both hardcoded branches for every edge case and vague slogans that assume missing context.
- Give each block one job. Do not mix persona, task instructions, output schema, and safety rules in one paragraph.
- Put critical restrictions close to the task or final instruction so they are less likely to be dropped.
- Separate data from instructions. Label user-provided content as context, source material, examples, or tool output.
- Prompt the positive. A prohibition drags the banned behavior into context and makes it more available, not less; state the target behavior ("write one-line comments") so the banned one is never spoken. Keep a prohibition only as a hard guardrail you cannot phrase positively, and pair it with the positive target.
- Use leading words: a compact concept the model already holds (*tight* loop, *red* test, *relentless*) used as a token, not a sentence. It anchors a whole region of behavior in one word and, when the same word appears in prompts, docs, and code, makes the agent reach the linked material reliably. Collapse restatements ("fast, deterministic, low-overhead") into the word ("tight"). Prefer an existing word; a coined one recruits no priors and costs its definition.
- Co-locate: keep a concept's definition, rules, and caveats under one heading. Scattering one meaning across sections is a separate failure from duplicating it, and both cost the same.
- Include enough context to remove ambiguity, but remove stale scaffolding, duplicate rules, and motivational filler.
- Use examples for formats, tone, tool routing, refusal/abstention behavior, and edge cases.
- For grounded work, state which sources are authoritative and what to do when the answer is not present.
- For tool-using agents, describe when to use tools, what side effects are allowed, retry limits, verification requirements, and what evidence must be returned.
- For long-running agents, define persistence, progress updates, compaction/state handoff, and escalation rules. Require progress claims to be audited against actual tool results: report only work with evidence, and state failures plainly.
- State autonomy and approval boundaries once, in one place: what the request authorizes without asking (in-scope edits, non-destructive validation) and what requires confirmation (external writes, destructive actions, scope expansion). Repeating "ask first" across sections causes unnecessary approval pauses.
- Tune reasoning and verbosity separately. Do not use long final answers as a proxy for deeper reasoning.
- Ask for visible reasoning only when it is useful to the user. Otherwise ask for checks, conclusions, evidence, or a concise rationale. Never instruct a model to echo or transcribe its internal reasoning as response text; on current Claude models (Claude Fable 5.1, Claude Opus 5) this triggers `reasoning_extraction` refusals — read structured `thinking` blocks instead.
- Add current dates, timezones, and policy-effective dates only when the task depends on them.
## Long Context

- Put large source material before the task, then restate the task and critical constraints after the context.
- Label documents with stable IDs, titles, and source metadata.
- For evidence-heavy work, ask the model to ground conclusions in cited snippets, IDs, or tool outputs before synthesizing.
- For long-running sessions, define what must survive compaction: completed work, active assumptions, IDs, tool outcomes, unresolved blockers, and the next concrete goal.

## Tool and Agent Guidance

For tool descriptions, lead with when to use the tool, not what the tool is. Include required inputs, optional inputs, return shape, side effects, retry safety, and one example when the interface is not obvious.

For tool-using agents, add small reusable blocks only when the behavior matters:

```xml
<tool_persistence_rules>
- Use tools when they materially improve correctness or completeness.
- If a lookup returns empty or suspiciously narrow results, retry once with a broader or alternate strategy before reporting not found.
- Stop tool use when additional calls would not change the answer.
</tool_persistence_rules>
```

```xml
<dependency_checks>
- Before acting, check whether prerequisite lookup or retrieval is needed.
- Resolve prerequisites before downstream or irreversible actions.
</dependency_checks>
```

```xml
<parallel_tool_calls>
- Parallelize independent lookups and reads.
- Sequence actions that depend on prior results or have side effects.
- Never invent missing tool parameters.
</parallel_tool_calls>
```

## Reusable Contracts

```xml
<completeness_contract>
- Treat the task as incomplete until all requested items are covered or marked blocked.
- Track processed items against expected scope.
- If anything is blocked, state exactly what is missing.
</completeness_contract>
```

```xml
<verification_loop>
Before finalizing:
- Correctness: does the output satisfy every requirement?
- Grounding: are factual claims backed by provided context or tool outputs?
- Formatting: does the output match the requested schema or style?
- Safety: if the next step has external side effects, confirm first.
</verification_loop>
```

```xml
<grounding_rules>
- Use the provided sources as the authority for this task.
- If the sources do not contain the answer, say what is missing instead of guessing.
- Cite the source ID, file, section, or tool output for non-obvious factual claims.
</grounding_rules>
```

## Prompt Review Checklist

Before finalizing a prompt, check:

- The trigger, audience, and desired outcome are explicit.
- The model can distinguish instructions, examples, and supplied data.
- Each section has one job and no duplicate rules.
- Critical constraints include enough rationale to generalize correctly.
- The prompt is neither brittle nor vague for the task risk.
- The output contract specifies sections, format, length, tone, and failure behavior.
- Examples cover the desired format and at least one edge case when format precision matters.
- Grounding rules say which sources are authoritative and what to do when evidence is missing.
- Tool rules state when to use tools, side effects, retry boundaries, and stopping criteria.
- Autonomy rules say when to proceed, ask, escalate, or stop.
- Reasoning, verbosity, and model/API controls are set intentionally.
- The done criterion is checkable and exhaustive.
- Each sentence changes behavior versus the model's default; every no-op is deleted.
- Restated ideas are collapsed into a leading word.
- The prompt is as short as it can be while preserving behavior.

## AGENTS.md, CLAUDE.md, and Skill Files

To initialize `AGENTS.md` and `CLAUDE.md` for a project, also use the `agents-md-init` skill; to audit, refactor, or sync existing files, use `agents-md-maintain`. To create or refine a `SKILL.md`, use `skill-create`. The rules below apply universally.

For repository or agent instruction files:

- Put durable repo behavior in `AGENTS.md` or `CLAUDE.md`; put one-task instructions in chat; put reusable workflows in skills.
- Write durable operating rules, not one-off task notes.
- Prefer "when X, do Y" rules over broad personality traits.
- Name exact commands, validation gates, file ownership boundaries, and done criteria when they matter.
- Mark commands and tools as required vs. preferred so the agent has fallback room when a tool is unavailable.
- Avoid rules that fight the host agent's system instructions or permission model.
- Phrase validation concretely: "before declaring done, run `pnpm test:unit`" is better than "always be careful."
- Use local project instructions to override global habits only where the repo truly differs.
- Keep model-specific guidance in linked reference sections or comments rather than mixing it into universal repo policy.
- Treat every "read X" line as a context pointer: its wording, not its target, decides whether the agent reaches the material. State what the material is and the branch that should trigger reading it ("read `docs/routing.md` before changing model roles"), not a bare link.
- Cache the environment only when the lookup is expensive. A document that restates `package.json` scripts, config values, or `--help` output is a copy that goes stale; cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses.
- For skills, make `description` trigger-focused and keep detailed model notes in `references/`.

## Anti-Patterns

- A prompt that says "be smart" but omits success criteria.
- A persona that conflicts with the output format.
- A long list of negative rules without examples or rationale.
- Tool descriptions with overlapping responsibilities.
- Hidden assumptions about files, dates, audience, or available tools.
- Repeating the same rule in several sections with slightly different wording; on current frontier models, contradictions and redundancy destabilize behavior more than missing detail.
- Asking for chain-of-thought when the user only needs evidence, checks, or a concise rationale.
- Embedding large schemas in prose when the API supports structured outputs.
- Treating a stronger model as a substitute for a clear task contract.
- Mixing model-specific parameter advice into a universal prompt.
- Carrying prescriptive scaffolding written for older models into a prompt for a newer one without re-testing a leaner baseline first.
- Forcing interim status updates or approval requests that the model already handles well by default.
- A no-op instruction: a sentence the model already obeys by default spends tokens to change nothing. Delete the whole sentence, not words from it.
- A weak leading word ("be thorough") that cannot beat the model's default; the fix is a stronger word ("relentless"), not a longer sentence.
- A must-read document behind a weakly worded pointer. Sharpen the pointer's wording first; inline the material only if that fails.

## Output Modes

### Create or Improve

```markdown
## Prompt

[final prompt: copy-pasteable, with no commentary inside the prompt]

## Notes

- [key changes and why they matter]
- [model-specific assumptions and references consulted]
```

### Review

```markdown
## Findings

[highest-impact issues first; each finding includes what is wrong, why it matters, and a concrete fix]

## Revised Prompt

[include only when the changes are concrete enough to be worth pasting]
```
