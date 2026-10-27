# OpenAI GPT-6 Prompting Notes

Checked: 2026-10-27

## Current Targets and Controls

- `gpt-6-astra`: highest capability; `gpt-6.1-sol`: complex work at lower cost.
- `gpt-6.1-terra`: visual reasoning, computer use, and writing;
  `gpt-6-luna`: focused, high-volume work.
- Astra and GPT-6.1 Sol do not accept effort `none`. Use Responses for tool
  workflows; verify controls for the exact model rather than copying a sibling.

## Prompting for the Current Family

The latest-model guide's behavioral advice was measured on Astra; evaluate it
on Sol, Terra, and Luna before generalizing.

Define scope, completion, and which actions the request authorizes. Astra can
pause for clarification or after a first implementation; specify remaining
work and when input is truly blocking. Carry out already-authorized preparation
before requesting a final decision.

Audit conflicting instructions in skills and repository files. Specify desired
prose, structure, and length. State when delegation is useful if the harness
supports it. Scale tests to the change and required checks; broaden or repeat
only when failures or new evidence warrant it.

## Simplify Skills and Repository Prompts

The Astra skills article recommends auditing inherited scaffolding:

- Keep descriptions short, with specific triggers; broad descriptions load
  unrelated skills and consume context.
- Make root skills routers. Load optional workflows and references only for
  the branch that needs them.
- Replace rigid recipes with outcomes and domain constraints where the model
  can choose the procedure. Guidance that helps Luna may overconstrain Astra.
- Link repository docs by the situation that calls for them rather than
  requiring a full reading stack for each edit.
- Remove generic test encouragement that duplicates default behavior. Preserve
  required checks and make routine local authorization clear.
- Define the intended end state and actual approval boundaries. Blanket
  ask-first rules and premature review stops can prevent completion.

When migrating, test a leaner baseline on representative tasks. Keep schemas,
examples, and constraints that encode product requirements or fix measured
failures. Remove capitalized pressure and anti-laziness boilerplate rather
than porting them automatically.

## Sources

- [OpenAI latest-model guide](https://developers.openai.com/api/docs/guides/latest-model)
- [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
