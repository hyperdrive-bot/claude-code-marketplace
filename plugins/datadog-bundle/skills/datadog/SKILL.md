---
name: datadog
description: "Browse a Datadog org via Playwright — Session Explorer, RUM Performance, Failing Resources, Error Tracking, and replay frame capture. Auth via Playwright storageState (saved by /datadog-login). Trigger when the user asks to 'open Datadog', 'find that bug session', 'check failing requests', 'look at frontend errors', or pastes an app.datadoghq.com URL."
user-invocable: true
allowed-tools: Bash, Read, Write
argument-hint: "[action] --app <alias|uuid> [--tenant <id>] [--user <email>] [--last 24h|--from ISO --to ISO] [--query <raw>] [--headed]"
---

# Datadog — RUM Browse Skill

Programmatic browse of a Datadog org. Login with credentials (see `/datadog-login`), persisted via Playwright `storageState` so subsequent calls reuse the session for ~weeks.

## Bootstrap (one-time)

Before the first action, the skill needs Playwright + Chromium installed and a fresh login.

```bash
cd "${CLAUDE_PLUGIN_ROOT}"
npm install --no-audit --no-fund
npx playwright install chromium
node scripts/login.mjs --headed   # complete MFA in the browser window
```

After this, all action scripts run headless and reuse `~/.local/share/datadog-skill/storage-state.json`.

## Available actions

| # | Action | Script | Purpose |
|---|---|---|---|
| 1 | `login` | `scripts/login.mjs` | Authenticate. `--headed` (default) so MFA can be completed by hand. |
| 2 | `sessions` | `scripts/sessions.mjs` | Session Explorer — filter by tenant/user/time/raw query. |
| 3 | `performance` | `scripts/performance.mjs` | RUM Performance — view loading time per app. |
| 4 | `failing-resources` | `scripts/failing-resources.mjs` | Resources with `status_code >= 400` (override via `--status`). |
| 5 | `errors` | `scripts/errors.mjs` | Error Tracking — browser source by default. |
| 6 | `watch <session-id>` | `scripts/watch.mjs` | Open a specific replay, capture N frames. |

Each script prints a JSON summary on stdout: target URL, screenshot path, visible row count, applied filters.

## Common flags

- `--app <alias-or-uuid>` — **required**. Register aliases with `/datadog-create-app` or pass a raw RUM application UUID.
- `--tenant <tenantId>` — appends `@usr.tenantId:<id>` to the DQL.
- `--user <email>` — appends `@usr.email:<email>`.
- `--last 24h` — relative window (forms: `15m`, `1h`, `24h`, `7d`, `1w`). Default `24h`.
- `--from <iso> --to <iso>` — explicit window (overrides `--last`).
- `--query <raw-dql>` — append raw Datadog DQL terms (terms are AND-joined).
- `--headed` — show the browser window (debugging or first-time MFA).
- `--force` (login only) — re-auth even if storageState is fresh.

## DQL primer for `--query`

| Goal | Term |
|---|---|
| Sessions for a tenant | `@usr.tenantId:<id>` |
| Sessions for a user | `@usr.email:<email>` (or `@usr.id:<id>`) |
| Has any error | `@error:*` |
| Specific URL pattern | `@view.url:*checkout*` |
| Resource 4xx/5xx | `@type:resource @resource.status_code:>=400` |
| Combine | space-separated → implicit AND |

## How to invoke

When the user asks for any of the patterns below, invoke the matching command and report the JSON summary plus the screenshot path. If a script exits with code 2 (`not_logged_in` or `storage_state_expired`), run `scripts/login.mjs --headed` first then retry.

| User says | Command |
|---|---|
| "Open session explorer for tenant X last 7 days" | `node scripts/sessions.mjs --app myapp --tenant X --last 7d` |
| "Find sessions for user@example.com today with errors" | `node scripts/sessions.mjs --app myapp --user user@example.com --query "@error:*"` |
| "Check failing requests last hour" | `node scripts/failing-resources.mjs --app myapp --last 1h` |
| "Look at frontend errors last 24h" | `node scripts/errors.mjs --app myapp` |
| "Show app perf last 7d" | `node scripts/performance.mjs --app myapp --last 7d` |
| "Watch session abc123" | `node scripts/watch.mjs abc123 --frames 8` |
| Pastes an `app.datadoghq.com/rum/sessions?...` URL | Map params (query, from_ts, to_ts) to flags and call `sessions.mjs` |

Always run from the plugin directory:

```bash
cd "${CLAUDE_PLUGIN_ROOT}" && node scripts/<name>.mjs <flags>
```

## Storage layout

- `~/.local/share/datadog-skill/storage-state.json` (chmod 600) — auth cookies
- `~/.local/share/datadog-skill/screenshots/` — per-action PNGs, timestamped
- `~/.local/share/datadog-skill/videos/` — replay frames + (future) MP4 exports
- `~/.local/share/datadog-skill/apps.json` (chmod 600) — registered app aliases

Nothing is written into your repo.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DD_API_KEY` | API key for REST endpoints | (required for API skills) |
| `DD_APP_KEY` | App key for REST endpoints | (required for API skills) |
| `DD_OP_ITEM` | 1Password item name (fallback for keys + Playwright login) | `Datadog` |
| `DD_SITE_BASE` | Datadog site (US1 default) | `https://app.datadoghq.com` |
| `DD_APPS_REGISTRY` | Path to apps registry JSON | `~/.local/share/datadog-skill/apps.json` |

## Failure modes

| Symptom | Fix |
|---|---|
| `error: not_logged_in` | `node scripts/login.mjs --headed` |
| `error: storage_state_expired` | Same — cookies aged out |
| `op CLI failed reading "<item>"` | `eval $(op signin)` then retry, or set `DD_OP_ITEM` |
| Headed login window shows MFA challenge | Complete it in the browser; the script waits up to 180s |
| Page renders blank / timeout | Re-run with `--headed` to inspect |

## Security

- Credentials read at login time only. Never logged, never cached in env vars by the script itself.
- `storage-state.json` lives outside the repo and is `chmod 600`.
- The skill is **read-only** to Datadog — it never writes monitors, dashboards, or events. (`/datadog-create-app` is the one exception — it provisions RUM applications.)
