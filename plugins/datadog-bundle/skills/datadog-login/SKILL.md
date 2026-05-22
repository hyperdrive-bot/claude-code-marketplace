---
name: datadog-login
description: "Authenticate to a Datadog org via Playwright. Headed by default so MFA can be completed in the browser. Saves storageState for ~weeks of cached auth. Usage: /datadog-login [--force] [--headless]"
user-invocable: true
allowed-tools: Bash
argument-hint: "[--force] [--headless]"
---

# /datadog-login — Authenticate Datadog (Playwright session)

Run the login script. By default it skips re-auth if `~/.local/share/datadog-skill/storage-state.json` is fresh (<24h). Pass `--force` to re-auth anyway. Pass `--headless` to skip the visible window (only safe when MFA is not enforced).

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/login.mjs" --headed $ARGUMENTS
```

If the script reports `op CLI failed`, tell the user to `eval $(op signin)` and retry.

If the script exits with `status: failed`, surface the `landed_url` and tell the user to re-run with `--headed` to handle MFA manually.

## Bootstrap (first time only, before any datadog-* action)

```bash
cd "${CLAUDE_PLUGIN_ROOT}" && npm install --no-audit --no-fund && npx playwright install chromium
```

## Credentials

Resolution order:

1. `DD_API_KEY` + `DD_APP_KEY` env vars (preferred — works in CI + local)
2. 1Password item named via `DD_OP_ITEM` env (default: `Datadog`), accessed via `op` CLI

For non-US Datadog sites, set `DD_SITE_BASE` (e.g. `https://app.datadoghq.eu`).

## Where data lands

- `~/.local/share/datadog-skill/storage-state.json` (chmod 600) — auth cookies, used by every other `/datadog-*` command
