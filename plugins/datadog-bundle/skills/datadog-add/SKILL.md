---
name: datadog-add
description: "Wire Datadog Browser RUM into a frontend project. Detects Next.js/Vite/CRA, installs @datadog/browser-rum, scaffolds init code, wires env vars. Creates a new RUM application in your Datadog org if one isn't supplied. Use when the user says 'add Datadog to this project', 'wire up RUM for the frontend', 'instrument this React app'. Usage: /datadog-add [project-path] [--app-id <id> --client-token <token>] [--name <project-name>]"
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
argument-hint: "[project-path] [--app-id <id>] [--client-token <token>] [--name <project-name>] [--apply] [--no-create]"
---

# /datadog-add — Wire Datadog Browser RUM into a Frontend

End-to-end install of `@datadog/browser-rum` in a frontend project. Detects the framework, picks the right entrypoint, writes the init code, wires the env vars, and (optionally) provisions a fresh RUM application in your Datadog org if you don't pass `--app-id`.

## Default behavior — PREVIEW

Without `--apply`, the script prints the exact plan (files to write, packages to install, env keys to set) and exits without changing anything. Run with `--apply` once the plan looks right.

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/add.mjs" $ARGUMENTS
```

## Arguments

- `[project-path]` — path to the frontend project root. Defaults to the current working directory.
- `--name <project-name>` — name passed to `/datadog-create-app` when provisioning. Defaults to the project's `package.json` `name`.
- `--app-id <uuid>` — skip provisioning; use this existing RUM applicationId.
- `--client-token <pubXXXX>` — paired with `--app-id`. Required if `--app-id` is supplied.
- `--no-create` — refuse to provision. Forces the user to supply `--app-id` + `--client-token`.
- `--apply` — actually perform the install. Without this, the script is a dry run.
- `--service <name>` — override the `service` tag sent to Datadog. Defaults to the project name.

## What gets detected

| Signal | Outcome |
|---|---|
| `next.config.{js,ts,mjs}` or `package.json` deps include `next` | **Next.js** — App Router if `src/app/` or `app/` exists, else Pages Router |
| `vite.config.{js,ts,mjs}` or deps include `vite` | **Vite** |
| deps include `react-scripts` | **CRA** |
| `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` / `package-lock.json` | pnpm / yarn / bun / npm |

If detection fails, the script exits with a clear `unsupported_framework` error.

## What the plan covers

1. **Install** — `@datadog/browser-rum` via the detected package manager.
2. **Init file** — written at the framework-appropriate path:
   - Next.js App Router → `src/instrumentation-client.ts` (or `instrumentation-client.ts` at root)
   - Next.js Pages Router → `src/lib/datadog.ts` + `import '@/lib/datadog'` added to `pages/_app.{ts,tsx}`
   - Vite → `src/datadog.ts` + `import './datadog'` prepended to `src/main.{ts,tsx}`
   - CRA → `src/datadog.ts` + `import './datadog'` prepended to `src/index.{ts,tsx}`
3. **Env vars** — appended to `.env.local` (created if missing). Keys differ per framework:
   - Next.js → `NEXT_PUBLIC_DATADOG_APPLICATION_ID`, `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN`
   - Vite → `VITE_DATADOG_APPLICATION_ID`, `VITE_DATADOG_CLIENT_TOKEN`
   - CRA → `REACT_APP_DATADOG_APPLICATION_ID`, `REACT_APP_DATADOG_CLIENT_TOKEN`
4. **`.gitignore` check** — warns if `.env.local` is not gitignored.
5. **RUM app provisioning** — if no `--app-id` is passed (and `--no-create` is not set), calls `/datadog-create-app <name>` first.

## Plan output (default, no `--apply`)

```json
{
  "status": "plan",
  "project": { "path": "...", "framework": "next-app-router", "packageManager": "pnpm" },
  "actions": [
    { "kind": "install", "package": "@datadog/browser-rum", "manager": "pnpm" },
    { "kind": "write", "path": "src/instrumentation-client.ts", "exists": false, "bytes": 612 },
    { "kind": "env", "file": ".env.local", "keys": ["NEXT_PUBLIC_DATADOG_APPLICATION_ID", "NEXT_PUBLIC_DATADOG_CLIENT_TOKEN"] }
  ],
  "rumApp": { "status": "deferred", "willCreateOnApply": true, "name": "my-app" }
}
```

## Apply output (`--apply`)

```json
{
  "status": "applied",
  "project": { ... },
  "rumApp": { "applicationId": "...", "clientToken": "..." },
  "wrote": ["src/instrumentation-client.ts", ".env.local"],
  "installed": ["@datadog/browser-rum"],
  "skipped": [],
  "warnings": []
}
```

## Idempotency

Running `--apply` a second time should be a no-op:
- If `@datadog/browser-rum` is already in deps → skip install.
- If the init file already exists → diff; if identical, skip. If different, surface the diff and refuse (use `--force-overwrite` to replace).
- If env keys already exist with the same values → skip. If different values → refuse and surface.

## Failure modes

- `unsupported_framework` — couldn't detect Next/Vite/CRA. Inspect `package.json` manually.
- `entrypoint_missing` — framework detected but the expected entrypoint file is missing. Wrong project layout.
- `env_conflict` — `.env.local` already has DATADOG keys with different values.
- `init_file_conflict` — init file exists with different content. Pass `--force-overwrite` or remove it first.
- Errors from `/datadog-create-app` are surfaced verbatim with `rumApp.status: "error"`.

## What this skill does NOT do

- No backend/APM instrumentation. No `dd-trace`, no Lambda layer wiring.
- No tenant-aware user identification call (`datadogRum.setUser`) — that's app-specific glue the user adds.
- No dashboard or monitor scaffolding.
- No CI/CD env var injection — `.env.local` is dev-only. The user wires production env vars via Vercel / GitHub Actions / etc.
