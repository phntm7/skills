# Claude Opus 5 & Opus 4.8 Prompting Notes

Last verified: 2026-09-03

## Scope

Use this reference for Claude Opus 5 (flagship), Claude Opus 4.8, Claude Code on Opus, and Claude 4.x-to-5 migration. For Claude Fable 5.1, read [claude-fable-5.md](claude-fable-5.md).

## Claude Opus 5

### Capability & Behavior Shifts
- **End-to-end agentic coding**: Strongest on difficult multi-file features, architectural refactors, and complete implementation runs. Completes full tasks without leaving stubs, placeholders, or premature stops. Give the full specification up front and let it execute.
- **Code review & bug detection**: Reviews code with high precision and recall. Accurately flags real logic bugs rather than nitpicks, even at `low` or `medium` effort.
  - *Avoid restrictive filters*: Prompts like "only report high-severity bugs" or "be conservative" cause Opus 5 to follow instructions literally and withhold valid findings. Ask it to report all bugs and filter severity in a separate pass.
- **Effort efficiency**: `low` and `medium` effort deliver high quality at a fraction of tokens and latency. Default is `high`; use `xhigh` for demanding coding and autonomous tasks.
- **1M token context window**: 1M default and maximum context window with consistent instruction following and retrieval throughout the window.
- **Vision excellence**: Strong on charts, architecture diagrams, UI design, and visual verification. Provide tools to crop, zoom, and visually verify changes rather than relying on thinking alone.
- **Office deliverables**: Generates multi-sheet spreadsheets with complex formulas and formatted slide decks.

### Critical Prompt Tuning for Opus 5

#### 1. Response Verbosity & Length Calibration
Opus 5 user-facing responses run longer by default than prior Opus models. Effort controls thinking volume, not response length—lowering effort does not reliably shorten answers. Prompt explicitly for concision:
```text
Keep responses focused, brief, and concise. Keep caveats short, and spend most of the response on the main answer. Provide high-level summaries unless an in-depth explanation is specifically requested.
```

#### 2. Progress Updates & Narration Cadence
Opus 5 narrates actively during agentic sessions. Explicitly define the desired communication cadence:
```text
Before your first tool call, say in one sentence what you are about to do. While working, give a brief update only when you find something important or change direction. When you finish, lead with the outcome: state what was done first, with supporting evidence after.
```

#### 3. Written Deliverable Length
Documents written to disk (markdown summaries, specs, reports) tend to expand. Constrain them:
```text
Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.
```

#### 4. Scope Discipline & Anti-Oververification
- **Remove verification instructions**: Opus 5 verifies its own work automatically. Explicit instructions like "include a final verification step" or "use a subagent to double-check" cause over-verification, looping, and token waste.
- **Constrain unrequested expansion**:
  ```text
  Deliver what was asked, at the scope intended. Make routine judgment calls yourself, and check in only when different readings of the request would lead to materially different work. If the request seems mistaken, say so in a sentence and continue as asked rather than quietly transforming the scope. Stop short of actions beyond what was asked.
  ```

#### 5. Controlling Subagent Spawning
Opus 5 delegates to subagents readily. While effective for wide parallel exploration, it can multiply cost and latency if applied to small tasks:
```text
Delegate to a subagent only for large tasks that are genuinely independent and parallelizable, such as a wide multi-file investigation. Do not delegate work you can finish yourself in a handful of tool calls, and do not use subagents to verify your own work.
```
In Claude Code / Claude Agent SDK, set deterministic caps via `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.

#### 6. Self-Correction Narration
Opus 5 catches its own mistakes well, but can over-narrate minor slips:
```text
Only correct an earlier statement when the error would change the user's code, conclusions, or decisions. State corrections plainly and briefly, then continue. For minor slips that change nothing, make the fix and move on without noting it.
```

#### 7. Running with Thinking Disabled
Thinking is on by default in Opus 5 and can only be disabled at effort `high` or lower. If disabled, tool calls may occasionally leak as plain text or emit internal XML tags. Mitigate with:
```text
When you use a tool, you may say a brief sentence first. If no tool can express what the user asked for, say so instead of guessing. Do not include internal or system XML tags in your response.
```
*Best practice*: Prefer `low` effort with thinking enabled over disabling thinking entirely.

---

## Claude Opus 4.8

- Interprets prompts literally at low effort. Does not silently generalize instructions to adjacent files without explicit scope.
- Favors reasoning over tool calls by default; raise effort (`high`/`xhigh`) to increase tool usage in agentic workflows.
- House visual style: defaults to warm cream backgrounds (`#F4F1EA`) and serif display type; specify exact color palettes and font tokens for modern frontend deliverables.
- Keep stable system prompts at the beginning for prompt caching.

## Sources

- Prompting Claude Opus 5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
- What's new in Claude Opus 5: https://platform.claude.com/docs/en/models/opus-5/whats-new-opus-5
- Migrating from Opus 4.8 to Opus 5: https://platform.claude.com/docs/en/models/opus-5/migration-guide
- Effort parameter: https://platform.claude.com/docs/en/build-with-claude/effort
