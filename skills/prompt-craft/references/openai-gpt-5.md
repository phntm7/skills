# OpenAI GPT-5 Family Prompting Notes

Last verified: 2026-09-03

## Scope

Use this reference for GPT-5.6 Sol, GPT-5.6 Terra, GPT-5.6 Luna, GPT-5.5, and smaller variants. The `gpt-5.6` alias routes to `gpt-5.6-sol`.

## GPT-5.6 Family (Sol, Terra, Luna)

### Model Tiers
- **`gpt-5.6-sol`**: Flagship capability for complex reasoning, architectural design, difficult debugging, and autonomous coding agents. Default destination for `gpt-5.6`.
- **`gpt-5.6-terra`**: Balanced daily driver for standard feature work, content, and high-quality generation at lower cost.
- **`gpt-5.6-luna`**: High-volume, fast, token-efficient model for lightweight automation, mechanical editing, and bounded specs.

### What Changed in GPT-5.6
1. **Dramatically higher token efficiency**: Reaches frontier solutions with significantly fewer output tokens.
2. **Shorter default responses**: Skips generic intros, unnecessary pleasantries, and speculative branches. Broad brevity instructions ("be brief") can over-shorten output; use `text.verbosity` instead.
3. **Stronger intent reading**: Infers unstated intermediate steps from context. Less hand-holding is needed, but domain context, hard constraints, approval boundaries, and success criteria must remain explicit.
4. **Enhanced frontend & visual design**: Substantially better layout, typography, visual hierarchy, and aesthetic judgment out of the box.
5. **New execution modes**: Supports **Pro mode** (`reasoning.mode: "pro"`), **Programmatic Tool Calling**, and **Multi-Agent** coordination.

---

### Core Prompting Principles for GPT-5.6

#### 1. Simplify First (Leaner Prompts Win)
OpenAI internal evals show that removing boilerplate rules, repeated constraints, and unused tool descriptions improved evaluation scores by ~10–15% while cutting tokens by 40–60%.
- **Delete**: Restated rules, process steps the model handles reliably, unused tool descriptors, vague adjectives ("be thorough", "think deeply").
- **Keep**: Concrete deliverables, verifiable success criteria ("done" conditions), permission/approval boundaries, required output schemas, and evidence requirements.
- **Rule of one**: State every instruction once, clearly. Repeating "ask first" or "be careful" across sections destabilizes the model and causes false-positive pauses.

#### 2. Autonomy and Approval Boundaries
GPT-5.6 is proactive and persistent. Define authorized autonomy in **one compact policy, stated once**:
```text
For requests to answer, explain, review, diagnose, or plan: inspect relevant files and report findings. Do not modify files unless asked.
For requests to change, build, or fix: make the requested in-scope changes and run non-destructive validation without asking first.
Require explicit confirmation before destructive actions, external network writes, git pushes, or material scope expansions.
```

#### 3. Control Detail with `text.verbosity` and Priority Directives
- Use API parameter `text.verbosity`: `"low"`, `"medium"` (default), or `"high"`.
- When prompting for concision, give a **priority order** instead of "be brief":
  *"Lead with the conclusion. Preserve core facts, decisions, caveats, and next steps. Omit introductory remarks, generic reassurance, and secondary background."*

#### 4. Pro Mode (`reasoning.mode: "pro"`)
- Applies deeper model exploration to return a single high-confidence answer.
- Works with any GPT-5.6 tier (Sol, Terra, Luna) and any reasoning effort.
- Best for: Complex optimization, high-stakes architecture, subtle security audits, and mathematical modeling.
- Configure in the API: `reasoning: { mode: "pro", effort: "high" }`. Keep the same outcome-focused prompt; do not tell the model to "think harder" in text.

#### 5. Reasoning Effort (`none`, `low`, `medium`, `high`, `xhigh`, `max`)
- `none` / `low`: Basic factual lookups, latency-sensitive pipelines.
- `medium`: Default balanced starting point.
- `high` / `xhigh`: Complex multi-file refactoring, deep debugging.
- `max`: New maximum effort tier for the hardest frontier problems. Before jumping to `max`, check whether the prompt is missing clear success criteria or verification steps.

#### 6. Persisted Reasoning (`reasoning.context`)
- **`all_turns`** (GPT-5.6 default): Reuses previous reasoning items across multi-turn sessions. Best when goals, assumptions, and constraints remain stable. Continue via `previous_response_id`.
- **`current_turn`**: Drops past reasoning; best when pivoting to an unrelated task or after a major context reset.

#### 7. Programmatic Tool Calling (PTC)
- GPT-5.6 can write and execute JavaScript to call tools, loop over datasets, and filter large intermediate outputs in a hosted container before returning results.
- **When to use**: Bounded data reduction stages (e.g. searching 50 logs, filtering lines, deduplicating records, aggregating metrics).
- **When NOT to use**: Single tool calls, small outputs, actions needing human approval, or where each step requires semantic LLM judgment.
- **Prompt contract**: Explicitly specify the bounded stage, eligible tools, required output schema, error handling, and transition back to direct semantic calls.
- **Testing**: Test both `program_output` and the final assistant `message`.

#### 8. Prompt Caching
- GPT-5.6 cache writes cost 1.25× the uncached rate; cache reads are heavily discounted.
- Structure prompts with static, stable instructions first, and dynamic context (user turn, timestamps, diffs) last.
- Use explicit breakpoints (`prompt_cache_options.mode: "explicit"`) to prevent accidental cache invalidations.

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
