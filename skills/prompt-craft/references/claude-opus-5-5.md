# Claude Opus 5.5 Prompting Notes

Checked: 2026-10-27

Use for `claude-opus-5-5` and Claude Code on Opus 5.5. For Fable, read
[claude-fable-5-1.md](claude-fable-5-1.md).

## Model Controls and Harness

- Start at `medium` (the API default); evaluate other effort levels. Effort
  labels are not equivalent across generations. Reserve `xhigh` and `max` for
  measured gains.
- Thinking is always on. Remove thinking-disabled request settings and
  response-text reasoning workarounds; lower effort for latency.
- Allow output space for thinking plus the reply. Anthropic tested 128,000
  `max_tokens` for long coding turns; this is a ceiling, not a universal budget.
- Inspect content blocks by type. Progress notes arrive in thinking blocks;
  render `display: "updates"` using the documented beta when needed.
- In unattended loops, track unfinished items rather than interpreting every
  text-only `end_turn` as completion. Bound automatic continuations and await
  outstanding operations. Keep human confirmation boundaries intact.

## Prompt Tuning

Use explicit deliverables, relevant context, and scope. Keep useful existing
Opus prompts, then remove obsolete pressure language and redundant procedures.
Retain concrete acceptance checks; avoid adding generic verification loops
merely because an older model needed them.

Treat pasted text as source data. For dense visuals, offer crop/zoom tools.
Ask for a short explanation when useful; use supported thinking summaries
rather than requesting internal reasoning in response text.

## Sources

- [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
- [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
