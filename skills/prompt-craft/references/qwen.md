# Qwen Prompting Notes

Use this reference for Qwen3.6 and Qwen3-family models. Qwen's official Qwen3.6 repository currently points to a user guide that is still coming, so treat these notes as current capability and formatting guidance rather than a complete prompting guide.

## Qwen3.6

- Qwen3.6 emphasizes agentic coding, repository-level reasoning, and thinking preservation across conversation history.
- For Qwen Cloud, prefer `qwen3.6-plus` for strongest reasoning, full tool support, and 1M context; try `qwen3.6-flash` after the use case is working to reduce cost.
- Use long context deliberately: label large documents/codebase slices and state which parts are authoritative.
- Use thinking mode for multi-step math, debugging, architecture planning, legal cross-referencing, and other hard reasoning tasks.
- Disable thinking for simple tasks or background suggestions where latency and token cost matter more than reasoning depth.
- For structured output, use non-thinking mode when the provider requires it.
- For tool use, rely on the provider or tokenizer's chat template rather than hand-rolled formatting. Qwen docs recommend tokenizer formatting or Qwen-Agent for tool calls.
- Watch for reasoning/tool formatting differences across Qwen providers and local inference stacks. Validate tool calls and JSON outputs before production use.

## Qwen3 General

- Qwen3 supports thinking and non-thinking behavior. In local templates, `enable_thinking` controls the mode; `/think` and `/no_think` can be used as soft switches in prompts where supported.
- Qwen3 thinking content is separated from final answers with `<think>` markup. Do not ask for hidden reasoning in final user-visible output unless the product explicitly needs reasoning traces.
- For Qwen3 local inference, avoid greedy decoding in thinking mode; use the model's recommended sampling settings unless you have eval evidence to change them.
- Use standard chat templates; incorrect templates can hurt instruction following and tool use.

## Sources

- Qwen3.6 official repository: https://github.com/QwenLM/Qwen3.6
- Qwen Cloud text generation models: https://docs.qwencloud.com/developer-guides/getting-started/text-generation-models
- Qwen quickstart and thinking mode: https://qwen.readthedocs.io/en/v3.0/getting_started/quickstart.html
- Qwen key concepts: https://qwen.readthedocs.io/en/latest/getting_started/concepts.html
- Qwen function calling: https://qwen.readthedocs.io/en/stable/framework/function_call.html
- Qwen Agent configuration: https://qwenlm.github.io/Qwen-Agent/en/guide/get_started/configuration/
