# Claude Fable 5.1 Prompting Notes

Checked: 2026-10-27

Use for `claude-fable-5-1`. For Opus, read
[claude-opus-5-5.md](claude-opus-5-5.md).

## Model-Specific Adjustments

- Start at `high` (the API default), then evaluate `low`, `medium`, `xhigh`,
  and `max` for the workload. At low effort, explicitly require retrieval
  when fresh evidence matters.
- Before prompting for more progress narration, render the model's thinking
  updates: `display: "updates"` needs the documented beta. Remove old rules
  suppressing updates. Request a self-contained final outcome when needed.
- If agent loops serialize independent tool calls, ask for independent next
  calls together after tool results. Preserve dependencies.
- Keep API history append-only and replay thinking blocks unchanged; editing
  earlier turns or the prefix can invalidate the conversation.
- Constrain edits and tests to the requested scope. State remaining deliverables
  if runs stop early; preserve constraints and exact details across compaction.
- Allow enough output budget and time for long deliverables at higher effort.

## Shared Claude Guidance

Use clear outputs, relevant examples, and labeled sources. Thinking is always
on for this model; do not substitute response-text reasoning for supported
thinking summaries. Add workflow instructions only for observed gaps. Generic
anti-laziness prompts and mandatory verifier subagents obscure actual scope
and completion criteria.

## Sources

- [Prompting Claude Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1)
- [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
