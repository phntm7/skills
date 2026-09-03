---
name: context7-docs
description: >
  Use when work depends on current, version-specific documentation for a library,
  SDK, framework, or API; it retrieves relevant docs and examples with Context7 (`ctx7`).
---

# Context7 Docs Lookup

Last verified: 2026-09-03 (ctx7 0.5.9)

Use the `ctx7` CLI to pull focused, current documentation for a library
instead of relying on training-data memory or scraping docs sites. Verify
signatures, options, and idioms against retrieved Context7 snippets before
writing integration code.

## Boundary

Use only `ctx7 library`, `ctx7 docs`, and read-only `ctx7 whoami` (auth
diagnostics). Use the `web-search-router` skill for general research,
comparisons, and release history; the repository for current-repo code; and a
dedicated official-docs skill when one exists. Documented APIs, migration
guides, deprecations, and error references belong here. Do not run
`ctx7 setup` (`setup --cli` installs skills), `ctx7 remove`, `ctx7 login`,
`ctx7 logout`, or `ctx7 upgrade` — they change local auth/config or the CLI
installation.

Queries are sent to Context7's hosted service: never include secrets, API
keys, personal data, or proprietary code in a query — describe the problem
generically instead.

## Workflow

1. **Resolve the library ID** (skip if you already know it):

   ```bash
   ctx7 library <name> "<your actual question>"
   ```

   Returns candidates with `Context7-compatible library ID` (`/org/project`),
   snippet counts, source reputation, and a benchmark score. Pick by closest
   name, highest snippet count, and strongest reputation — the top result is
   not always best. Prefer the official repo or docs-site entry over
   `/llmstxt/...` mirrors when name, snippets, and reputation are close.
   When the project pins a version, use a version-specific ID: candidates
   list available versions as `/org/project/version` or
   `/org/project@version` (some docs sites also index as separate entries,
   e.g. `/websites/laravel_11_x`). Version pinning is best-effort —
   results can still mix in snippets from other refs, so for
   version-sensitive answers check that each snippet's `Source:` URL (or
   `codeId` in `--json`) actually points at the pinned version and discard
   ones that don't; if little survives, fall back to the official versioned
   docs via the `web-search-router` skill.

2. **Query the docs**:

   ```bash
   ctx7 docs /org/project "<single-topic question>"
   ```

   The ID must start with `/` — a bare name (`ctx7 docs react ...`) fails.

3. **Iterate per concept.** Ask one focused question per query and run a
   separate query for each distinct concept — multi-topic queries dilute the
   ranking and return shallow results for every topic. Only combine concepts
   when the question is about their interaction ("how does X work with Y").
   Cap the spend: at most 3 `library` and 3 `docs` calls per question; past
   that, use the best result you have or fall back to the `web-search-router`
   skill.

## Writing good queries

Describe the task, not keywords: "How to define one-to-many relations with
cascade delete" beats "relations". Include the goal and constraints —
queries are semantic, and task-shaped questions retrieve task-shaped
examples.

## Output handling

- Output is markdown snippets (code + prose) and can be long — pipe through
  `head -80` or grep for the symbol you need rather than dumping everything
  into context. Piped output is already clean (no spinners or colors).
- `--json` on either subcommand for scripted selection.
- Quote retrieved snippets, not memory, when the two disagree.
- Keep provenance: when a snippet backs a claim in your answer, name the
  resolved library ID (and version) and carry the snippet's `Source:` URL —
  Context7 mixes official docs, source files, and generated summaries, and
  the URL is what lets the user judge authority.

## Failure handling

- No suitable library or the returned docs miss the topic: retry once with a
  broader query or an alternate candidate ID, then fall back to the official
  docs via the `web-search-router` skill and say Context7 didn't cover it.
- Rate-limited or auth errors: `ctx7 whoami` to check status, then tell the
  user — anonymous use works with lower limits; logging in or setting
  `CONTEXT7_API_KEY` is the user's call, not yours.
- `ctx7` not installed: ask the user to install it (`npm i -g ctx7` or via
  mise); one-off `npx ctx7` also works.

## Examples

```bash
ctx7 library prisma "define one-to-many relation with cascade delete"
ctx7 docs /prisma/prisma "define one-to-many relation with cascade delete"
ctx7 docs /vercel/next.js "middleware that redirects unauthenticated users"
ctx7 docs /honojs/hono "how to define middleware" --json
```

## Done

Done means every requested concept has a matching snippet or an explicit
fallback/miss; record the selected library ID/version and each cited
snippet's Source URL (or JSON codeId/pageId).

## Sources

- Context7 CLI: https://context7.com/docs/clients/cli
- Context7 API guide: https://context7.com/docs/api-guide
