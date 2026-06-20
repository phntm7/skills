# Report Format

How `deep-code-review` delivers findings. Default is **inline findings as the agent's response** — PR-comment-ready markdown. A written file or the HTML report are opt-in, only when the user asks.

The severity scale (`Blocker` / `Major` / `Minor` / `Nit`) and the per-finding schema are defined in `SKILL.md`. This doc fixes the exact rendering.

## Default: inline findings

Structure the response as: **verdict + summary**, then **findings grouped by severity**, then optional **structural opportunities**. Nothing written to disk.

### Verdict + summary

Open with a one-line verdict and a short paragraph. The verdict is one of:

- **Approve** — meets the approval bar (`references/review-rubric.md`). No blockers, no unaddressed majors.
- **Approve with nits** — mergeable; only minor/nit items remain.
- **Request changes** — one or more blockers, or majors that should be resolved first.

```markdown
**Verdict: Request changes** — 2 blockers, 3 major, 1 minor.

The feature works, but `OrderPipeline` crosses 1k lines and folds three new
special-cases into an already busy flow. One code-judo move (dispatch on a typed
`OrderKind`) deletes most of the new branching. Auth path on line 88 trusts an
unchecked header — blocker.
```

### Findings

Group by severity, highest first. Each finding is self-contained and **postable as a single PR comment** — anchored, with a concrete remedy.

```markdown
### Blockers

#### 1. Unauthenticated admin path
- **Lens:** security · **Location:** `src/server/admin.ts:88`
- **Problem:** `isAdmin` is read straight from the `x-role` request header with no verification.
- **Why:** Any client can set the header and reach admin mutations. Privilege escalation.
- **Remedy:** Derive role from the verified session, not the request:
  ```ts
  const role = await sessions.roleFor(req.sessionId); // not req.headers['x-role']
  ```

#### 2. ...

### Major

#### 3. `OrderPipeline` past 1k lines
- **Lens:** architecture · **Location:** `src/orders/pipeline.ts` (was 870, now 1180)
- **Problem:** The PR pushes a previously scannable file over 1000 lines by inlining intake, pricing, and fulfilment branches.
- **Why:** The three concerns are now braided; a reader must hold all of them to change one. Shallow growth, low locality.
- **Remedy:** Split per concern, or dispatch on a typed `OrderKind` so the branches collapse into one table. See the deletion test in `architecture.md`.

### Minor
...

### Nits
- `usrCfg` → `userConfig` (`src/config.ts:12`); group rather than list individually if many.
```

Rules:
- Number findings continuously so the caller can reference "finding 3".
- Always include `lens` and `location`. Anchor to `path:line` (or a range).
- `remedy` is concrete — a sketch the author can act on, not "consider refactoring".
- Omit empty severity sections.
- **Don't flood with nits.** If there are blockers/majors, collapse nits into a short grouped list or defer them with one line ("plus ~6 naming nits, happy to list on request").

### Structural opportunities (optional closing section)

When the review surfaced a "code-judo" reframe or a deepening worth more than a single inline comment, end with a short section naming it — the one restructuring you'd push for, in 3–5 lines. This is where ambition lives; don't bury it inside the minor findings.

## Opt-in: written markdown report

When the user asks to "write the review to a file": same content as the inline format, written as a single self-contained markdown file. Put it where the user asks; if unspecified, the OS temp dir (`$TMPDIR`, falling back to `/tmp`) as `code-review-<timestamp>.md` so nothing lands in the repo unless requested. Tell the user the absolute path.

## Opt-in: HTML report mode (architecture-heavy reviews)

When the review is dominated by architecture/deepening findings and visuals would carry the argument, offer a self-contained HTML report. Only when asked, or when you judge the structural story genuinely needs before/after diagrams.

- Single self-contained file in the OS temp dir: `<tmpdir>/code-review-<timestamp>.html`. Never write it into the repo.
- **Tailwind via CDN** for layout, **Mermaid via CDN** for graph-shaped diagrams (call graphs, dependencies, sequences). Mix Mermaid with hand-built divs/SVG for editorial visuals (before/after mass diagrams, layer cross-sections) — don't lean on Mermaid for everything or it looks generic.
- One card per finding: severity badge, lens tag, files (monospaced), problem (one sentence), remedy (one sentence), and — for architecture findings — a **before/after diagram** as the centrepiece. Wins as ≤6-word bullets.
- Legend in the header: solid box = module, dashed line = seam, red arrow = leaked boundary, thick dark box = deep module.
- Close with a **Top recommendation** card: the one change to make first, with an anchor link to its finding.
- Open it for the user (`open <path>` on macOS, `xdg-open` on Linux, `start` on Windows) and report the absolute path.

Keep diagrams ~320px tall so before/after sits side by side. One accent colour plus red (leak) and amber (warning). Editorial, not corporate-dashboard. The only scripts are the Tailwind CDN and the Mermaid ESM import — otherwise static.
