# Claude Opus 4.7 Prompting Notes

Last verified: 2026-05-13

## Scope

Use this reference for Claude Opus 4.7, Claude Code, and Claude 4.x-family prompt tuning.

## Opus 4.7 Behavior

- Opus 4.7 is strong for long-horizon agentic work, coding, knowledge work, vision, and memory tasks.
- It tends to interpret prompts more literally than Opus 4.6, especially at lower effort. Do not rely on it to silently generalize one instruction to adjacent cases.
- It calibrates response length by perceived task complexity. If product output length matters, specify the desired concision, detail level, and examples.
- It is more direct and less validation-forward than some prior Claude models; retune voice prompts if the product depends on a specific tone.
- Anthropic documents that it tends to spawn fewer subagents by default. If parallel delegation is desirable, explicitly say when to fan out and when to keep work local.
- Anthropic documents that it tends to use tools less by default than Opus 4.6. If tool usage is required, state the evidence or action conditions that require tools.

## Effort, Thinking, and API Controls

- For coding and agentic work, start with `xhigh` effort where available; use at least `high` for intelligence-sensitive work.
- If a complex task must stay at low effort for latency, add targeted guidance to think carefully through the multi-step problem.
- Opus 4.7 uses adaptive thinking. Fixed extended-thinking budgets are not supported.
- Do not set non-default `temperature`, `top_p`, or `top_k` for Opus 4.7 API calls; use prompting and effort controls to steer behavior.
- Re-check token budgets after migration because Opus 4.7 uses a newer tokenizer and can use more tokens for the same text.

## Prompt Caching

- Keep stable instructions and reference context in consistent positions so cacheable prefixes remain stable.
- Place volatile user-specific context later in the prompt.
- Re-check provider-specific cache controls and TTL behavior before tuning production traffic; cache mechanics change more often than prompt principles.

## Claude Code Prompting

- Treat the first turn like delegation to a capable engineer: include intent, constraints, acceptance criteria, and relevant files up front.
- Avoid feeding an ambiguous task across many small turns when a complete first turn is possible.
- For long sessions, specify context/session management expectations and what should be preserved across turns.
- For status updates, remove old scaffolding first; if updates are still poorly calibrated, specify their length and content with examples.

## Known Gotchas

- Do not rely on non-default sampling parameters for Opus 4.7; Anthropic recommends prompting and effort controls for behavior steering.
- If lower effort under-thinks, raise effort before adding a large prompt workaround.

## Sources

- Claude prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Claude model migration guide: https://platform.claude.com/docs/en/about-claude/models/migration-guide
- Claude Opus 4.7 with Claude Code: https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code
- Claude prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
