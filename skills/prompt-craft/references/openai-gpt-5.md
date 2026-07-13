# OpenAI GPT-5 Family Prompting Notes

Last verified: 2026-07-13

## Scope

Use this reference for GPT-5.6 Sol (primary), GPT-5.5, GPT-5.4, and smaller GPT-5.x variants.

## GPT-5.6 Sol

### Simplify First

- Start from a working prompt and remove one group of instructions, examples, or tools at a time, re-running the same evals. Leaner system prompts improved OpenAI's internal coding-agent evals ~10–15% while cutting tokens 41–66%; treat as directional and validate on your workload.
- Trim: repeated rules, style/process instructions that don't change behavior, examples that don't change behavior, process steps the model already does reliably, irrelevant tools.
- Keep: the user-visible outcome, success criteria and stopping conditions, safety/business/evidence/permission constraints, context-dependent tool-routing rules, required output shape.
- GPT-5-class models follow prompt contracts closely: contradictions create more instability than missing detail. Audit remaining instructions for conflicts.

### Outcome-First Prompts and Stopping Conditions

- Describe the destination, not every step; the model chooses an efficient path when the prompt states what good looks like.
- Reserve ALWAYS/NEVER/must/only for true invariants (safety rules, required fields, prohibited actions). For judgment calls (when to search, ask, iterate), give decision rules instead.
- Add explicit stopping conditions: resolve in the fewest useful tool loops, but never let loop minimization outrank correctness, required evidence, or citations; after each result, check whether the core request is answerable, and if evidence is missing, name the missing fact and use the smallest useful fallback.
- Preserve explicit user values; where values are implicit, give decision criteria rather than universal defaults or keyword maps.

### Verbosity, Personality, and Collaboration

- More concise by default than GPT-5.5. Re-check whether "be concise" instructions are still needed—they can make output too brief. Use `text.verbosity` (`low`/`medium`/`high`) for the default level; use the prompt for task-specific length/structure.
- Define personality (tone, warmth, directness) and collaboration style (when to ask, assume, take initiative, check work) separately; keep both short.
- For short answers, give a priority order: name what must be preserved (facts, decisions, caveats, next steps) and what to trim first (introductions, repetition, reassurance).
- Replace ambiguous labels ("friendly") with concrete writing choices; avoid blanket language rules like "always respond in the user's language" unless truly required.
- For rewriting/editing, state what to preserve: artifact, length, structure, genre, factual claims; improve clarity without adding claims or promotional tone.

### Autonomy and Approval Boundaries

- Define what each request authorizes in one compact policy, stated once: read/explain/diagnose requests → inspect and report, don't implement; change/build/fix requests → make in-scope local changes and run non-destructive validation without asking; require confirmation for external writes, destructive actions, purchases, or scope expansion.
- Name safe local actions explicitly (read files, inspect logs, edit in-scope code, run tests). Repeating "ask first"/"do not mutate" across sections causes unnecessary approval requests.
- For long-running work, name the current layer (research, design, implementation, review, external coordination) so the model doesn't silently switch layers.

### Tool Routing and Programmatic Tool Calling

- Expose only task-relevant tools. Descriptions state what the tool does, when to use it, key return fields, error behavior.
- State prerequisite retrieval explicitly: "Before acting, resolve required discovery, retrieval, and validation steps." Parallelize independent reads; sequence dependent ones; synthesize after parallel retrieval; try one or two meaningful fallbacks on empty/narrow results.
- Programmatic Tool Calling (PTC): use only for bounded stages where code reduces many/large tool results to a compact schema (filtering, joining, batching, dedup, aggregation). Parallel or dependent calls alone don't justify it. Specify the bounded stage, eligible tools, output schema, retry limit, stop condition, and handoff back to direct calls. Test both the `program_output` and the final assistant message.

### Grounding and Retrieval Budgets

- Make citation behavior part of the prompt: what needs support, what counts as enough evidence, behavior when evidence is missing. Absence of evidence must not become a factual "no."
- Budget retrieval: one broad search first; further calls only for a missing required fact, exhaustive-coverage requests, a specific artifact, or an otherwise-unsupported important claim—never just to improve phrasing.
- For research: cite only retrieved sources, attach citations to their claims, label inference separately from supported facts, state source conflicts, report missing evidence instead of guessing.

### Long-Running Workflows and API Controls

- Prompt for a 1–2 sentence user-visible preamble before the first tool call, then sparse outcome-based updates at major phase changes only.
- Preserve assistant `phase` values when replaying history; `previous_response_id` handles this automatically. Compact after major milestones, not every turn.
- Persisted reasoning helps only while objective and assumptions stay stable; stale reasoning adds tokens and anchors to outdated approaches.
- Reasoning effort: preserve the migrating app's current effort as baseline, test one level lower; `low` for latency-sensitive work, `medium` balanced, `high`/`xhigh` only when evals show gains, `max` reserved for hardest quality-first work. Before raising effort, check whether the prompt is missing a success criterion, dependency rule, or verification loop.
- Validation: state which checks matter (targeted tests, type/lint, build, minimal smoke test) and require rendering/inspecting visual artifacts before finalizing.

### Migration Workflow

1. Switch model, preserve reasoning effort. 2. Run representative evals before touching the prompt. 3. Remove obsolete scaffolding, repeated instructions, irrelevant tools. 4. Add only the smallest targeted instruction fixing a measured regression. 5. Re-run evals after each change. Never rewrite a working stack all at once; debug regressions from a small set of real traces with surgical edits.

## GPT-5.5 and GPT-5.4

- Same outcome-first philosophy: goal, success criteria, constraints, allowed side effects, evidence rules, output shape; avoid detailed process instructions unless the path matters.
- GPT-5.4 benefits from explicit output contracts, citation rules, and completion criteria; include dependency checks so prerequisites resolve before actions, and require verification before high-impact actions.
- Use Structured Outputs instead of embedding large JSON schemas in prose. Put static content first, dynamic content last, for prompt caching.
- Preserve returned assistant item state (`phase`) correctly in multi-step reasoning/tool flows.

## GPT-5.x Mini and Nano

- Smaller variants need explicit task structure and fewer implicit assumptions: narrow tasks, exact step order, edge-case behavior, one correct example.
- Prefer closed outputs: labels, enums, short JSON, fixed templates.
- Route ambiguous, planning-heavy, or multi-step orchestration to a stronger model rather than over-prompting a small one.

## Known Gotchas

- Do not carry over old scaffolding automatically; benchmark a leaner baseline first.
- Blanket brevity instructions on GPT-5.6 can over-shorten output.
- Repeated approval-seeking rules cause unnecessary pauses on safe actions.
- For date-sensitive products, pass the business timezone or policy date explicitly.

## Sources

- GPT-5.6 Sol prompting guidance: https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6
- GPT-5.6 model guide: https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6
- GPT-5.5 prompt guidance: https://developers.openai.com/api/docs/guides/prompt-guidance?model=gpt-5.5
- OpenAI prompt engineering overview: https://developers.openai.com/api/docs/guides/prompt-engineering
- Reasoning models: https://developers.openai.com/api/docs/guides/reasoning
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
