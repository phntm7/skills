# Smaller Model Prompting Notes

Last verified: 2026-05-13

## Scope

Use this reference for mini, nano, flash, local, and cost-optimized models.

## General Rules

- Narrow the task. Smaller models do better with one bounded job than with broad orchestration.
- Make implicit steps explicit: inputs, transformation, decision rules, edge cases, and output format.
- Use closed outputs where possible: labels, enums, fixed JSON, short bullet lists, or templates.
- Include one correct example and, when needed, one counterexample.
- Keep context small and highly relevant. Remove unrelated history and old tool results.
- Prefer short prompts with high-signal constraints over long policy stacks.
- Avoid relying on unstated conventions, cross-file inference, or broad "be smart" instructions.
- Add verification steps only when they are simple and concrete; complex self-critique can waste tokens or degrade answers.
- Route ambiguous tasks, multi-hop research, hard planning, large refactors, and high-impact decisions to stronger models.

## When to Escalate

Escalate to a stronger model when the task requires:

- inferring unstated architecture or product intent;
- reconciling conflicting instructions;
- planning across many files or documents;
- tool use with side effects;
- reliable citations or evidence synthesis;
- nuanced tone, legal/medical/financial judgment, or security reasoning.

## Sources

- OpenAI GPT-5.4 small-model guidance: https://developers.openai.com/api/docs/guides/prompt-guidance?model=gpt-5.4
- Gemini API prompt design strategies: https://ai.google.dev/gemini-api/docs/prompting-strategies
- Kimi prompt best practices: https://platform.kimi.ai/docs/guide/prompt-best-practice
- Qwen Cloud model guidance: https://docs.qwencloud.com/developer-guides/getting-started/text-generation-models
