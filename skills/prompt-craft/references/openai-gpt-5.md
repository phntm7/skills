# OpenAI GPT-5 Family Prompting Notes

Last verified: 2026-09-03

## Scope

Use this reference for the OpenAI GPT-5 family: GPT-5.6 Sol (primary flagship), GPT-5.6 Terra, GPT-5.6 Luna, GPT-5.5, GPT-5.4, and smaller variants. The `gpt-5.6` alias routes to `gpt-5.6-sol`.

---

## Part 1: GPT-5.6 Family (Sol, Terra, Luna)

### Model Tiers
- **`gpt-5.6-sol`**: Flagship capability for complex multi-step reasoning, architectural design, subtle debugging, and autonomous coding agents. Default destination for `gpt-5.6`.
- **`gpt-5.6-terra`**: Balanced daily driver for standard feature work, content, and high-quality generation at lower cost.
- **`gpt-5.6-luna`**: High-volume, fast, token-efficient model for lightweight automation, mechanical editing, and bounded specs.

### What Changed in GPT-5.6
1. **Dramatically higher token efficiency**: Reaches frontier solutions with significantly fewer output tokens.
2. **Shorter default responses**: Skips generic intros, unnecessary pleasantries, and speculative branches. Broad brevity instructions ("be brief") can over-shorten output; use `text.verbosity` instead.
3. **Stronger intent reading**: Infers unstated intermediate steps from context. Less hand-holding is needed, but domain context, hard constraints, approval boundaries, and success criteria must remain explicit.
4. **Enhanced frontend & visual design**: Substantially better layout, typography, visual hierarchy, and aesthetic judgment out of the box.
5. **New execution modes**: Supports **Pro mode** (`reasoning.mode: "pro"`), **Programmatic Tool Calling** (isolated V8 runtime), and **Multi-Agent** coordination (Responses API beta).

---

### Core Prompting Principles for GPT-5.6

#### 1. Simplify First (Leaner Prompts Win)
OpenAI internal evals show that removing boilerplate rules, repeated constraints, and unused tool descriptions improved evaluation scores by ~10–15% while cutting tokens by 40–60%.
- **Delete**: Restated rules, process steps the model handles reliably, unused tool descriptors, vague adjectives ("be thorough", "think deeply").
- **Keep**: Concrete deliverables, verifiable success criteria ("done" conditions), permission/approval boundaries, required output schemas, and evidence requirements.
- **Rule of one**: State every instruction once, clearly. Repeating "ask first" or "be careful" across sections destabilizes the model and causes false-positive pauses.

#### 2. Outcome-First Prompts and Stopping Conditions
- Describe the destination, not every step; the model chooses an efficient path when the prompt states what good looks like.
- Reserve ALWAYS/NEVER/must/only for true invariants (safety rules, required fields, prohibited actions). For judgment calls (when to search, ask, iterate), give decision rules instead.
- **Explicit stopping conditions**: Resolve in the fewest useful tool loops, but never let loop minimization outrank correctness, required evidence, or citations. After each result, check whether the core request is answerable; if evidence is missing, name the missing fact and use the smallest useful fallback.

#### 3. Autonomy and Approval Boundaries
GPT-5.6 is proactive and persistent. Define authorized autonomy in **one compact policy, stated once**:
```text
For requests to answer, explain, review, diagnose, or plan: inspect relevant files and report findings. Do not modify files unless asked.
For requests to change, build, or fix: make the requested in-scope changes and run non-destructive validation without asking first.
Require explicit confirmation before destructive actions, external network writes, git pushes, or material scope expansions.
```

#### 4. Control Detail with `text.verbosity` and Priority Directives
- Use API parameter `text.verbosity`: `"low"`, `"medium"` (default), or `"high"`.
- When prompting for concision, give a **priority order** instead of "be brief":
  *"Lead with the conclusion. Preserve core facts, decisions, caveats, and next steps. Omit introductory remarks, generic reassurance, and secondary background."*
- Separate personality (tone, directness) from collaboration style (when to ask, assume, check work).
- For editing/rewriting tasks: state what to preserve (artifact, length, structure, genre, factual claims); improve clarity without adding unrequested claims or promotional tone.

#### 5. Pro Mode (`reasoning.mode: "pro"`)
- Applies deeper model exploration to return a single high-confidence answer.
- Works with any GPT-5.6 tier (Sol, Terra, Luna) and any reasoning effort.
- Best for: Complex optimization, high-stakes architecture, subtle security audits, and mathematical modeling.
- Configure in the API: `reasoning: { mode: "pro", effort: "high" }`. Keep the same outcome-focused prompt; do not tell the model to "think harder" in text.

#### 6. Reasoning Effort (`none`, `low`, `medium`, `high`, `xhigh`, `max`)
- `none` / `low`: Basic factual lookups, latency-sensitive pipelines.
- `medium`: Default balanced starting point.
- `high` / `xhigh`: Complex multi-file refactoring, deep debugging.
- `max`: New maximum effort tier for the hardest frontier problems.
- **Migration rule**: Preserve the current effort baseline from GPT-5.5/5.4, then compare one level lower. Before jumping to `max`, verify whether the prompt lacks clear success criteria, dependency rules, or verification loops.

#### 7. Persisted Reasoning (`reasoning.context`)
- **`all_turns`** (GPT-5.6 default; earlier models default to `current_turn`): Reuses compatible reasoning items across multi-turn sessions.
  - Continued automatically via `previous_response_id`.
  - For stateless (`store: false`) or Zero Data Retention (ZDR) integrations, callers must replay the complete history, including every response output item, encrypted reasoning items, and assistant `phase`.
  - Reusable across Sol, Terra, and Luna, but **not** across different model families (e.g. cannot replay GPT-5.5 reasoning into GPT-5.6).
- **`current_turn`**: Stops rendering earlier reasoning items. Use when shifting to an unrelated topic or after a major context reset.

#### 8. Tool Routing & Programmatic Tool Calling (PTC)
- Expose only task-relevant tools. Descriptions state what the tool does, when to use it, key return fields, and error behavior.
- **Programmatic Tool Calling (PTC)**: The model writes and runs lightweight JavaScript inside a **fresh, isolated V8 runtime** (no Node.js, no npm packages, no direct filesystem or external network access). External operations run strictly via opted-in tools (`allowed_callers: ["programmatic_tool_calling"]`).
  - **When to use**: Bounded stages reducing large data or many calls to a compact schema (filtering logs, ranking records, deduplicating, aggregating).
  - **When direct calls are required**: Actions needing human approval, semantic LLM judgment between steps, or when the final answer must preserve citations or native artifacts.
  - **Prompt contract**: Explicitly specify the bounded stage, eligible tools, required output schema, retry limits, and the clean handoff back to direct calls.
  - **Testing**: Test both `program_output` and the final assistant `message`.

#### 9. Grounding, Citations, and Retrieval Budgets
- Make citation requirements explicit: what needs support, what counts as enough evidence, and behavior when evidence is missing (absence of evidence must never become an authoritative "no").
- Budget retrieval: one broad search first; additional calls only for a missing required fact, exhaustive requests, a specific artifact, or an otherwise-unsupported important claim.
- Label inference separately from grounded source facts.

#### 10. Long-Running Workflows & Assistant Phase
- Prompt for a brief 1–2 sentence user-visible preamble before the first tool call, then sparse outcome-based updates at major phase transitions.
- **Preserve assistant `phase`**: In multi-step tool calls, preserve and resend the assistant `phase` value (`commentary` vs `final_answer`) across turns. This reduces premature stopping.
- Compact context after major milestones, not every turn.

#### 11. Explicit Prompt Caching Breakpoints
- GPT-5.6 cache writes cost 1.25× the uncached input rate; cache reads remain discounted.
- Structure prompts with static, stable instructions first, and dynamic context (user turn, diffs, timestamps) last.
- Use explicit breakpoints (`prompt_cache_options.mode: "explicit"`) with `prompt_cache_breakpoint: {"mode": "explicit"}` on supported content blocks. Top-level `instructions` cannot carry breakpoints. Placing breakpoints avoids paying 1.25× write costs on dynamic suffixes unlikely to be reused.

---

## Part 2: GPT-5.5 and GPT-5.4

- **Outcome-first philosophy**: Goal, success criteria, constraints, allowed side effects, evidence rules, and output shape; avoid micromanaging steps unless the sequence is safety-critical.
- **GPT-5.4 specific**: Benefits from explicit output contracts, citation rules, and completion criteria. Include dependency checks so prerequisites resolve before actions, and require verification before high-impact actions.
- **Structured Outputs**: Use native Structured Outputs (`response_format: { type: "json_schema" }`) instead of embedding large schemas in prose.
- **Caching & History**: Default `reasoning.context` is `current_turn`. Put static content first, dynamic content last.

---

## Part 3: GPT-5.x Mini and Nano

- Smaller variants need explicit task structure and fewer implicit assumptions: narrow tasks, exact step order, edge-case behavior, one correct example.
- Prefer closed outputs: labels, enums, short JSON, fixed templates.
- Route ambiguous, planning-heavy, or multi-step orchestration to a stronger model rather than over-prompting a small one.

---

## High-Leverage Prompt Template (Outcome-First)

```markdown
# Goal
[One clear sentence stating the deliverable.]

# Context & Inputs
- Primary files/sources: [paths or labeled documents]
- Relevant constraints: [invariants, tech stack, backwards compatibility]

# Autonomy & Boundaries
- Authorized: Make in-scope local edits and run tests.
- Prohibited: External writes, commits, pushes, and destructive deletions without confirmation.

# Success Criteria
- [Concrete condition 1 that must be verified]
- [Concrete condition 2 with expected output format]
```

## Known Gotchas
- **Over-shortening**: Old prompts with aggressive "be brief" directives can cause GPT-5.6 to drop important context; tune with `text.verbosity`.
- **Approval hesitation**: Repeating "confirm with user" across sections makes the model ask permission before running simple inspection commands.
- **Dual-use safeguards**: Benign security reviews and dual-use code can pause for synchronous classifier checks or refuse; provide explicit defensive framing.

## Sources
- GPT-5.6 Sol Prompting Guide: https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6
- GPT-5.6 Model Guide: https://developers.openai.com/api/docs/guides/latest-model
- Reasoning & Pro Mode: https://developers.openai.com/api/docs/guides/reasoning
- Programmatic Tool Calling: https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling
- Prompt Caching: https://developers.openai.com/api/docs/guides/prompt-caching
