---
name: add-mcp-server
description: >
  Use when adding, changing, or troubleshooting an MCP server in the Pi coding
  agent (`pi mcp add`, `~/.pi/agent/mcp.json`, `.pi/mcp.json`, `/mcp`); covers
  scope, stdio vs HTTP, credentials, OAuth sign-in, and tool exposure.
---

# Add an MCP Server to Pi

Pi 1.4+ has built-in MCP support. Configure servers with `pi mcp` from a shell
or `/mcp` inside a session. Checked against pi 1.4.0 (`pi mcp --help` and the
bundled `docs/mcp.md`); if the version differs, check those first.

If an installed extension registers `/mcp` (for example `pi-mcp-adapter`), it
replaces the built-in support and Pi stops reading `mcp.json`. Check `pi list`
before configuring.

## 1. Pick the scope

- **User** (default): `~/.pi/agent/mcp.json`. Use it for personal servers and
  anything with credentials.
- **Project** (`-l`/`--local`): `.pi/mcp.json`. Use it only for servers the
  project needs; Pi reads it only after the project is trusted. A project entry
  with the same name replaces the user entry.

## 2. Add the server

```bash
# stdio: one executable plus arguments, not a shell string
pi mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem .
pi mcp add -l tools --env API_KEY='${TOOLS_KEY}' -- uvx tools-mcp

# streamable HTTP (SSE is not supported; try /mcp instead of /sse)
pi mcp add docs --url https://example.com/mcp --bearer-token-env-var DOCS_TOKEN
pi mcp add sentry --url https://mcp.sentry.dev/mcp     # then: pi mcp login sentry
```

Useful `add` options: `--env KEY=VALUE`, `--cwd <dir>`, `--header KEY=VALUE`,
`--bearer-token-env-var NAME`, `--oauth-client-id`/`--oauth-client-secret`/
`--oauth-callback-port` for servers without dynamic registration,
`--exposure <codemode|deferred|direct|hidden>`, and
`--description "<what it offers>"`.

Keep secrets out of the file: use `${ENV_VAR}` references or a whole-value
`!command` such as `"!echo Bearer $(gh auth token)"`.

## 3. Choose exposure

- `codemode` (default): reachable from codemode scripts; tools are not declared
  to the model. Good for general servers.
- `deferred`: loaded through `tool_search` when needed. Good for large servers.
- `direct`: declared like built-in tools. Only for small, frequently used sets.
- `hidden`: registered but unreachable.

Per-tool overrides go in `toolExposure` (exact names or `*` patterns). Always
set `description`; it lists the server in the system prompt and ranks its tools
in search.

## 4. Verify

```bash
pi mcp list          # connects to every enabled server; exits 1 on any failure
```

Then `/reload` in running sessions. `/mcp` shows state, tools, exposure, the
full connection error and stderr of a failed stdio server. Server logs go to
`~/.pi/agent/mcp.log`.

Do not register a server twice: a package that runs its own MCP server (such as
`context-mode`) must not also be added to `mcp.json`.
