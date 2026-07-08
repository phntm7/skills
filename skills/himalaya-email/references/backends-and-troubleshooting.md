# Himalaya v2 — backends, search DSL, and troubleshooting

Load this when a backend misbehaves, when building `envelope search` queries, or when you need per-provider specifics. Assumes himalaya v2.

## Error → cause → fix

| Symptom | Cause | Fix |
| --- | --- | --- |
| `NO User is authenticated but not connected.` (IMAP) | OAuth token accepted, but the mailbox has **IMAP disabled** (common on corporate Microsoft 365). Not transient. | Use `-b msgraph` (Graph backend), or have an admin run `Set-CASMailbox -ImapEnabled $true`. Do not retry. |
| Auth error / token rejected | Access token expired or refresh token revoked. himalaya has no re-login. | Re-run the token broker: `ortie auth get` then `ortie auth resume ...`. Check with `ortie token inspect -a <account>`. |
| `cannot get ... from command` / exit 44 | The `token.command` / `password.command` failed (e.g. keychain item missing, wrong path). | Verify the broker/keychain entry exists; use an absolute path to the broker binary in `token.command`. |
| "unknown subcommand/flag" | You are on v1, or using v1 syntax on v2. | `himalaya --version`; use v2 syntax (`mailbox`, `--json`, `message add`). |
| Command has no mailbox / empty result | No `-m` given and no `inbox` alias configured. | Pass `-m <name>` or set `[mailbox.alias] inbox = "..."`. |
| Folder not found | Wrong/native name, or spaces unquoted. | `himalaya mailbox list`; quote names (`-m "Sent Items"`); or add an alias. |
| SMTP send fails on business M365 | Using the consumer host. | Business M365 SMTP host is `smtp.office365.com:587` (STARTTLS); consumer Outlook.com is `smtp-mail.outlook.com:587`. |
| `No backend supporting this operation is registered` | The selected account's backend does not implement the operation (e.g. `envelope search` on `msgraph`). | Force a backend that does (`-b imap`), or use `envelope list --json` + client-side filtering. |
| `message read` output is a wall of headers | Plain `message read` renders the full header block before the body. | Use `himalaya --json message read <ID>` and read `parts[text_body[0]].body.Text`; or `--raw` piped into a viewer. |

## envelope search query DSL

```bash
himalaya envelope search <query> [order by <field> [asc|desc]]
```

- Predicates include `from <addr>`, `to <addr>`, `subject <text>`, `body <text>`, `after <date>`, `before <date>` (availability depends on backend), plus flag/date filters.
- Boolean operators: `and`, `or`, `not`, and parentheses for grouping.
- Sort suffix: `order by date|from|to|subject [asc|desc]`.
- Backends advertise the subset they accept; **unsupported clauses fail at parse time** rather than being ignored. If a query errors, drop the unsupported predicate or switch backend.
- **Whole-operation support varies too:** some backends implement no search at all. `msgraph` returns `No backend supporting this operation is registered` for any `envelope search`. Use `envelope list` + client-side filtering there.
- Date predicates (`after`/`before`/`date`) match the **`Date:` header (sent-at) at day granularity**; they cannot express a sub-day or received-time window. For a rolling window, list and filter on the envelope `date` field yourself.

Example:
```bash
himalaya envelope search from alice and (subject invoice or subject receipt) order by date desc
```

## Backend specifics

### IMAP / SMTP (`imaps://...`, `smtp://...` + STARTTLS or `smtps://`)
- Inbox is `INBOX` (uppercase). UIDs are numeric; ranges/sets like `1:3,5` work for flags, copy, move.
- Microsoft 365 business: IMAP `outlook.office365.com:993`, SMTP `smtp.office365.com:587` STARTTLS. Consumer Outlook.com SMTP is `smtp-mail.outlook.com:587`.

### Microsoft Graph (`msgraph`)
- Uses the HTTPS Graph API; independent of IMAP/SMTP being enabled. The Microsoft-365 fallback when IMAP is blocked.
- Token needs `graph.microsoft.com` Mail scopes (`Mail.ReadWrite`, `Mail.Send`) — a different token/account than the `outlook.office.com` IMAP scopes.
- Folder display names are `Inbox`, `Sent Items`, etc.; the well-known inbox id is lowercase `inbox` (good value for `[mailbox.alias] inbox`). Message ids are long opaque strings — pass individually, never as ranges.
- Sending goes through Graph `sendMail` (no SMTP needed).
- **No `envelope search`** on this backend (fails with `No backend supporting this operation is registered`). List with `envelope list` and filter client-side.

### Gmail
- Plain passwords are rejected. Options: app password (needs 2-step verification) via `sasl.plain`, or OAuth via `sasl.xoauth2` with a token command. A dedicated `gmail` REST backend also exists (bearer token).
- Special folders live under `[Gmail]/` (e.g. `[Gmail]/Sent Mail`, `[Gmail]/All Mail`). Alias them for convenience. Every label appears as a top-level mailbox.

### JMAP / Maildir / m2dir
- JMAP: single server endpoint, bearer/basic auth; sending needs an identity id. Maildir/m2dir are local filesystem backends (no auth).

## Composing rich messages with `mml`

`message compose` only does simple flag-based messages. For MIME/attachments/signing, compose with [`mml`](https://github.com/pimalaya/mml) and pipe into send:

```bash
mml < draft.mml | himalaya message send
# or, with process substitution:
himalaya message send "$(mml < draft.mml)"
```

## Reading in a nicer viewer

```bash
himalaya message read <ID> --raw | mml interpret   # or | w3m -T text/html, etc.
```

## JSON output shapes (for scripting)

- `envelope list --json` → `{ "envelopes": [ { id, "message-id", flags: [{raw, iana}], subject, from: [{name, email}], to: [{name, email}], date, size, "has-attachment" } ] }`. `date` is ISO-8601 UTC (`...Z`); `flags[].iana` normalizes the flag (`seen`, `answered`, `flagged`, `draft`). Envelopes are newest-first.
- `message read --json <ID>` → `{ text_body, html_body, attachments, parts }`. `text_body`/`html_body`/`attachments` are arrays of **indices into `parts`**; each part carries a `.body` whose decoded content sits under `.body.Text`. So the plaintext body is `parts[text_body[0]].body.Text` and the HTML body is `parts[html_body[0]].body.Text`.
- Errors are JSON too: `{ "error": "...", "sources": [], "backtrace": null }`. When scripting, check for an `error` key before treating output as data.

## Reading without changing state

`message read` sets the `\Seen` flag, and himalaya has no peek/preview option. To preserve unread state during a read-only pass: snapshot the envelopes whose `flags[].iana` lacks `seen`, read what you need, then clear the flag you just caused — `himalaya flag remove -f seen <IDS>` (works on all backends, including Graph).
