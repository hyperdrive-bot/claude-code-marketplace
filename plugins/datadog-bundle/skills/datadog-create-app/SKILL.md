---
name: datadog-create-app
description: "Create a new Browser RUM application in your Datadog org and return applicationId + clientToken. Pre-checks for name collisions and registers the new app so other /datadog-* skills can target it by alias. Use when the user says 'create a Datadog app for X', 'provision RUM', 'I need a new Datadog application ID'. Usage: /datadog-create-app <name> [--type browser]"
user-invocable: true
allowed-tools: Bash
argument-hint: "<app-name> [--type browser|ios|android|react-native|flutter|electron] [--register-as <alias>] [--force]"
---

# /datadog-create-app — Provision a New RUM Application

Creates a new Datadog Real User Monitoring (RUM) application via the public API and registers it locally so other `/datadog-*` skills can target it by alias.

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/create-app.mjs" $ARGUMENTS
```

## Arguments

- `<app-name>` — **required**. Human-readable name shown in the Datadog UI. Examples: `acme-frontend`, `marketing-site`.
- `--type browser` (default) — also supports `ios`, `android`, `react-native`, `flutter`, `electron`, `roku`, `kotlin-multiplatform`.
- `--register-as <alias>` — optional. The short alias used by other skills (`/datadog-sessions --app <alias>`). Defaults to a slugified `<app-name>`.
- `--force` — create even if an app with the same name already exists in the org. Default behavior is to refuse and print the existing app instead.

## Credentials

Requires either:

- `DD_API_KEY` + `DD_APP_KEY` env vars (App key needs `rum_apps_write` scope), OR
- 1Password item named via `DD_OP_ITEM` env (default `Datadog`) with API + App keys.

For non-US Datadog sites, set `DD_SITE_BASE` (e.g. `https://api.datadoghq.eu`).

## Returns (stdout JSON)

```json
{
  "status": "created",
  "app": {
    "name": "acme-frontend",
    "alias": "acme-frontend",
    "applicationId": "uuid",
    "clientToken": "pubXXXXXXXXXXXXXX",
    "type": "browser",
    "datadogUrl": "https://app.datadoghq.com/rum/list"
  },
  "registry": "~/.local/share/datadog-skill/apps.json"
}
```

On name collision (without `--force`):

```json
{
  "status": "exists",
  "app": { ... existing app, registered ... },
  "hint": "Pass --force to create a duplicate, or use the existing applicationId."
}
```

## How to use the output

The `applicationId` and `clientToken` are the two values you wire into the frontend project's `.env.local`:

```bash
NEXT_PUBLIC_DATADOG_APPLICATION_ID=<applicationId>
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN=<clientToken>
```

(Use `VITE_` or `REACT_APP_` prefix for Vite / CRA respectively.)

## Failure modes

- `Datadog … 401` — bad API/App keys.
- `Datadog … 403` — the App key lacks `rum_apps_write` scope. Regenerate it with that scope.
- `Datadog … 429` — rate limit; retry in ~30s.

## What this skill does NOT do

- Does not install any SDK or write code in your project.
- Does not configure dashboards, monitors, or service maps.
- Does not create APM services (only the RUM application surface).
