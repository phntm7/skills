# DeepSeek Prompting Notes

Last verified: 2026-05-13; may be stale (newer version-specific guidance not verified).

## Scope

Model names checked: 2026-10-27. The official quickstart now recommends
`deepseek-flash`, served by DeepSeek-V4.1-Flash-1017. Legacy
`deepseek-v4-flash` requests are also served by that model; this runtime alias
is not evidence that historical V4 benchmark results belong to V4.1.

The behavior and controls below were verified for DeepSeek V4 Pro / Flash
in May, not revalidated for V4.1. Treat third-party gateways and local wrappers as separate integration surfaces because they may not preserve DeepSeek reasoning fields correctly.

## Behavior and Tuning

- DeepSeek V4 supports thinking and non-thinking modes. Thinking mode is enabled by default in the official API.
- Use thinking mode for complex reasoning, math, debugging, planning, and agentic tool workflows.
- Disable thinking for simple, latency-sensitive tasks when the extra reasoning is not useful.
- In thinking mode, `low` and `medium` reasoning efforts map to `high`; `xhigh` maps to `max`.
- In thinking mode, sampling controls such as `temperature`, `top_p`, `presence_penalty`, and `frequency_penalty` have no effect in the official API.

## API Controls

- OpenAI-compatible calls use `extra_body={"thinking": {"type": "enabled"}}` or `{"type": "disabled"}`.
- Use `reasoning_effort: "high"` or `"max"` for thinking effort in OpenAI-compatible calls.
- Anthropic-compatible calls use `output_config.effort` for effort control.
- Legacy aliases map to V4 Flash modes: `deepseek-chat` maps to non-thinking mode and `deepseek-reasoner` maps to thinking mode. The earlier docs scheduled deprecation for 2026-07-24; that date has passed, so verify availability rather than relying on these aliases.

## Tool Use and Agentic Patterns

- Thinking mode supports tool calls, but clients must preserve `reasoning_content` correctly.
- If the model performs a tool call, pass the assistant turn's `reasoning_content` back in subsequent requests as the official examples show.
- If a client cannot preserve DeepSeek's reasoning fields, prefer non-thinking mode or use the official API surface directly.
- For tools, keep schemas simple and provide concrete descriptions of when to call each tool.

## Structured Output

- Use explicit output contracts and short examples for JSON or other strict formats.
- Validate generated JSON outside the model; do not rely on prompt instructions alone for production parsing.

## Known Gotchas

- Some OpenAI/Anthropic-compatible clients hide or drop reasoning fields. That can break thinking-mode tool calls.
- Prompting cannot compensate for an integration that fails to replay required `reasoning_content`.
- Do not port GPT, Claude, or Qwen sampling defaults into DeepSeek thinking mode; the official API ignores several sampling parameters there.

## Sources

- DeepSeek API quickstart: https://api-docs.deepseek.com/
- DeepSeek thinking mode: https://api-docs.deepseek.com/guides/thinking_mode
