# OpenAI GPT-5 Prompting Notes

Last verified: 2026-05-13

## Scope

Use this reference for GPT-5.5, GPT-5.4, and smaller GPT-5.4 variants.

## GPT-5.5

### Behavior and Tuning

- Start from a small baseline prompt rather than carrying over old scaffolding.
- Prefer outcome-first prompts: goal, success criteria, constraints, allowed side effects, evidence rules, and output shape.
- Avoid detailed process instructions unless the exact path matters.

### API Controls

- Treat `reasoning.effort` and `text.verbosity` as configuration controls, not just prompt prose. Use higher reasoning only when evals show value.
- Use Structured Outputs instead of embedding large JSON schema descriptions in the prompt when possible.
- Put static prompt content first and dynamic user/session content last to improve prompt caching.

### Tool Use and Agentic Patterns

- Put most tool-specific guidance in tool descriptions: when to use the tool, required inputs, side effects, retry safety, and error modes.
- For long-running agents, define state handoff, compaction content, progress behavior, and stopping rules.

## GPT-5.4

### Behavior and Tuning

- GPT-5.4 benefits from explicit output contracts, citation rules, tool-use expectations, and completion criteria.
- Use compact, structured outputs to control token use alongside the API verbosity setting.
- For research or evidence-heavy workflows, specify source collection, citation format, verification loops, and when to abstain.

### Tool Use and Agentic Patterns

- For tool workflows, include dependency checks and downstream-step checks so the model resolves prerequisites before acting.
- For high-impact actions, require verification before execution.
- Preserve returned assistant item state correctly in API integrations; `phase` handling matters for multi-step reasoning/tool flows.

## GPT-5.4 Mini and Nano

- Smaller GPT-5.4 models need more explicit task structure and fewer implicit assumptions.
- Use narrow tasks, exact step order, edge-case behavior, and one correct example.
- Prefer closed outputs for tiny models: labels, enums, short JSON, or fixed templates.
- Route ambiguous, planning-heavy, or multi-step orchestration tasks to a stronger model rather than over-prompting a small model.

## Known Gotchas

- Do not carry over every older prompt instruction automatically; benchmark a smaller baseline first.
- Do not embed large schemas in prompt text when the API can enforce structured output.
- For date-sensitive products, pass the required business timezone or policy date explicitly rather than relying on generic model date awareness.

## Sources

- GPT-5.5 latest model guide: https://developers.openai.com/api/docs/guides/latest-model.md
- GPT-5.5 prompt guidance: https://developers.openai.com/api/docs/guides/prompt-guidance?model=gpt-5.5
- GPT-5.4 prompt guidance: https://developers.openai.com/api/docs/guides/prompt-guidance?model=gpt-5.4
- OpenAI prompt engineering overview: https://developers.openai.com/api/docs/guides/prompt-engineering
- Reasoning models: https://developers.openai.com/api/docs/guides/reasoning
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
