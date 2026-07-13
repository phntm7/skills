# Claude Opus 4.8 Prompting Notes

Last verified: 2026-07-13

## Scope

Use this reference for Claude Opus 4.8, Claude Code on Opus, and Claude 4.x-family prompt tuning. For Claude Fable 5, read [claude-fable-5.md](claude-fable-5.md).

## Opus 4.8 Behavior

- Strong on long-horizon agentic work, knowledge work, vision, and memory tasks. Existing Opus 4.7 prompts work well out of the box.
- Calibrates response length to perceived task complexity: shorter on simple lookups, much longer on open-ended analysis. If output style matters, tune it in the prompt; positive examples of the right concision beat lists of prohibitions.
- Interprets prompts literally, especially at lower effort. It does not silently generalize an instruction to adjacent cases or infer unstated requests. State scope explicitly ("apply this to every section, not just the first").
- Favors reasoning over tool calls by default. Raise effort (`high`/`xhigh`) to increase tool usage in agentic search and coding; or explicitly describe when and why to use a tool.
- Spawns fewer subagents by default. If fan-out is desirable, say when: "Spawn multiple subagents in the same turn when fanning out across items; don't spawn one for work you can complete directly."
- Provides regular, well-calibrated user-facing progress updates on long traces. Remove old scaffolding that forces interim status messages; re-add explicit format guidance only if calibration is off.
- Direct, opinionated prose with minimal validation-forward phrasing and sparing emoji. Re-tune voice prompts if the product needs warmth ("Use a warm, collaborative tone. Acknowledge the user's framing before answering.").

## Effort, Thinking, and API Controls

- Start at `xhigh` for coding and agentic use; minimum `high` for intelligence-sensitive work. `max` can help hard tasks but shows diminishing returns and can overthink. Effort matters more on this model than any prior Opus.
- Effort levels are respected strictly at the low end: at `low`/`medium` the model scopes work to exactly what was asked. If you see shallow reasoning, raise effort rather than prompting around it; if latency pins you at `low`, add "This task involves multi-step reasoning. Think carefully through the problem before responding."
- Thinking is off unless you set `thinking: {type: "adaptive"}`. Triggering is steerable in both directions by prompt; measure the effect.
- At `max`/`xhigh`, set a large max-output budget (start at 64k tokens) so the model has room to think and act across subagents and tool calls.
- Do not set non-default `temperature`/`top_p`/`top_k`; steer with prompting and effort.

## Interactive vs. Autonomous Coding

- Token usage is higher in interactive multi-turn sessions because the model reasons more after user turns. For efficiency and performance: use `xhigh`/`high`, add autonomous modes, and front-load task, intent, and constraints in the first turn rather than drip-feeding across turns.
- Treat the first turn like delegation to a capable engineer: intent, constraints, acceptance criteria, relevant files.

## Code Review Harnesses

- Meaningfully better bug-finding recall and precision, but harnesses tuned for older models can measure lower recall: instructions like "only report high-severity issues" are followed faithfully, so real findings get filtered before reporting.
- For coverage-first review stages: "Report every issue you find, including uncertain or low-severity ones. Do not filter for importance or confidence at this stage. Include confidence and estimated severity per finding for downstream ranking."
- If self-filtering in one pass, define the bar concretely ("bugs that could cause incorrect behavior, a test failure, or a misleading result; omit pure style or naming nits"), not qualitatively ("important").

## Design and Frontend Defaults

- Persistent default house style: warm cream backgrounds (~#F4F1EA), serif display type, terracotta/amber accents. Generic negations ("don't use cream") swap to another fixed palette rather than variety. Either specify a concrete visual direction (palette hexes, type, radii, layout), or have the model propose 3–4 distinct directions first and implement the chosen one.
- Needs less anti-"AI slop" prompting than prior models; a short `<frontend_aesthetics>` snippet banning generic fonts, purple gradients, and cookie-cutter layouts suffices.

## Computer Use and Caching

- Computer use works up to 2576px / 3.75MP; 1080p balances performance and cost, 720p/1366×768 for cost-sensitive workloads.
- Keep stable instructions in consistent positions for cache-friendly prefixes; place volatile user context later.

## Known Gotchas

- Literalism cuts both ways: precise pipelines benefit; prompts relying on silent generalization regress. Audit instructions for implicit scope.
- Lower measured review recall after migration is usually a harness effect (self-filtering), not a capability regression.
- If lower effort under-thinks, raise effort before adding prompt workarounds.

## Sources

- Prompting Claude Opus 4.8: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8
- What's new in Claude Opus 4.8: https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8
- Migration guide: https://platform.claude.com/docs/en/about-claude/models/migration-guide
- Claude prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Effort parameter: https://platform.claude.com/docs/en/build-with-claude/effort
