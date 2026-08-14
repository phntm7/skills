---
name: himalaya-email
description: >
  Use when reading, searching, sending, or managing email with Himalaya v2,
  including account or backend failures; it provides safe CLI workflows for mail and auth.
---

# Himalaya Email (CLI usage)

`himalaya` is a stateless terminal email client. This skill covers **v2 usage**. Assume the account is already configured; setup/config is out of scope.

## Version gate (check first)

Run `himalaya --version`. v2 (`2.x`, currently `2.0.0-alpha.x`) and v1 (`<= 1.2.0`) have **different command sets and config schemas** — never mix them.

- v2: `mailbox`, `--json`, `message add`, `imap.server = "imaps://..."`.
- v1: `folder`, `--output json`, `message save`, `backend.type = "imap"`.

If commands below fail with "unknown subcommand/flag", you are likely on v1.

## Command surface

Shared (backend-agnostic) commands — pick the backend with `-b/--backend`, else `auto` uses the first configured backend:

- `mailbox list` (alias `mbox ls`)
- `envelope list|search` (aliases `ls|sr`)
- `flag add|set|remove`
- `message read|send|compose|reply|forward|copy|move|add`
- `attachment list|download`

Protocol-specific APIs expose one backend's full surface: `imap`, `jmap`, `gmail`, `msgraph`, `smtp`, `m2dir`.

Account management: `account list|check|configure`.

Global flags: `-a/--account <NAME>`, `-b/--backend <auto|imap|jmap|gmail|msgraph|maildir|m2dir|smtp>`, `-c/--config <PATH>`, `--json`.

## Everyday commands

```bash
himalaya envelope list                       # default mailbox (see Mailboxes below)
himalaya envelope list -m Archive -s 50 -p 2  # folder, page-size 50, page 2
himalaya envelope search from alice and after 2026-01-01 order by date desc
himalaya mailbox list                        # discover real folder names/ids
himalaya message read <ID>                   # rendered headers + text
himalaya message read <ID> --raw             # original RFC 5322 bytes (pipe into a viewer)
himalaya flag add -m INBOX --flag seen <IDS>
himalaya message copy --from INBOX --to Archive <IDS>
himalaya attachment download -m INBOX <ID>
himalaya -a <other-account> envelope list    # switch account
himalaya --json envelope list                # machine-readable output for scripting
```

## Auth model (important for usage)

OAuth accounts store **no password**. himalaya runs a token command (configured as `...token.command`, e.g. `["ortie", "token", "show", "-a", "<account>"]`) to fetch a fresh access token on every connection. A separate broker (e.g. `ortie`) issues and refreshes the token.

- himalaya has **no login/re-auth command**. If mail fails with an auth error, fix it in the broker: re-run its auth flow (e.g. `ortie auth get`/`ortie auth resume`) or inspect the token (`ortie token inspect -a <account>`).
- Never pass passwords or tokens as CLI arguments. They live in config via `password.command` / `token.command` pointing at a keychain/`pass`/broker.

## Mailboxes (folders) — common pitfalls

- Names are **backend-native**: IMAP inbox is `INBOX` (uppercase); Gmail special folders live under `[Gmail]/...`; Microsoft Graph exposes display names (`Inbox`, `Sent Items`) but its folder **ids are long opaque strings**.
- Quote names with spaces: `-m "Sent Items"`.
- `[mailbox.alias]` maps friendly names to native ids, case-insensitively. The `inbox` alias is the **implicit default**: shared commands fall back to it when `-m` is omitted. If no `inbox` alias is configured, pass `-m` explicitly or the command has no target.
- Always run `himalaya mailbox list` to learn the real names/ids before using `-m`.

## Message IDs

IDs are **backend-specific**, taken from `envelope list`:

- IMAP: numeric UID; supports sets/ranges like `1:3,5`.
- JMAP: email id string.
- Maildir: filename id.
- Microsoft Graph: long opaque id — **not numeric, no ranges**; pass ids individually.

## Reading messages: side effects & body extraction

- `message read <ID>` **marks the message `\Seen`** and has no peek/preview flag. To analyze mail without changing unread state, first capture which envelopes lack the `seen` flag, then restore after reading: `himalaya flag remove -f seen <IDS>` (works on every backend, including Graph).
- Plain `message read <ID>` prints the **full header block** (Received/DKIM/ARC/MIME) before the body — noisy to parse. For the body alone use JSON: `himalaya --json message read <ID>` returns `{ text_body, html_body, attachments, parts }`, where `text_body`/`html_body`/`attachments` are **indices into `parts`**. The decoded content is `parts[text_body[0]].body.Text` (plaintext) or `parts[html_body[0]].body.Text` (HTML).
- `message read <ID> --raw` emits the original RFC 5322 bytes for piping into a viewer.

## Searching vs. listing (backend support)

`envelope search` (the query DSL) is **not implemented on every backend**. The **`msgraph` backend does not support it**: it fails with `No backend supporting this operation is registered`, even though `msgraph` is the recommended Microsoft 365 fallback. On such accounts either force an IMAP backend if the account has one (`-b imap`), or use `envelope list --json` (always supported, newest-first) and filter client-side.

Date clauses (`after`/`before`/`date`) match the **`Date:` header (sent time) at day granularity** — they cannot express a rolling window such as "last 24 hours". For a time window, `envelope list --json` and filter on each envelope's `date` field yourself.

## Sending

- `message send` reads a raw RFC 5322 message from a **file path, an inline string, or stdin**. Sender/recipients come from the `From:`/`To:`/`Cc:`/`Bcc:` headers. `--save <mailbox>` also files a copy.
  ```bash
  himalaya message send < message.eml
  printf 'From: you@example.com\nTo: a@b.com\nSubject: Hi\n\nHello\n' | himalaya message send
  ```
- `message compose --from --to --subject --body [--send] [--save <mailbox>]` assembles a simple message with a flag composer. Without `--send` it prints RFC 5322 to stdout; add `--send` to actually send.
- For multipart MIME, signing, or editor-driven drafts, compose with [`mml`](https://github.com/pimalaya/mml) and pipe its output into `message send`.

## Backends and the big Microsoft 365 caveat

- `-b/--backend auto` (default) uses the first configured backend; force one with `-b msgraph`, `-b imap`, etc.
- **Microsoft 365 / Exchange Online:** if IMAP returns `NO User is authenticated but not connected.`, the OAuth token is valid but the tenant has **IMAP disabled on the mailbox**. Do NOT retry or blame the token. Resolutions: (a) an admin enables IMAP (`Set-CASMailbox -ImapEnabled $true`), or (b) use the **`msgraph` backend** instead — it goes over the HTTPS Graph API and ignores the IMAP switch (needs `graph.microsoft.com` Mail scopes on the token).
- **Gmail** rejects plain passwords: use an app password (2FA required) or OAuth (`xoauth2`). Special folders live under `[Gmail]/`.
- **Personal** Outlook/Hotmail usually allows IMAP; **corporate** M365 frequently does not.

## JSON / scripting

`--json` works on any command and emits JSON for both data and errors. `message read --json` returns the parsed message; `message read --raw` returns original bytes.

`envelope list --json` → `{ "envelopes": [ { id, "message-id", flags: [{raw, iana}], subject, from: [{name, email}], to: [{name, email}], date /* ISO-8601 Z */, size, "has-attachment" } ] }`; `flags[].iana` is the normalized flag name (`seen`, `flagged`, ...). Default page size is 25 — raise `--page-size` and page with `-p` for bulk scans.

## Do / Don't

Do:
- Run `himalaya mailbox list` to discover real folder names/ids before passing `-m`.
- Reach for `-b msgraph` as the Microsoft 365 fallback when IMAP is blocked.
- Fix auth failures in the token broker, not by editing himalaya.
- Use `--json` for any parsing/automation.
- After a read-only pass, restore unread state with `flag remove -f seen` — `message read` sets `\Seen` and there is no peek flag.
- On `msgraph` accounts, filter `envelope list --json` client-side instead of reaching for `envelope search`.

Don't:
- Don't use v1 syntax on v2 (`folder`, `--output json`, `message save`) — v2 uses `mailbox`, `--json`, `message add`.
- Don't pass Microsoft Graph opaque ids as numeric ranges.
- Don't retry on "authenticated but not connected" — it is a server-side protocol block, not a transient error.
- Don't use this skill to install or configure himalaya (setup is separate).
- Don't run `envelope search` on `msgraph` accounts, or expect sub-day precision from date clauses — list and filter client-side instead.

## Reference

- For per-backend details (IMAP/SMTP/Gmail/Graph), the `envelope search` query DSL, id formats, an error → cause → fix table, and `mml` composition, read [references/backends-and-troubleshooting.md](references/backends-and-troubleshooting.md).
