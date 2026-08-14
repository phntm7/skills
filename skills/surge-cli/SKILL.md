---
name: surge-cli
description: >
  Use when publishing or managing a static site with Surge, including previews,
  domains, revisions, rollback, or removal; it provides safe CLI deployment workflows.
---

# Surge CLI

Last verified: 2026-07-14

Use Surge to publish directories of static HTML, CSS, JavaScript, and assets. It
does not run application servers, server-side functions, or databases.

## Rules

- A direct request to publish, redeploy, cut over, roll back, or remove a site
  authorizes that external action. A request for instructions alone does not.
- Assume the free plan unless `surge whoami` proves otherwise. Never start an
  upgrade flow or add a paid-only feature without an explicit request.
- Reuse the exact existing domain for updates. Check the user's URL, `CNAME`,
  prior deploy output, and `surge list` before creating another project.
- Publish the built output directory, not the repository root, unless the
  repository itself is the intended static site.
- Never publish secrets, `.env` files, private source, or build caches. Inspect
  the output and add `.surgeignore` rules when Surge's defaults are insufficient.

## Preflight

1. Run `surge --version`. If it is missing, install the official `surge` npm
   package according to the host's package policy. Upstream uses
   `npm install --global surge`.
2. Build or export the site. Locate the output directory containing the intended
   `index.html` or `200.html`.
3. Inspect that directory. Surge excludes `.git`, dotfiles, editor backups,
   `node_modules`, and `bower_components`; `.surgeignore` uses `.gitignore`
   syntax for anything else.
4. Run `surge whoami`; use `surge login` if needed. For an existing project,
   inspect `surge list <domain>` before changing it.

A deploy may contain at most 10,100 files and 450 MB.

## Publish, Share, and Update

For a known domain, always pass both the directory and domain:

```bash
surge <output-directory> <domain> -m "<short deploy message>"
```

For a new one-off prototype without a requested domain, run
`surge <output-directory>` and accept the generated `.surge.sh` suggestion, or
enter `_` for a fresh random subdomain. Capture the URL printed on success. A
`CNAME` file in the published directory can remember a stable domain for later
deploys; otherwise keep passing the domain explicitly.

To update a shared prototype, rebuild and publish to that same domain. Normal
publishes atomically make the new revision live.

When the current shared site must remain unchanged during review, publish a
preview:

```bash
surge <output-directory> <domain> --preview -m "<candidate description>"
surge list <domain>
```

Share the printed revision URL, not the production URL. After approval, cut
over the exact reviewed revision:

```bash
surge cutover <domain> <revision>
```

After any publish or cutover, open the reported URL and exercise the changed
page or route before reporting success.

## Manage Revisions and Projects

```bash
surge list                         # list projects
surge list <domain>                # list revisions; live one is highlighted
surge rollback <domain>            # serve the previous revision
surge rollfore <domain>            # undo one rollback
surge cutover <domain> <revision>  # serve an exact revision
surge discard <domain> <revision>  # permanently delete one revision
surge files <domain>               # list files currently served
surge audit <domain>               # inspect CDN revision and certificate state
surge teardown <domain>            # permanently remove the whole project
```

Use exact revisions when several previews exist. `discard` can move production
or take the site offline. Before `teardown`, resolve and inspect the exact domain;
afterward verify that it no longer appears in `surge list`. Teardown does not
change external DNS or domain registration.

## Project Files

| File | Behavior | Plan |
| --- | --- | --- |
| `CNAME` | Remembers the deployment domain | Free |
| `.surgeignore` | Excludes files from upload | Free |
| `200.html` | SPA shell for unmatched client-side routes | Free |
| `404.html` | Custom not-found page with HTTP 404 | Free |
| `AUTH` | Project-wide HTTP basic auth | Paid |
| `ROUTER` | 301 and 307 redirects | Paid |
| `CORS` | Project-wide allowed origins | Paid |

For an SPA, publish the app shell as `200.html` so deep links and refreshes reach
the client router. For a content site, use `404.html`. If both exist, `200.html`
handles unmatched routes. Clean URLs, canonical slash redirects, gzip, ETags,
and CDN cache invalidation are automatic.

## Free Plan Boundary

Free includes unlimited projects and deploys, `.surge.sh` subdomains, custom
domains, managed SSL, CDN delivery, clean URLs, revisions, and collaborators.
`.surge.sh` domains use HTTPS automatically. For a custom domain that already
points to Surge, `surge encrypt <domain>` provisions a free auto-renewed
certificate.

Paid plans add `AUTH`, `ROUTER`, `CORS`, and user-supplied PEM certificates. If
a request needs one, state that it is paid and stop before adding its control
file or invoking `surge plan`. Use `surge plan` or the pricing page for current
prices; do not hardcode them.

## Credentials and Completion

For CI, pass the path and domain explicitly and provide `SURGE_TOKEN` through
the CI secret store. `surge token` prints a long-lived secret: never expose it in
chat, logs, source files, or command history.

Report the published directory and domain, whether production changed or only a
preview was created, the exact URL and revision when available, the page or
route exercised after deployment, and any free-plan blocker.

## Official Documentation

- [CLI overview](https://surge.sh/docs/cli/) and [command reference](https://surge.sh/docs/cli/reference)
- [Publishing](https://surge.sh/docs/cli/publishing), [previews](https://surge.sh/docs/cli/previews), and [revisions](https://surge.sh/docs/cli/revisions)
- [Automation and tokens](https://surge.sh/docs/cli/automation)
- [Platform conventions](https://surge.sh/docs/platform/) and [plan differences](https://surge.sh/docs/platform/plans)
- [Custom domains](https://surge.sh/docs/platform/custom-domains) and [SPA routing](https://surge.sh/docs/platform/spa-routing)
