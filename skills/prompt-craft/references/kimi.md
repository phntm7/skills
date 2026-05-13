# Kimi Prompting Notes

Use this reference for Kimi models, especially Kimi K2.6. Kimi's general prompt best-practice page is not deeply model-specific, so combine these notes with current model capability docs when the exact Kimi version matters.

## Kimi K2.6

- Kimi K2.6 documentation highlights improved long-context coding stability; prompt large coding tasks with explicit scope, target files, and completion criteria.
- Use clear instructions and include enough context that the model does not need to guess.
- Assign a role when domain expertise or response framing matters.
- Use delimiters such as XML tags, triple quotes, and headings to separate source material, examples, and instructions.
- Define the steps needed for fragile workflows.
- Provide examples when the desired style or output format is hard to describe.
- Specify output length by paragraphs, bullets, or sections rather than exact word counts.
- For grounded answers, provide reference text and state how to respond when the answer is not in the reference.
- For long-running conversations, summarize or filter previous turns before the context becomes noisy.
- For long documents, chunk, summarize, and recursively aggregate summaries.

## Sources

- Kimi prompt best practices: https://platform.kimi.ai/docs/guide/prompt-best-practice
- Kimi K2.6 quickstart: https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart
- Kimi docs index: https://platform.kimi.ai/docs/llms.txt
