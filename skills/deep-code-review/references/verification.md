# Finding Verification

Use this reference in the **Verify** step on every Blocker or Major candidate before delivery. Minor and Nit findings skip this pass.

This is a review-only task. Re-read the code, verify or reject the claim, and correct its evidence and severity. Do not modify the code; leave delivery of the findings to the caller.

Use the Blocker/Major/Minor/Nit scale from `SKILL.md` and the findings schema in [report-format.md](report-format.md). For non-security findings, read “vulnerability” below as “defect.”

## Rationalizations (Do Not Skip)

| Rationalization | Why It's Wrong | Required Action |
|-----------------|----------------|-----------------|
| "Small PR, quick review" | Heartbleed was 2 lines | Classify by RISK, not size |
| "I know this codebase" | Familiarity breeds blind spots | Build explicit baseline context |
| "Git history takes too long" | History reveals regressions | Check the introducing commit on removals |
| "Blast radius is obvious" | You'll miss transitive callers | Calculate quantitatively |
| "No tests = not my problem" | Missing tests = elevated risk rating | Flag in report, elevate severity |
| "Just a refactor, no security impact" | Refactors break invariants | Analyze as HIGH until proven LOW |
| "I'll explain verbally" | Findings not written down get lost | Deliver every finding in the report, never as a passing remark |

## Rationalizations to Reject

If you catch yourself thinking any of these, STOP.

| Rationalization | Why It's Wrong | Required Action |
|---|---|---|
| "Rapid analysis of remaining bugs" | Every bug gets full verification | Return to task list, verify next bug through all phases |
| "This pattern looks dangerous, so it's a vulnerability" | Pattern recognition is not analysis | Complete data flow tracing before any conclusion |
| "Skipping full verification for efficiency" | No partial analysis allowed | Execute all steps per the chosen verification path |
| "The code looks unsafe, reporting without tracing data flow" | Unsafe-looking code may have upstream validation | Trace the complete path from source to sink |
| "Similar code was vulnerable elsewhere" | Each context has different validation, callers, and protections | Verify this specific instance independently |
| "This is clearly critical" | LLMs are biased toward seeing bugs and overrating severity | Complete devil's advocate review; prove it with evidence |

## Step 0: Understand the Claim and Context

Before any analysis, restate the bug in your own words. If you cannot do this clearly, ask the user for clarification. Half of false positives collapse at this step — the claim doesn't make coherent sense when restated precisely.

Document:

- **What is the exact vulnerability claim?**
- **What is the alleged root cause?**
- **What is the supposed trigger?**
- **What is the claimed impact?**
- **What is the threat model?** What privilege level does this code run at? Is it sandboxed? What can the attacker already do before triggering this bug?
- **Caller analysis**: What functions call this code and what input constraints do they impose?
- **Architectural context**: Is this part of a larger security system with multiple protection layers?

## Devil's Advocate Spot-Check

Answer these 7 questions. If any produces genuine uncertainty, escalate to deep verification.

**Against the vulnerability:**

1. Am I seeing a vulnerability because the pattern "looks dangerous" rather than because it actually is? (pattern-matching bias)
2. Am I incorrectly assuming attacker control over trusted data? (trust boundary confusion)
3. Have I rigorously proven the mathematical condition for vulnerability can occur? (proof rigor)
4. Am I confusing defense-in-depth failure with a primary security vulnerability? (defense-in-depth confusion)
5. Am I hallucinating this vulnerability? LLMs are biased toward seeing bugs everywhere — is this actually real or am I pattern-matching on scary-looking code? (LLM self-check)

**For the vulnerability (always ask — false-negative protection):**

6. Am I dismissing a real vulnerability because the exploit seems complex or unlikely?
7. Am I inventing mitigations or validation logic that I haven't verified in the actual source code? Re-read the code after reaching a conclusion.

## False-positive checklist

Work through these checks against the full code and reachable context:

1. Trace Full Validation Chain — Don't analyze isolated code snippets.
2. Map Complete Conditional Logic Flow — Vulnerable-looking code may be unreachable due to conditional logic that creates mathematical guarantees.
3. Confirm Exploitable Data Paths — Don't assume network-controlled data reaches dangerous functions without tracing.
4. Understand Data Source Context — API return values, compile-time constants, and network data have different risk profiles.
5. Verify TOCTOU Claims — Proof that the checked value can change between check and use.
6. Distinguish Internal Storage from External Input — Values set by trusted components are not attacker-controlled.
7. Verify Concurrent Access is Actually Possible — Single-threaded initialization cannot have races.
8. Assess Real vs Theoretical Security Impact — Would this lead to code execution, privilege escalation, or information disclosure?

## Self-filter

Default to approving your own candidate finding. You have read the full code, so remove a finding only when the reviewed change proves it wrong under Ground A or Ground B below. Do not drop it merely because you would not have raised it on a second pass.

The two mistakes available to you are not equally bad:

- Keeping an incorrect comment costs a reviewer a few seconds of attention.
- Removing a correct comment silently destroys a real finding. It never reaches anyone, and nobody learns that it was dropped.

So when your evidence falls short of proof, approve. "Suspicious", "I cannot verify this", "low value", "the flagged code looks fine to me", and "I would not have raised this" all mean approve.

### The only two grounds for removal

**Ground A — the finding cites code that is not in the reviewed change.**

The symbol, statement, or construct the finding describes appears nowhere in the reviewed change. The same construct appearing only in untouched context does not rescue the finding.

**Ground B — re-reading the code literally contradicts the finding's central claim.**

The finding asserts a concrete fact and the code shows the opposite in plain text. The contradiction must be readable straight off the code, not derived through a chain of speculation.

### Protected subjects — never remove

- **Memory safety** — allocation size, buffer length, index bounds, off-by-one, use-after-free, null dereference
- **Concurrency** — locks and lock modes, atomics, data races, synchronization arguments that are not honored
- **Linkage and declaration consistency** — `static` versus non-`static`, a declaration that disagrees with its definition, missing `extern`
- **Behavioral or compatibility change** — a message, field, status, or default that the old code produced and the new code no longer does; an altered error path; a counter whose update moved to a different point in the lifecycle
- **A parameter the function accepts and never uses**

On a protected subject you do not get to be confident. Approve.

## Intended Breakage Guidelines

If you identify a high risk finding, but the intent of the branch is to introduce that finding – e.g. break some functionality, remove a feature flag, remove a safeguard – AND the scope of the change is well constrained, you SHOULD NOT waste the author's time by reporting the issue to them. However, if you believe it is likely that they are not aware of the full implications of their change, or you are worried that they are under-weighting the negative impacts (extreme example: a developer pushes a PR titled "Delete the database"), or you are worried that the change is actually malicious, you should still report the finding.

## Over-reporting Guidelines

If you report issues as High priority when they are not in fact high priority / meaningful issues, devs will lose trust in you and stop listening to you over time.
NEVER misreport the priority / importance of issues. Be extremely thorough in tracing issues end-to-end to gain complete, and total confidence before reporting.

## Critical Rule

- NEVER present issues with unfinished research. E.g. Never say something like, "The client has issue X, but if handled in the backend then this is ok." if you have access to the backend code and can check for yourself.

Portions adapted from Trail of Bits skills (https://github.com/trailofbits/skills), CC BY-SA 4.0.
