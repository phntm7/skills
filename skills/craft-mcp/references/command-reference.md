# Craft MCP — command reference and patterns

Load this for the full command surface, block JSON types, and escaping-safe writing patterns. Discover exact flags at runtime with `<entity> <action> --help`.

## craft_read commands

```
connection info
documents list [--location unsorted|trash|templates|daily_notes | --folder <folderId>]
documents resolve-link <craft-url>          # -> rootBlockId (use before blocks/write commands)
blocks get <rootBlockId> [--depth N] [--format json|markdown] [--cursor <c>]
blocks get --date today|yesterday|tomorrow|YYYY-MM-DD
folders list [--filter <regex>]
search <query> [--location unsorted|trash|templates|daily_notes]
collections list [--document <rootBlockId>]
collections schema --collection <collectionId>
collections items-get --collection <collectionId>
collections views-list --collection <collectionId>
tasks list [--scope active|upcoming|inbox|logbook|document|all]
whiteboards elements get --whiteboard <whiteboardId>
images view --url <image-url>
```

## craft_write commands

```
folders create --name <name> [--parent <folderId>] [--icon <emoji>]
folders update --folder <folderId> [--name <name>] [--icon <emoji>] ; folders move --folder <folderId> --parent <folderId> ; folders delete --folder <folderId>
documents create --title <title> [--folder <folderId>] [--destination unsorted|templates]   # -> rootBlockId (empty doc)
documents create --documents '<json array>' [--folder <folderId>]
documents move --document <rootBlockId> (--folder <folderId> | --destination unsorted|templates)
documents delete --document <rootBlockId>          # soft-delete to trash (restore by moving out)
blocks add --id <blockId> (--markdown <text> | --json <json>) [--position start|end]
blocks add --date <date> (--markdown <text> | --json <json>) [--position start|end]
blocks add --siblingId <blockId> (--markdown <text> | --json <json>) [--position before|after]
blocks update --id <blockId> (--markdown <text> | --json <json>)
blocks move --id <blockId> --targetId <blockId> [--position start|end]
blocks delete --id <blockId|csv>          # or --ids <id1,id2,...> for bulk
tasks add --markdown <text> [--state todo|done|canceled] [--schedule <date>] [--deadline <date>]
tasks update --id <taskId> [--state ...] [--markdown <text>]
tasks delete --id <taskId>
collections create --name <name> --title <titleColumn> --<Property> <type> --document <rootBlockId>
collections rename|items-add|items-update|items-delete|views-create|views-update|views-delete|views-set-active ...
comments add --comments '[{"blockId":"<id>","content":"text"}]'
whiteboards create ; whiteboards elements add|update|delete --whiteboard <id> ...
```

Create documents with `documents create` (returns a `rootBlockId`), or nest a `page` block inside an existing doc (see below).

## Block JSON types

`blocks add --json` / `--update --json` take one block object or an array. Common shapes:

```json
{"type":"text","markdown":"A paragraph"}
{"type":"text","textStyle":"h2","markdown":"## Heading"}
{"type":"text","listStyle":"bullet","markdown":"- item"}
{"type":"code","language":"bash","markdown":"```bash\necho hi\n```"}
{"type":"line","markdown":"***"}
{"type":"page","markdown":"Page Title","content":[ /* child blocks */ ]}
```

- A `page` block is a nested document; its `markdown` is the **title**, and optional `content` is an array of child blocks.
- Shared optional fields: `indentationLevel` (0–5), `listStyle`, `decorations`, `color` (`#RRGGBB`), `taskInfo`.
- Run `blocks learn <topic>` (write tool) for authoritative per-type field docs, e.g. `blocks learn page code table`.

## Creating a document

Primary path — a real doc, optionally filed in a folder:

```
documents create --title "📘 My Guide" [--folder <folderId>]
```

Returns a `rootBlockId` for an **empty** doc; fill it with `blocks add --id <rootBlockId> --markdown ...` (a multi-section markdown string splits into multiple typed blocks). Relocate later with `documents move`.

Alternative — a nested sub-page inside an existing doc or daily note:

```
blocks add --id <parentRootBlockId> --position end --json {"type":"page","markdown":"📘 My Guide"}
```

The response returns the new page's block id; use it as the `--id` for subsequent `blocks add` calls. A page block appears in `documents list`.

## Internal links

```
1) connection info            -> spaceId
2) write a markdown link with URL:
   craftdocs://open?spaceId=<spaceId>&blockId=<targetBlockId>
```

On read the URL renders as a `block://<id>` link (working internal link). Example markdown:
`[See the guide](craftdocs://open?spaceId=SPACE&blockId=TARGET)`.

## Batching and pagination

- Batch independent commands in one call with `;`:
  `connection info; documents list; blocks get <id> --format markdown`
- `blocks get` on large docs returns `nextCursor`; repeat with `--cursor <nextCursor>` until exhausted.

## Escaping-safe writing patterns

The write path processes markdown and **strips backslash escapes** (`\"` -> `"`), which corrupts code that needs escaped inner quotes.

Broken (do not do this) — the `\"` collapse yields invalid, mismatched quotes:
```
storage.write.command = "security add-generic-password ... -w \"$(cat)\""
   ->  renders as:  ... -w "$(cat)""      # invalid
```

Safe alternatives:
```
# 1) Drop the unnecessary quotes (OAuth tokens have no spaces):
storage.write.command = "security add-generic-password ... -w $(cat)"

# 2) Or use a TOML literal string (single quotes, no escaping needed):
storage.write.command = 'security add-generic-password ... -w "$(cat)"'
```

General rules:
- Prefer content that needs **no backslash escaping**.
- For quote-heavy payloads, use `--json` (JSON string values escape cleanly) instead of hand-quoting `--markdown`.
- **Always read the block back** (`blocks get --format json`) after writing code/quote-heavy content, and fix in place with `blocks update` if mangled.

## Command-string quoting (the `command` argument)

- The `command` field is parsed shell-style. Wrap a multi-line value in **single quotes**; avoid apostrophes inside it (an `'` closes the quote).
- Inside single quotes, `"`, `$`, and backticks are literal and safe.
- If you must include apostrophes, switch to `--json` or a different quoting strategy.

## Bare `<tag>` tokens (HTML rejection)

A well-formed `<word>` in **plain** markdown text is parsed as HTML and rejected: `Unexpected HTML token` for a normal block, or `Expected inline markdown, got html` inside a table cell or heading. Triggers on `<model>`, `<tool>`, `<file>`, `<open>text</open>`, and the like.

Safe as-is:
- Inside a backtick code span: `` `<model>` `` or `` `foo <bar>` `` (even in a table cell).
- Spaced comparisons: `a < b and c > d`.
- The whitelisted `<callout>…</callout>` extension.

Fix: wrap the token in backticks, or rephrase to a placeholder (`MODEL`, `TOOL`). The most common failure is a token in a **table cell** — cells are always inline-parsed.
