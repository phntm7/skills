---
name: playwriter
description: >
  Use when a task needs automation in the user's logged-in Chrome for UI testing,
  JS-heavy scraping, screenshots, or frontend debugging; it provides isolated,
  stateful Playwright workflows.
---

# Playwriter

Playwriter runs Playwright JavaScript snippets against the user's running Chrome through a browser extension. You get the full Playwright API plus helper utilities, with the user's logins and cookies already in place. Prefer it over webfetch/curl for any JS-rendered site (SPAs, cookie walls, lazy-loaded content) — raw fetch returns an empty HTML shell there.

State model, memorize this:

- Each **session** has an isolated `state` object that persists between calls. Your session's state is invisible to other sessions.
- Browser **tabs are shared** across all sessions and with the user. Other agents may be driving other tabs at the same time.

## Session Discipline (mandatory)

Multiple agents share one browser. Follow this etiquette:

1. **Create your own session at task start** and use its ID in every command:

   ```bash
   playwriter session new    # outputs an ID, e.g. 3
   ```

2. **Always pass `-s <id>`.** Never run `-e` without your own session; never reuse another agent's session ID (`playwriter session list` shows who holds state).

3. **Create your own page and keep it in `state.page`.** The bare `page` variable is a shared default that other agents may navigate away. First execute call of any task:

   ```bash
   playwriter -s 3 -e 'state.page = context.pages().find((p) => p.url() === "about:blank") ?? (await context.newPage()); await state.page.goto("https://example.com", { waitUntil: "domcontentloaded" })'
   ```

   Use `state.page` for every subsequent action.

4. **Never touch tabs you did not open** unless the user asked you to work on their current tab. Never call `browser.close()` or `context.close()`. Never call `bringToFront()`.

5. **Clean up at task end:** close pages you created (`await state.page.close()`), remove listeners (`state.page.removeAllListeners()`), then `playwriter session delete <id>`.

## Running Code

```bash
playwriter -s <id> -e '<js>'          # one-off snippet
playwriter -s <id> -f script.js       # longer script from file
playwriter -s <id> --timeout 30000 -e '<js>'   # default timeout is 10s
```

Sandbox scope: `state`, `page`, `context`, `require` (Node built-ins; no ESM `import`), Node globals, plus helpers like `snapshot`, `getLatestLogs`, `getPageMarkdown`, `getCleanHTML`, `waitForPageLoad`, `getCDPSession`, `screenshotWithAccessibilityLabels`, `resizeImageForAgent`, `recording`.

**Quoting rules** — bash corrupts JS silently if you get this wrong:

- Single quotes for one-liners: `playwriter -s 3 -e 'await state.page.click("button")'`. Use double quotes for JS strings inside.
- Heredoc for multiline or code containing `$`, backticks, or single quotes:

  ```bash
  playwriter -s 3 -e "$(cat <<'EOF'
  const links = await state.page.$$eval('a', els => els.map(e => e.href));
  console.log('Found', links.length);
  EOF
  )"
  ```

- Never use `$'...'` (breaks `\n` in JS regexes) or unquoted double quotes.

## Core Loop: Observe → Act → Observe

Never chain actions blindly. One action per execute call, verify after each:

```bash
# observe
playwriter -s 3 -e 'console.log("URL:", state.page.url()); console.log(await snapshot({ page: state.page })); console.log(await getLatestLogs({ page: state.page, sinceLastCall: true }))'
# act
playwriter -s 3 -e 'await state.page.getByRole("button", { name: "Submit" }).click()'
# observe again
playwriter -s 3 -e 'console.log("URL:", state.page.url()); console.log(await snapshot({ page: state.page })); console.log(await getLatestLogs({ page: state.page, sinceLastCall: true }))'
```

- `snapshot({ page })` is the primary observation tool: cheap text accessibility tree where every interactive line ends in a ready-to-use Playwright locator. Use those locators verbatim — never invent CSS selectors. Options: `search: /regex/` to filter, `locator:` instead of `page:` to scope to a subtree, `showDiffSinceLastCall: false` for full output (diffs are the default).
- `getLatestLogs({ page, sinceLastCall: true })` after every navigation/click catches console errors, failed requests, and hydration issues. Do not attach manual `page.on('console')` listeners — they miss startup logs.
- Screenshot only when visual layout matters; snapshot answers "did it load / what does it say" without image tokens.

## Key Rules

- `goto` with `{ waitUntil: "domcontentloaded" }`; then `waitForPageLoad({ page, timeout: 5000 })` or `waitForSelector` for dynamic content. Avoid `waitForTimeout` except for short (1–2s) animation waits.
- After navigation, snapshot for obstacles (cookie banners, login walls, age gates) and dismiss them before proceeding.
- Click timed out? Don't retry with `{ force: true }` or `dispatchEvent` — they bypass framework handlers and won't update app state. Snapshot for a blocking modal/overlay and interact with it properly.
- CDP: use `getCDPSession({ page: state.page })` — `page.context().newCDPSession()` does not work through the relay.
- Absolute paths for all Playwright artifact APIs (`screenshot`, `pdf`, `download.saveAs`). Sandboxed `fs` writes only succeed under the CLI's cwd, `/tmp`, or the OS temp dir.
- Popups (OAuth etc.) are auto-relocated to tabs: find them via `context.pages()` after the click.
- `keyboard.type()` ignores `\n` — press `Enter` between lines.

## Workflows

### Testing web apps

Throwing makes the CLI exit non-zero, so snippets work as test assertions:

```bash
playwriter -s 3 -e 'const h1 = await state.page.locator("h1").first().textContent(); if (!h1.includes("Dashboard")) throw new Error("expected Dashboard, got " + JSON.stringify(h1))'
```

For multi-step tests write a script file and run `playwriter -s 3 -f test.js` — same sandbox, `console.log` for evidence, `throw` to fail. Always end test runs by checking `getLatestLogs` for console errors the UI swallowed.

### Research and extraction

- `getPageMarkdown({ page })` — Readability-cleaned article text; ideal for reading docs/articles.
- `getCleanHTML({ locator })` — structured HTML of a subtree.
- For data behind APIs, intercept network traffic instead of scraping DOM: attach `page.on('response')` handlers storing into `state.responses`, trigger the UI, then read/replay the captured API calls. Fetch inside `page.evaluate()` to reuse session cookies.

### Screenshots

```bash
playwriter -s 3 -e 'await state.page.screenshot({ path: "/tmp/shot.png", scale: "css" })'
```

Always `scale: "css"` (avoids 2–4x hi-DPI bloat). Reading it back into context? `resizeImageForAgent({ input: "/tmp/shot.png" })` first. To *find* elements on visually complex pages (grids, maps, galleries) use `screenshotWithAccessibilityLabels({ page })` — labeled refs resolve via `refToLocator({ ref: "e5" })`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "extension is not connected" / "no browser tabs have Playwriter enabled" | Ask the user to click the Playwriter extension icon on the target tab (turns green). Only ask after the error — don't preemptively. |
| Chrome not running | `open -a "Google Chrome" --args --profile-directory=Default` (macOS), then retry. |
| Stale/broken connection | `playwriter session reset <id>` |
| All pages return `about:blank` | Chrome bug — ask the user to restart Chrome. |
| Internal errors | `playwriter logfile` prints the relay log path; grep it. |
| No extension possible (CI, containers) | `playwriter session new --browser headless` (after `playwriter browser install`), or `--direct` against a CDP endpoint. |

## Full Reference

`playwriter skill` prints the complete, version-synced documentation: debugger/breakpoints (`createDebugger`), live code editing (`createEditor`), CSS inspection (`getStylesForLocator`), video recording (`recording.start/stop`, `createDemoVideo`), React component inspection, pinned elements, cloud browsers (stealth/proxies/CAPTCHA), remote access, and direct CDP mode. Run it before using any of those advanced features, and whenever the guidance here seems out of date for the installed CLI version.
