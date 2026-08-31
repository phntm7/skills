# Security Review

Use this reference for the **Security** lens when reviewing a diff or PR-sized change set. Classify by risk, not size: small changes can break security invariants, and a refactor is HIGH until proven LOW.

This is a review-only task. Flag security problems, explain the attack path, and recommend concrete remedies. Do not modify the code; leave delivery of the findings to the caller.

Use the Blocker/Major/Minor/Nit scale from `SKILL.md` and the findings schema in [report-format.md](report-format.md). Risk level controls review depth; it does not replace finding severity.

## Risk-first triage

| Risk Level | Triggers |
|------------|----------|
| HIGH | Auth, crypto, external calls, value transfer, validation removal |
| MEDIUM | Business logic, state changes, new public APIs |
| LOW | Comments, tests, UI, logging |

Classify by RISK, not size. Analyze a refactor as HIGH until proven LOW.

### Immediate escalation triggers

- Removed code from "security", "CVE", or "fix" commits
- Authorization or visibility restrictions removed
- Validation removed without replacement
- External calls added without checks
- High blast radius (50+ callers) + HIGH risk change

An escalation trigger demands full history, caller, data-flow, and attacker analysis. It does not by itself make a Blocker.

## Micro-adversarial analysis

Ask for each addition, modification, or removal:

- What attack did removed code prevent?
- What new surface does new code expose?
- Can modified logic be bypassed?
- Are checks weaker? Edge cases covered?

## History on removals

Run `git blame` and inspect the introducing commit for removed safeguards, checks, authorization, validation, and error handling. If the removed code came from a commit whose subject or context says "security", "CVE", or "fix", escalate immediately. State what invariant the old code enforced and whether the replacement preserves it.

Use the Five Whys to recover intent:

- WHY was this code changed?
- WHY did the original code exist?
- WHY might this break?
- WHY is this approach chosen?
- WHY could this fail in production?

## Risk elevation rules

- NEW function + NO tests → Elevate risk MEDIUM→HIGH
- MODIFIED validation + UNCHANGED tests → HIGH RISK
- Complex logic (>20 lines) + NO tests → HIGH RISK

## Blast radius

Classify blast radius:

- 1-5 calls: LOW
- 6-20 calls: MEDIUM
- 21-50 calls: HIGH
- 50+ calls: CRITICAL

Do not stop at direct callers. Enumerate every writer, consumer, transitive caller, and parallel path that can read or mutate the affected state. Name the count and the affected paths in the finding.

## Attacker model

Define a specific attacker model before rating a security finding.

**WHO is the attacker?**

- Unauthenticated external user
- Authenticated regular user
- Malicious administrator
- Compromised service

**WHAT access/privileges do they have?**

**WHERE do they interact with the system?**

Rate realistic exploitability:

- **EASY:** Exploitable via public APIs with no special privileges
- **MEDIUM:** Requires specific conditions or elevated privileges
- **HARD:** Requires privileged access or rare conditions

## Security finding evidence

Use the findings schema in [report-format.md](report-format.md). A security finding's body carries:

- **Attacker Model:** WHO / ACCESS / INTERFACE
- **Attack Vector:** Step-by-step exploit through accessible interfaces
- **Exploitability:** EASY/MEDIUM/HARD
- **Concrete Impact:** Specific, measurable harm — not theoretical
- **PoC Sketch:** The input, data flow, trigger, and observable impact
- **Root Cause:** The specific code change at `file:line`
- **Blast Radius:** Writers, consumers, callers, and parallel paths affected
- **Invariant Broken:** The protection or established pattern the change violates

## Severity is not confidence

Keep the axes separate: **Severity** is the impact if the finding is real; **Confidence** is how sure you are that it is real. Neither the HIGH/MEDIUM/LOW risk classification nor exploitability replaces the Blocker/Major/Minor/Nit scale from `SKILL.md`.

## Variant hunt (after a confirmed bug only)

Start a variant hunt only after a bug is confirmed. First write the root cause:

> "This vulnerability exists because [UNTRUSTED DATA] reaches [DANGEROUS OPERATION] without [REQUIRED PROTECTION]."

1. Understand the original issue. Extract why the code is wrong, not merely what it does.
2. Create an exact match that hits only the known instance and confirm it hits.
3. Generalize one element at a time.
4. Run every search against the **entire codebase root**, not only the original module.
5. Stop generalizing when more than roughly half the matches are noise.
6. Triage each candidate after checking guards, sanitizers, type constraints, and trusted callers.

Never generalize multiple elements at once.

`exact code -> abstract var1 -> abstract var2 -> abstract operation`

Code that nothing reaches today is still unprotected code. Report a real unreachable-today variant at lower severity, with its current reachability stated.

Portions adapted from Trail of Bits skills (https://github.com/trailofbits/skills), CC BY-SA 4.0.
