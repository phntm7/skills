# Claude Fable 5.1 & Fable 5 Prompting Notes

Last verified: 2026-09-03

## Scope

Use this reference for Claude Fable 5.1, Claude Fable 5, and Claude Mythos 5.1/5. For Claude Opus 4.8 or Claude Code, read [claude-opus-4.8.md](claude-opus-4.8.md).

## Fable 5.1 Behavior & What Changed

- **Frontier capabilities**: Strongest on long-horizon autonomy, complex multi-file engineering, vision, code review, ambiguity navigation, and parallel subagent orchestration.
- **Effort level calibration**: Effort is the primary control for trading off capability, latency, and cost. Test across all five levels: `low`, `medium`, `high` (default), `xhigh`, and `max`.
  - At `medium`, quality roughly matches Fable 5 at lower cost and latency.
  - At `low`, Fable 5.1 is often competitive with Claude Opus on cost per task while scoring higher.
  - At `xhigh` and `max`, capability gains are largest, but the model thinks longer before writing; ensure client timeouts and `max_tokens` budgets are large (e.g. 16k–64k).
- **Tool-call batching in loops**: In coding and computer-use loops where independent next calls are implied by the task, Fable 5.1 may issue calls one per turn unless explicitly nudged. Use this one-sentence nudge:
  `"First privately list what you need next; then request every item that doesn't depend on another's result in this one response."`
  Deliver this after tool results, or as a turn-scoped system message (`clear_at: "next_user_message"`, beta `mid-conversation-system-clear-at-2026-08-21`).
- **Append-only conversation history**: Keep the transcript strictly append-only. Never delete earlier turns, edit tool results, or strip thinking blocks between requests. Doing so returns `bound to a different conversation`, invalidates subsequent thinking blocks, and restarts the prompt cache.
- **User-facing progress updates**: Fable 5.1 is quieter during long tool-calling turns than Fable 5.
  - Updates are emitted as progress-update `thinking` blocks, which are empty by default (`thinking.display: "omitted"`). Set `display: "updates"` (beta: `thinking-display-updates-2026-08-18`) or `"summarized"`.
  - If more narration is needed, prompt: *"Before you start, say in a line what you're about to do; brief updates while you work help the user follow along. Close with a short recap that stands on its own — what you found, what you did, and what's next."*
  - If the client UI hides tool output, notify the model: *"Only you see that command's output — the user's terminal shows at most a few lines of it. If the user needs to read any of it, put it in your reply."*
- **Scope & test discipline**: Fable 5.1 follows scope strictly when instructed. Prevent unrequested refactoring or speculative test files: *"Keep changes and tests strictly to what the task asks for. Do not introduce unrequested abstractions or commit speculative test suites."*
- **Search triggering at low effort**: At `low` effort, Fable 5.1 calls search/retrieval tools less frequently and may answer from memory. Instruct it explicitly when retrieval is required.
- **Concurrent lead agent**: In subagent workflows, instruct the lead agent to continue independent work while subagents run, rather than idling until subagent results return.
- **Vision precision**: For dense diagrams, charts, and small UI elements, provide tools to crop and zoom into high-density regions.
- **Safeguard false positives**: Benign cybersecurity, vulnerability research, and systems code can occasionally trigger `stop_reason: "refusal"`. Provide clear defensive context and user intent up front.

## Effort and API Controls

- **Thinking modes**: Adaptive thinking only. Extended-thinking token budgets are not supported.
- **Reasoning extraction protection**: Never instruct the model to echo, transcribe, or explain its internal reasoning in response text; that triggers the `reasoning_extraction` refusal category. Read structured `thinking` blocks instead.
- **Fallback**: Configure fallback to Claude Opus 4.8 or Sol for declined requests.

## High-Leverage Prompt Patterns

- **Anti-overplanning**: *"When you have enough information to act, act. Do not re-derive established facts, re-litigate decided questions, or narrate options you will not pursue. If weighing a choice, give a recommendation, not a survey."*
- **Anti-overengineering**: *"Don't add features, refactor, or introduce abstractions beyond what the task requires. Do the simplest thing that works. Only validate at system boundaries."*
- **Grounded progress claims**: *"Before reporting progress, audit each claim against a tool result from this session. Report only work you can point to evidence for; if unverified, say so. If tests fail, say so with the output."*
- **Action boundaries**: *"When the user is describing a problem or thinking out loud, the deliverable is your assessment — report findings and stop. Don't apply a fix until asked."*
- **Checkpoints**: *"Pause for the user only when the work genuinely requires them: a destructive or irreversible action, a real scope change, or input only they can provide."*
- **Autonomous pipelines**: Remind the agent that no user is watching, questions block the work, and the turn must not end on a plan, question, or promise — do the work with tool calls first.
- **Compaction preservation**: In compaction prompts, state: *"Preserve completed work, active decisions, code identifiers, file paths, and unresolved blockers. Drop working reasoning and redundant tool outputs."*

## Subagents and Orchestration

- Fable 5.1 dispatches parallel subagents readily. Prefer async coordination over blocking on each subagent.
- Use separate fresh-context verifier subagents for final reviews rather than self-critique.
- Memory: Provide a clean store to write one lesson per file with a one-line summary, updating rather than duplicating.
- Final summary: After long agentic stretches, instruct the agent to drop working shorthand — state the outcome first, in complete sentences, re-grounded for a reader who saw none of the intermediate steps.

## Known Gotchas

- **Quiet turns**: May execute 10+ tool calls without text; configure `display: "updates"` or prompt for progress updates.
- **Serial tool calls in coding loops**: Nudge with the private-listing batching directive.
- **History rewriting**: Any edit to previous turns breaks thinking blocks and prompt caching.
- **Low effort search reluctance**: Explicitly mandate search if operating at `low` effort.

## Sources

- Prompting Claude Fable 5.1: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1
- What's new in Claude Fable 5.1: https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1
- Claude prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Mid-conversation system messages: https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages
