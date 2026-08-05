---
name: context7-docs
description: >
  Fetch current, version-specific library and framework documentation with the
  Context7 CLI (ctx7): resolve a package name to a library ID, then query docs
  and code examples for it. Use when working with an external library, SDK,
  framework, or API and needing up-to-date usage docs — method signatures,
  configuration, migration notes, idiomatic examples — instead of guessing
  from memory; triggers include "look up the docs", "how do I do X in this
  library", "check the current API", "context7", "ctx7". CLI only: this
  skill never sets up or uses the Context7 MCP server.
---

# Context7 Docs Lookup

Use the `ctx7` CLI to pull focused, current documentation for a library
instead of relying on training-data memory or scraping docs sites. Docs
change faster than models retrain — verify signatures, options, and
idioms against Context7 before writing integration code.

## Boundary: docs queries only

Use exactly two subcommands: `ctx7 library` and `ctx7 docs`. Never run
`ctx7 setup`, `ctx7 remove`, `ctx7 login`, `ctx7 logout`, or configure the
Context7 MCP server on the user's behalf — Context7 is used here purely as a
stateless docs-search CLI, and setup commands rewrite agent config files.
Auth troubleshooting stops at read-only `ctx7 whoami`.

## Workflow

1. **Resolve the library ID** (skip if you already know it):

   ```bash
   ctx7 library <name> "<your actual question>"
   ```

   Returns candidates with `Context7-compatible library ID` (`/org/project`),
   snippet counts, source reputation, and a benchmark score. Pick by closest
   name match first, then higher benchmark score and reputation. Prefer the
   official repo or docs-site entry over `/llmstxt/...` mirrors when scores
   are close. Version-specific IDs exist for some libraries — use one when
   the project pins an older major version.

2. **Query the docs**:

   ```bash
   ctx7 docs /org/project "<single-topic question>"
   ```

   The ID must start with `/` — a bare name (`ctx7 docs react ...`) fails.

3. **Iterate per concept.** Ask one focused question per query and run a
   separate query for each distinct concept; only combine concepts when the
   question is about their interaction ("how does X work with Y").

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

## Failure handling

- No suitable library or the returned docs miss the topic: retry once with a
  broader query or an alternate candidate ID, then fall back to the official
  docs via a web-search skill and say Context7 didn't cover it.
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

Near-miss: general web research, news, or non-library questions are not docs
lookups — use the web-search skills. Questions about code in the current
repo need the repo itself, not Context7.
