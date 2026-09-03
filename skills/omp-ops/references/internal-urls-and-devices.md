# Internal URLs (`scheme://`) and Virtual Devices (`xd://`)

Use this reference to understand and use Oh My Pi's internal URL router (`scheme://`) and virtual tool devices (`xd://`). These allow agents to inspect outputs, transcripts, spilled buffers, GitHub PR diffs, remote files, and specialized tools without shell scraping.

## 1. How Internal URLs Work

OMP's `read` and `write` tools route string paths starting with registered schemes to internal handlers (`packages/coding-agent/src/internal-urls/router.ts`).

- Handlers support line-range selectors (e.g. `artifact://3:50-100` or `:raw`).
- Writable schemes accept direct writes via the `write` tool (`local://`, `ssh://`, `vault://`, `xd://`).
- Read selectors paginate large results to keep context bounded.

## 2. Agent and Session URIs

### `agent://` — Subagent Output Artifacts
Reads `.md` output artifacts produced when a subagent finishes:

```
agent://<id>            Full output content of subagent <id>
agent://<id>/<child>    Nested subagent output (resolves <id>.<child>)
agent://<id>/<path>     Extract JSON field path from the output
agent://<id>?q=<query>  jq-style query extraction from output JSON
```
*Notes:* `agent://` is immutable. Slash resolution checks for child subagents first, falling back to JSON path extraction.

### `history://` — Agent Transcripts
Renders agent conversation transcripts as concise Markdown:

```
history://              Index of all agents (id, status, kind, last active)
history://<agentId>     Full transcript of agent <agentId>
```
*Notes:* Works for live, idle, and parked agents, as well as unregistered sessions surviving on disk. Case-insensitive.

### `artifact://` — Spilled Tool Outputs
When tool results exceed in-memory buffer caps, OMP spills them to session artifacts and returns `artifact://<id>`:

```
artifact://<id>         Full spilled tool output text
artifact://<id>:50-100  Paging line range 50 through 100
artifact://<id>:raw     Raw verbatim text bypass
```
*Notes:* IDs are numeric per-session counters (`artifact://1`, `artifact://2`). Capped at 8 MiB for inline materialization.

### `local://` — Shared Session Scratchpad (Writable)
Shared scratchpad space accessible by the main agent and all child subagents:

```
local://                List all files in the session scratch root
local://<filename>      Read file in session scratchpad
```
*Notes:* Writable via `write(path="local://plan.md", content="...")`. Survives across turns and subagent hops. Limited to UTF-8 text $\le 1$ MiB.

## 3. GitHub and External Integration URIs

### `pr://` — Pull Requests and Unified Diffs
Inspect pull requests directly without running git commands:

```
pr://                   List recent PRs in the current repository
pr://<owner>/<repo>     List PRs for an explicit repository
pr://123                Single PR metadata and comments
pr://123?comments=0     Single PR with comments suppressed
pr://123/diff           List of changed files in PR #123
pr://123/diff/all       Full unified diff of PR #123
pr://123/diff/<i>       Diff slice for file index <i> (1-indexed)
```

### `issue://` — GitHub Issues
```
issue://                List recent issues in the current repository
issue://<owner>/<repo>  List issues for an explicit repository
issue://123             Inspect single issue #123
issue://123?comments=0  Inspect issue #123 without comments
```

### `ssh://` — Remote Filesystem (Writable)
Direct remote file operations through configured SSH ControlMaster connections:

```
ssh://                  List configured SSH hosts (from ~/.ssh/config or ssh.json)
ssh://<host>/<path>     Read remote file or directory listing
```
*Notes:* Writable with `write(path="ssh://prod-server/etc/nginx.conf", content="...")`. Paths must be absolute. Percent-encode special characters (`%3A`, `%3F`, `%23`). UTF-8 text $\le 1$ MiB.

### `vault://` — Obsidian Vault Notes (Writable)
Direct access to Obsidian notes via the Obsidian CLI (requires `vault.enabled: true`):

```
vault://                List configured Obsidian vaults
vault://_               The active default vault
vault://<vault>/<path>  Read a markdown note
vault://<vault>/<path>?op=outline|backlinks|links|tags|tasks
vault://<vault>?op=search&q=<query>
```
*Notes:* Plain note paths accept writes via `write`.

### `memory://` — Long-Term Memory
```
memory://root           Reads memory_summary.md
memory://root/<path>    Reads or globs files under project memory root
memory://<memory-id>    Reads raw Mnemopi memory record with frontmatter
```

## 4. Virtual Devices (`xd://`)

OMP mounts complex tools and external capabilities as virtual device paths (governed by `tools.xdev: true`).

### The Virtual Device Contract
1. **Discover Schema**: Call `read(path="xd://<device>")` to inspect the tool's description and JSON Schema.
2. **Execute Operation**: Call `write(path="xd://<device>", content="<json-args>")` to invoke the device.
3. If arguments are invalid, the device returns an error containing the schema so the model can correct and retry.

### Core Virtual Devices

| Virtual Device | Capability | Example Invocation |
|---|---|---|
| `xd://ast_edit` | Structural AST-aware codemods via ast-grep. | `write("xd://ast_edit", '{"paths":["src/"],"ops":[{"pat":"$A == null","out":"!$A"}]}')` |
| `xd://github` | GitHub CLI operations (PR create, checkout, search, Actions watch). | `write("xd://github", '{"op":"pr_checkout","pr":"123"}')` |
| `xd://lsp` | Language server symbols, definitions, diagnostics, renames. | `write("xd://lsp", '{"action":"definition","file":"src/app.ts","line":25,"symbol":"run"}')` |
| `xd://browser` | Full Chromium automation and DevTools Protocol interaction. | `write("xd://browser", '{"action":"open","url":"http://localhost:3000"}')` |
| `xd://security_scan` | OMP-native repository security scanning and SARIF export. | `write("xd://security_scan", '{"action":"preflight","target_kind":"working_tree"}')` |
| `xd://propose` | Propose plan steps for preview in plan mode. | `write("xd://propose", '{"proposal":"..."}')` |
| `xd://resolve` | Approve proposed plan changes (replaces legacy `resolve` tool). | `write("xd://resolve", '{"action":"approve"}')` |
