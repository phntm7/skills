# Skill Evaluation

Last verified: 2026-05-13

## Purpose

Evaluate skills with realistic prompts before treating them as reusable. The goal is not to prove perfection; it is to catch missing instructions, weak trigger descriptions, unnecessary context, and repeated work that should become a script or reference.

## Lightweight Default

For most personal skills:

1. Write 2-5 should-trigger prompts that resemble real user requests.
2. Write 2-3 near-miss prompts that share vocabulary but should not trigger the skill.
3. Run or mentally simulate at least one should-trigger prompt.
4. Check whether the agent would load the right references, use bundled scripts, and produce the expected output.
5. Revise the description and instructions from observed failures.

## Stronger Evaluation Loop

Use this when the skill has objective outputs, expensive consequences, or will be reused often:

- Compare output with and without the skill.
- Grade against concrete expectations.
- Ask the user to review qualitative outputs before optimizing.
- Track pass/fail, time, and token cost across iterations.
- Use blind comparisons when two skill versions both look plausible.

## Trigger Evaluation

Good trigger queries are realistic and include context. Avoid trivial examples.

Should-trigger examples should cover:

- direct requests;
- indirect phrasing;
- typos or casual language;
- adjacent tasks where this skill should still win;
- file types, platform names, or tool names that matter.

Should-not-trigger examples should be near misses:

- shared keywords but different intent;
- adjacent domains owned by another skill;
- simple tasks that the base agent can handle without the skill.

## Avoid Overfitting

- Do not add a rule that only fixes one eval unless the rule generalizes.
- Prefer explaining why a behavior matters over adding rigid "always/never" rules.
- If agents repeatedly write the same helper code, promote that code into `scripts/`.
- If agents repeatedly search for the same reference, promote that knowledge into `references/`.

## Sources

- Anthropic skill creator eval workflow: https://github.com/anthropics/skills/tree/main/skills/skill-creator
- OpenAI skill creator validation workflow: https://github.com/openai/skills/tree/main/skills/.system/skill-creator
