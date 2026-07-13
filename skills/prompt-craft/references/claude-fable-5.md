# Claude Fable 5 Prompting Notes

Last verified: 2026-07-13

## Scope

Use this reference for Claude Fable 5 and Claude Mythos 5. For Claude Opus 4.8, read [claude-opus-4.8.md](claude-opus-4.8.md).

## Fable 5 Behavior

- Strongest on long-horizon autonomy, first-shot correctness on complex well-specified problems, vision, enterprise document work, code review and debugging, ambiguity navigation, and parallel subagent orchestration.
- Assign it the hardest task in range and let it scope, ask clarifying questions, and execute. Testing only simple workloads undersells it; it still handles routine tasks reliably.
- Individual turns can run many minutes at higher effort, and autonomous runs can extend for hours. Adjust client timeouts, streaming, and progress UX before migrating; prefer async check-ins over blocking.
- Instruction following is strong enough that a brief instruction steers a whole behavior class. Do not enumerate every case; a short brevity or checkpoint rule covers its variants.
- Skills and prompts written for prior models are often too prescriptive and can degrade output. Trim instructions and re-test; keep only what changes behavior.

## Effort and API Controls

- Effort is the primary intelligence/latency/cost control. Default `high`; use `xhigh` for capability-sensitive work; `medium`/`low` for routine work still often exceeds prior-model `xhigh`.
- Adaptive thinking only; thinking output is summarized-only; extended-thinking budgets are not supported.
- Safety classifiers target offensive cybersecurity, biology/life-sciences methods, and extraction of summarized thinking; benign work in those areas can trigger `stop_reason: "refusal"`. Configure fallback to Claude Opus 4.8 for declined requests.
- Never instruct the model to echo, transcribe, or explain its internal reasoning in response text; that triggers the `reasoning_extraction` refusal category. Read structured `thinking` blocks instead. Audit migrated skills for show-your-thinking instructions.

## High-Leverage Prompt Patterns

- **Anti-overplanning:** "When you have enough information to act, act. Do not re-derive established facts, re-litigate decided questions, or narrate options you will not pursue. If weighing a choice, give a recommendation, not a survey."
- **Anti-overengineering at high effort:** "Don't add features, refactor, or introduce abstractions beyond what the task requires. Do the simplest thing that works. Only validate at system boundaries."
- **Grounded progress claims (long runs):** "Before reporting progress, audit each claim against a tool result from this session. Report only work you can point to evidence for; if unverified, say so. If tests fail, say so with the output." This nearly eliminates fabricated status reports.
- **Action boundaries:** "When the user is describing a problem or thinking out loud, the deliverable is your assessment—report findings and stop. Don't apply a fix until asked." Prevents unrequested actions (drafting emails, defensive git branches).
- **Checkpoints:** "Pause for the user only when the work genuinely requires them: a destructive or irreversible action, a real scope change, or input only they can provide."
- **Autonomous pipelines:** add a reminder that no user is watching, questions block the work, and the turn must not end on a plan, question, or promise—do the work with tool calls first.
- **Context-budget reassurance:** in very long sessions with a visible token countdown, the model may offer to summarize or start a new session. Hide budget counts where possible, or add: "You have ample context remaining. Do not stop, summarize, or suggest a new session on account of context limits."
- **Intent context:** performance improves when the prompt says why: "I'm working on [larger task] for [who]. They need [what the output enables]. With that in mind: [request]."

## Subagents, Memory, and Long Runs

- Fable 5 dispatches parallel subagents readily and manages long-running peer communication dependably. State when delegation is appropriate and prefer async coordination over blocking on each subagent; long-lived subagents keeping context across subtasks save cost via cache reads.
- Separate fresh-context verifier subagents outperform self-critique. For long runs, instruct it to establish a self-check method and verify with subagents against the spec at a fixed interval.
- It excels with a memory system: give it a place to write one lesson per file with a one-line summary, updating rather than duplicating, deleting notes proven wrong.
- Final-summary readability: after long agentic stretches, instruct it to drop working shorthand—no arrow chains or invented labels; outcome first, complete sentences, re-grounding for a reader who saw none of the work.
- For long async agents, add a `send_to_user` tool that renders its input verbatim mid-turn, and pair it with explicit elicitation language; without the instruction the model rarely calls it.

## Known Gotchas

- Deep into long sessions it can end a turn with a stated intent ("I'll now run X") without the tool call, or ask permission it doesn't need. A "continue" suffices; prevent it with the checkpoint + autonomous-pipeline instructions above.
- Contradictory or redundant rules destabilize it more than missing detail; simplify before adding instructions.
- Not intended for offensive cybersecurity or biology/life-sciences work; expect refusals there.

## Sources

- Prompting Claude Fable 5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5
- Introducing Claude Fable 5 and Claude Mythos 5: https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5
- Claude prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Refusals and fallback: https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback
