---
name: prompt-engineering
description: >-
  Use when editing or creating system prompts, tool descriptions, agent instructions,
  or any LLM-facing text in the project. Covers prompt structure, clarity, tool guidance,
  output contracts, context engineering for agents, and common anti-patterns.
metadata:
  kind: specialist
---

# Prompt Engineering

Best practices for writing, reviewing, and refining prompts that guide AI agents and LLMs.
Applies to system prompts, tool descriptions, skill instructions, agent personas, and
any text whose audience is a language model.

## When to Use

- Creating or editing system prompts, agent instructions, or skill files
- Writing tool descriptions or parameter docs consumed by an LLM
- Reviewing existing prompts for clarity, efficiency, or correctness
- Designing multi-step agent workflows with prompt-driven control flow
- Managing context for long-horizon agentic tasks

## Context Engineering Mindset

Prompt engineering is one part of a larger discipline: **context engineering** — curating the optimal set of tokens present during LLM inference. Every token in the context window competes for the model's attention. As context grows, recall degrades (context rot). The guiding principle: **find the smallest set of high-signal tokens that maximize the likelihood of the desired outcome.**

This means:

- Treat context as a finite resource with diminishing marginal returns.
- Every section in a prompt must earn its tokens. Challenge each block: "Would the model get this wrong without it?"
- Start minimal with the best model available, then add instructions only where evals show a failure mode. Over-prompting causes overtriggering and wasted attention.
- Stable, reusable content goes first in the prompt (enables prompt caching). Variable content goes last.

## Principles

### 1. Clarity over cleverness

- Write prompts the way you would write instructions for a capable but context-free colleague.
- **Golden rule:** Show your prompt to a colleague with minimal context. If they'd be confused, the model will be too.
- Be explicit about desired behavior, format, and constraints.
- State what to do, not just what not to do.
- Provide numbered steps or bullet points when order or completeness of steps matters.

### 2. Motivate constraints

Don't just state rules — give the reason behind them. Context improves generalization.

Bad: `NEVER use ellipses`
Good: `Your response will be read aloud by a text-to-speech engine, so never use ellipses since the engine cannot pronounce them.`

The model can generalize from the explanation to related situations you didn't enumerate.

### 3. Right altitude

Find the Goldilocks zone between two failure modes:

- **Too brittle**: Hardcoded if-else logic in the prompt for every possible scenario. Fragile, high maintenance.
- **Too vague**: High-level platitudes that assume shared context the model doesn't have. No actionable signal.

The optimal prompt is specific enough to guide behavior, yet flexible enough to let the model apply strong heuristics to novel situations.

### 4. Structure with XML tags and Markdown

- Use descriptive XML tags (`<instructions>`, `<context>`, `<output_contract>`, `<examples>`) to separate concerns.
- Nest tags when content has natural hierarchy.
- Keep tag names consistent across the project.
- Tags reduce ambiguity, especially when a prompt mixes instructions, data, and examples.
- Markdown headers and lists can mark distinct sections and communicate hierarchy.

### 5. Show, don't just tell

- Include 3-5 diverse examples wrapped in `<examples>` / `<example>` tags.
- Examples should cover normal cases, edge cases, and the boundary between "do" and "don't."
- **Diversify examples** — a set of canonical, varied examples outperforms a laundry list of edge cases. If all examples show the same pattern, the model over-fits to that pattern.
- Examples are the single most reliable way to control output format, tone, and structure.

### 6. Define the output contract

- Specify exact sections, order, format (JSON, Markdown, XML, prose), and length limits.
- Separate verbosity controls from content requirements so brevity doesn't cut required information.

```xml
<output_contract>
- Return exactly the sections requested, in the requested order.
- Apply length limits only to the section they target.
- If a format is required (JSON, Markdown, SQL, XML), output only that format.
</output_contract>
```

### 7. One job per block

- Each prompt section should have a single responsibility.
- Avoid mixing persona, task instructions, output format, and safety rules in the same paragraph.
- Modular blocks are easier to test, swap, and version independently.

## Long Context Handling

When working with large documents or data-rich inputs (20k+ tokens):

- **Put longform data at the top**, query and instructions at the bottom. This can improve response quality by up to 30% on complex multi-document inputs.
- **Structure documents with XML tags**: Wrap each in `<document index="N">` with `<source>` and `<document_content>` subtags.
- **Ground responses in quotes**: Ask the model to quote relevant parts of the documents before reasoning over them. This cuts through noise in long contexts.

## Tool & Action Guidance

### Tool descriptions

- Lead with _when_ to use the tool, not _what_ it is.
- List required vs. optional parameters with types and constraints.
- Include a one-line example call when the interface is non-obvious.
- State what the tool returns and any side effects.
- Tools should have minimal functional overlap. If a human can't definitively say which tool to use in a given situation, the model can't either.

### Be explicit about actions

Models respond to the directness of the instruction. "Can you suggest some changes?" may produce suggestions instead of edits. Be explicit:

- Less effective: "Can you suggest improvements to this function?"
- More effective: "Change this function to improve its performance."

For default action behavior, configure it in the system prompt:

```xml
<default_to_action>
By default, implement changes rather than only suggesting them. If intent is
unclear, infer the most useful action and proceed, using tools to discover
missing details instead of guessing.
</default_to_action>
```

### Tool persistence

When correctness depends on thorough tool use:

```xml
<tool_persistence_rules>
- Use tools whenever they materially improve correctness or completeness.
- Do not stop early when another tool call would improve the result.
- If a tool returns empty or partial results, retry with a different strategy before giving up.
</tool_persistence_rules>
```

### Dependency awareness

```xml
<dependency_checks>
- Before taking an action, check whether prerequisite lookup or retrieval steps are needed.
- Do not skip prerequisites just because the final action seems obvious.
- Resolve dependencies before acting.
</dependency_checks>
```

### Parallel vs. sequential

- Parallelize independent lookups and reads.
- Sequence steps that have data dependencies or irreversible side effects.
- After parallel retrieval, pause to synthesize before making more calls.
- Parallel tool calling improves dramatically with explicit instruction:

```xml
<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between
them, make all independent calls in parallel. Never use placeholders or
guess missing parameters in tool calls.
</use_parallel_tool_calls>
```

## Thinking & Reasoning

### Guide thinking appropriately

- Prefer general instructions over prescriptive steps. "Think thoroughly" often produces better reasoning than a hand-written step-by-step plan.
- Ask the model to self-check: "Before you finish, verify your answer against [criteria]."
- Use `<thinking>` tags in few-shot examples to demonstrate the desired reasoning pattern.

### Avoid overthinking

Modern models may explore extensively at high effort settings. If this causes latency or token waste:

- Replace blanket "always use [tool]" with "use [tool] when it would enhance your understanding."
- Remove anti-laziness prompting that was needed for older models — newer models overtrigger on it.
- Lower effort settings as a fallback.

## Agentic Context Management

For agents running over multiple turns or long time horizons, context must be actively managed.

### Just-in-time retrieval

Rather than pre-loading all data, maintain lightweight identifiers (file paths, stored queries, links) and load data dynamically via tools at runtime. This mirrors how humans use file systems and bookmarks rather than memorizing everything.

### Compaction

When approaching context limits, summarize conversation contents and reinitiate with the summary. Preserve architectural decisions, unresolved issues, and implementation details. Discard redundant tool outputs. The art is tuning recall vs. precision — start by maximizing recall, then trim.

### Structured note-taking

Have the agent write persistent notes (a TODO list, progress file, or structured JSON) outside the context window. Pull notes back in at later turns. This survives context resets and enables multi-session coherence.

### Sub-agent delegation

For tasks that benefit from parallel exploration or isolated context, delegate to specialized sub-agents. Each sub-agent explores deeply in its own context, then returns a condensed summary (1-2k tokens). The lead agent synthesizes results without being polluted by exploration details.

### State tracking

- Use structured formats (JSON) for state data (test results, task status).
- Use unstructured text for progress notes.
- Use git for checkpoints that can be restored.
- Emphasize incremental progress in prompts.

## Completeness & Verification

### Completeness contract

For multi-step or batch tasks, define what "done" means:

```xml
<completeness_contract>
- Treat the task as incomplete until all requested items are covered or marked [blocked].
- Track processed items against expected scope.
- If any item is blocked, state exactly what is missing.
</completeness_contract>
```

### Verification loop

Add a lightweight check before finalizing output or taking irreversible actions:

```xml
<verification_loop>
Before finalizing:
- Correctness: does the output satisfy every requirement?
- Grounding: are factual claims backed by provided context or tool outputs?
- Formatting: does the output match the requested schema or style?
- Safety: if the next step has external side effects, confirm first.
</verification_loop>
```

### Empty result recovery

```xml
<empty_result_recovery>
If a lookup returns empty or suspiciously narrow results:
- Do not immediately conclude no results exist.
- Try at least one fallback (alternate query, broader filters, different tool).
- Only then report "not found" with what was attempted.
</empty_result_recovery>
```

## Persona & Tone

- Set persona in a single sentence at the top of the system prompt.
- Separate persistent personality (tone, verbosity, decision style) from per-response writing controls (channel, register, length).
- Persona must not override task-specific output requirements (if the task says return JSON, return JSON).
- Write in third person for descriptions injected into system prompts. Inconsistent point-of-view causes discovery problems.

## Grounding & Citations

When accuracy matters:

```xml
<grounding_rules>
- Base claims only on provided context or tool outputs.
- If sources conflict, state the conflict and attribute each side.
- If context is insufficient, narrow the answer or say so.
- Label inferences distinctly from directly supported facts.
</grounding_rules>

<citation_rules>
- Only cite sources retrieved in the current workflow.
- Never fabricate citations, URLs, IDs, or quotes.
- Attach citations to the specific claims they support.
</citation_rules>
```

## Follow-Through & Instruction Priority

### Default follow-through

```xml
<default_follow_through>
- If intent is clear and the next step is reversible and low-risk, proceed.
- Ask permission only if the step is irreversible, has external side effects,
  or requires missing information that would materially change the outcome.
</default_follow_through>
```

### Instruction priority

```xml
<instruction_priority>
- User instructions override default style, tone, and formatting preferences.
- Safety, honesty, and permission constraints do not yield.
- Newer user instructions override older ones; preserve non-conflicting earlier instructions.
</instruction_priority>
```

### Balancing autonomy and safety

For agentic systems, explicitly configure the boundary between autonomous action and confirmation:

```xml
<autonomy_boundary>
Take local, reversible actions freely (editing files, running tests). For actions
that are hard to reverse, affect shared systems, or are destructive, ask before
proceeding. Examples: git push --force, deleting files, posting to external services.
</autonomy_boundary>
```

## User Updates (Agentic Contexts)

- Update the user at major phase boundaries or plan changes, not on routine tool calls.
- Keep updates to 1-2 sentences: outcome + next step.
- Before substantial work, state understanding of the request and first step.
- Before file edits, explain what will change.

## Anti-Patterns to Avoid

- **Vague instructions**: "Do a good job" -> specify what "good" means.
- **Negative-only rules**: "Don't use bullet points" -> say what format to use instead.
- **Monolithic prompts**: one giant paragraph mixing everything -> use tagged sections.
- **Over-prompting**: adding blocks for problems that haven't occurred -> start minimal, add blocks only when evals show a failure mode.
- **Aggressive emphasis**: "CRITICAL: You MUST..." -> use normal language; modern models respond well to clear instructions without shouting. Older anti-laziness prompting causes overtriggering on newer models.
- **Redundant examples**: all examples showing the same pattern -> diversify to cover edge cases.
- **Missing completion criteria**: the model doesn't know when it's done -> define "done" explicitly.
- **Premature reasoning effort**: cranking up thinking/effort before fixing the prompt -> fix the prompt first, increase effort only if evals still regress.
- **Laundry-list edge cases**: stuffing every possible rule into the prompt -> curate diverse canonical examples instead.

## Checklist

Before finalizing a prompt change:

1. Each section has a single responsibility
2. Output contract specifies format, sections, and length
3. Examples cover normal and edge cases (3-5 minimum for complex tasks)
4. Examples are diverse, not all showing the same pattern
5. Tool descriptions lead with "when to use"
6. Completion criteria are explicit
7. No aggressive emphasis (MUST, CRITICAL, ALWAYS in caps) unless truly safety-critical
8. Instructions say what to do, not just what to avoid
9. Constraints include motivation (why, not just what)
10. Long documents placed at the top, query at the bottom
11. XML tags used consistently for structure
12. Context budget justified — every section earns its tokens

## Reference

- Claude Prompting Best Practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Effective Context Engineering for AI Agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- OpenAI Prompt Engineering Guide: https://developers.openai.com/api/docs/guides/prompt-engineering.md
