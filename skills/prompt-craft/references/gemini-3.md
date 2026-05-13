# Gemini 3 Prompting Notes

Last verified: 2026-05-13

## Scope

Use this reference for Gemini 3 and Gemini 3.1 Pro.

## Gemini 3 / 3.1 Pro

- Keep temperature at the default for Gemini 3 unless you have eval evidence that another setting helps. Google's Vertex guidance warns that lowering temperature can degrade complex reasoning or cause loops.
- Be direct and concise. Put the task and critical constraints in clear language rather than conversational padding.
- For lower latency, use low thinking settings and instructions such as silent thinking where supported.
- Avoid blanket negative constraints such as "do not infer" when the task still requires deduction. Instead, say what source material may be used for deductions and what external knowledge is disallowed.
- Use split-step verification when the model may lack a capability or source: first verify access or information, then answer only if verified.
- Place the main task and critical restrictions, especially negative or quantitative constraints, close to the end of the instruction when the request is complex.
- Be careful with personas. Gemini can over-prioritize persona adherence, so avoid personas that conflict with task rules.
- For grounded or hypothetical contexts, explicitly state that the provided context is the source of truth for the session.
- Use tags or Markdown sections to separate role, constraints, context, task, and output format.
- Gemini 2.5/3-series models already use internal thinking; only request visible plans or reasoning when the output needs them. For hard tasks, a brief instruction to think hard can improve quality but increases thinking tokens.

## Multimodal and Large Context

- Label every input clearly: document names, image numbers, timestamps, CSV columns, screenshots, videos, and logs.
- Refer to specific inputs by label instead of "this" or "the attachment."
- Put large context before the task, then restate the exact task and constraints after the context.
- For agentic workflows, prompt explicitly for reasoning strategy, persistence/recovery behavior, risk handling, ambiguity rules, and output precision.

## Sources

- Vertex AI Gemini 3 prompting guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide
- Gemini API prompt design strategies: https://ai.google.dev/gemini-api/docs/prompting-strategies
- Google AI thinking docs: https://ai.google.dev/gemini-api/docs/thinking
- Third-party, opinionated Gemini 3 notes by Joey deVilla: https://www.globalnerdy.com/2025/11/26/notes-on-using-gemini-3-pro-part-3-every-prompting-tip-and-trick-i-know-so-far/
