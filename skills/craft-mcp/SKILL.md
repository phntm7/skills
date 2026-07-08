---
name: craft-mcp
description: >
  Operate the Craft (craftdocs) note app through its MCP tools (craft_read and craft_write)
  to read, search, create, and edit Craft documents, pages, blocks, daily notes, tasks, and
  collections/tables. Use when adding or updating a note/page/block in Craft, reading or
  searching Craft docs, working with daily notes or tasks, building collections, resolving
  craftdocs:// links, or when Craft markdown escaping, code blocks, or internal links behave
  unexpectedly. Covers the command surface and the escaping/linking gotchas that cause silent
  content corruption.
---

# Craft MCP (usage)

Craft is a notes app exposed through two MCP tools:

- `craft_read` — read/search/list (`connection info`, `documents list`, `blocks get`, `search`, `collections ...`, `tasks list`).
- `craft_write` — create/edit (`blocks add|update|move|delete`, `tasks ...`, `collections ...`, `comments add`, `whiteboards ...`).

Each tool takes a single `command` string (CLI-style, e.g. `blocks get <id> --format markdown`). Batch independent commands with `;`. Discover any command with `<entity> <action> --help`.

**Model:** everything is a **block**. A document is a `page` block identified by a `rootBlockId`; its content is a tree of nested blocks, each with a stable id. You address content by block id.

## Discovery (do this before reading/writing)

- `connection info` — space id, timezone. Grab the **spaceId** here (needed to build internal links).
- `documents list` — the **reliable** way to enumerate documents (`<rootBlockId> Title`). Prefer it.
- `search <query>` — may return "No matches found" **even when the document exists** (depends on indexing/visibility settings). Never conclude a doc is absent from an empty search; confirm with `documents list`.
- `documents resolve-link <craft-url>` — turn a Craft share/deep link into a `rootBlockId`. **The documentId in a URL is NOT the rootBlockId** — always resolve a URL before passing an id to `blocks` commands.

## Reading

- `blocks get <rootBlockId> [--format markdown|json] [--depth N] [--cursor <c>]`
  - `--format markdown` to read content; `--format json` to get **block ids and types** (required for targeted edits).
  - Large docs paginate — follow `nextCursor`.
- `blocks get --date today|YYYY-MM-DD` — a daily note. **Errors if that daily note does not exist yet.** Create it by adding a block with `--date`.

## Writing

- **There is no `documents create` command.** Create a new document as a **page block**:
  ```
  blocks add --id <parentRootBlockId> --json {"type":"page","markdown":"Title","content":[ ... ]}
  ```
  or anchor it in a daily note with `--date today`. A page block is a real document (it appears in `documents list`); the user can drag it to top level in the app. **Page block markdown = its title.**
- `blocks add` targets (choose one):
  - `--id <blockId>` → into a document/page root; `--position start|end` (default end).
  - `--date <date>` → into a daily note.
  - `--siblingId <blockId>` → relative to an existing block; `--position before|after`.
  - Content via `--markdown <md>` or `--json <block|array>`. Prefer **one `--json` array** to insert many blocks (faster than many calls).
- `blocks update --id <blockId> --markdown <md>` — replaces that block. If the markdown produces **multiple** blocks, the **first replaces** the target and the **rest are inserted after** it.
- `blocks move --id <blockId> --targetId <parent> [--position start|end]`, `blocks delete --id <blockId>`.
- Get target block ids first with `blocks get --format json`.

## CRITICAL caveats (read before writing content)

1. **Markdown strips backslash escapes → silent corruption.** A `\"` written inside content collapses to `"`. Inside a code block this **breaks** shell/TOML/JSON that relies on escaped inner quotes (e.g. `-w \"$(cat)\"` becomes `-w "$(cat)""`, invalid). **Do not write content that needs backslash-escaped quotes.** Rewrite to an escape-free equivalent: drop unnecessary quotes (`-w $(cat)`), or use a TOML *literal* string (single quotes, no escaping). **Always read the block back after writing code/quote-heavy content** and fix if mangled.
2. **Use real newlines, not literal `\n`.** A single `\n` stays as the two characters; use actual line breaks. `\n\n` (real blank line) separates paragraphs. Never double-escape newlines.
3. **rootBlockId ≠ URL documentId.** Resolve Craft URLs with `documents resolve-link` first.
4. **`search` is unreliable for existence.** Use `documents list` to confirm a doc exists.
5. **Daily notes may not exist.** `blocks get --date today` errors when today's note is absent; create by adding with `--date`.
6. **Internal links:** write a markdown link whose URL is `craftdocs://open?spaceId=<spaceId>&blockId=<blockId>` (spaceId from `connection info`). Craft converts it to a working `block://...` link on read.
7. **Command-string quoting:** the `command` is parsed shell-style. Wrap a multi-line `--markdown`/`--json` value in single quotes, and avoid apostrophes inside it (a `'` closes the quote). Double quotes, `$`, and backticks are safe inside single quotes. When content is quote-heavy, prefer `--json` (JSON payload) over hand-quoting.
8. **Code fence languages:** common ones like `bash` render as highlighted code; some (e.g. `toml`) fall back to a plain code block. Cosmetic only — content is preserved.
9. **Markdown extensions:** `<callout>text</callout>`, `+ Toggle title` (children must be **indented beneath** it — flush-left lines are not children), and `> quote`.

## Tasks and collections

- `tasks list [--scope active|upcoming|inbox|logbook|document|all]`; `tasks add --markdown <text> [--state todo|done|canceled] [--schedule <date>] [--deadline <date>]`; `tasks update`, `tasks delete`.
- `collections` are database tables: `collections list|schema|items-get|views-list` (read) and `collections create|rename|items-add|items-update|items-delete|views-*` (write). A collection lives inside a document (`--document <rootBlockId>`).

## Workflow / output contract

- **Read before write** (`documents list` / `blocks get`), **verify after write** by reading the affected block back — especially for code blocks and quoted content.
- When done, report the `rootBlockId`/`blockId` touched and a `craftdocs://open?...` link.

## Do / Don't

Do:
- Use `documents list` to find docs and `documents resolve-link` for URLs.
- Create new notes as page blocks, then read them back to confirm rendering.
- Keep code-block content free of backslash-escaped quotes; use escape-free equivalents.
- Prefer a single `--json` array when adding many blocks.

Don't:
- Don't treat an empty `search` result as proof a document is absent.
- Don't pass a URL's documentId to `blocks` commands — resolve it first.
- Don't write literal `\n`; use real newlines.
- Don't assume `documents create` exists — create via a page block.

## Reference

- For the full command reference, block JSON types, batching, and escaping-workaround patterns with examples, read [references/command-reference.md](references/command-reference.md).
