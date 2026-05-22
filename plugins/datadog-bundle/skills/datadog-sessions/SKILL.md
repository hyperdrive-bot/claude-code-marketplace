---
name: datadog-sessions
description: "Query Datadog RUM sessions via the public API — filter by tenant/user/time/raw DQL. Returns structured JSON with session_id, user_email, view/error/action counts, duration, has_replay, browser/os/geo. Sub-second. Usage: /datadog-sessions --app <alias|uuid> [--tenant <id>] [--user <email>] [--last 24h | --from ISO --to ISO] [--query <DQL>] [--limit 50]"
user-invocable: true
allowed-tools: Bash
argument-hint: "--app <alias|uuid> [--tenant <id>] [--user <email>] [--last 1h|24h|7d] [--query <raw>] [--limit 50]"
---

# /datadog-sessions — RUM Session Search (API)

Calls Datadog's public RUM Events Search API (`POST /api/v2/rum/events/search`) with `@type:session` filter. Returns structured JSON — no browser, no screenshots.

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/sessions.mjs" $ARGUMENTS
```

## Flags

- `--app <alias|uuid>` — **required**. Either a registered alias (see `/datadog-create-app`) or a raw RUM application UUID.
- `--tenant <tenantId>` — appends `@usr.tenantId:<id>`
- `--user <email>` — appends `@usr.email:<email>`
- `--last 24h` (default) — `15m`, `1h`, `24h`, `7d`, `1w`
- `--from <iso> --to <iso>` — explicit window
- `--query <raw-dql>` — append raw DQL terms (AND-joined). Examples: `"@error:*"`, `"@view.url:*folders*"`
- `--limit 50` (default) — max sessions to return (DD API hard cap typically 1000)

## Returns

```json
{
  "query": "...",
  "time": { "from": "ISO", "to": "ISO" },
  "total_returned": N,
  "has_more": true|false,
  "sessions": [
    { "session_id", "user_email", "user_role", "tenant_id",
      "view_count", "error_count", "action_count",
      "duration_ms", "has_replay", "browser", "os", "geo", "timestamp" }
  ]
}
```

## Common patterns

| User says | Args |
|---|---|
| "sessions for tenant abc last 7 days" | `--app myapp --tenant abc --last 7d` |
| "sessions with errors today" | `--app myapp --query "@error:*"` |
| "sessions for user@example.com last hour" | `--app myapp --user user@example.com --last 1h` |
| "sessions hitting /checkout" | `--app myapp --query "@view.url:*checkout*"` |

## Failure modes

- `Datadog … 401`: API or App key invalid → check `DD_API_KEY` / `DD_APP_KEY` env or 1Password item (`DD_OP_ITEM`)
- `Datadog … 429`: rate-limited → reduce `--limit` or wait
- `Unknown app "X"`: register with `/datadog-create-app` first, or pass a raw UUID
- Empty `sessions: []`: broaden window or check filters with `--query "*"`

## Drill-in chain

After this returns sessions, use `session_id` from any row with `/datadog-watch` to capture replay frames.
