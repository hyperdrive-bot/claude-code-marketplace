---
name: datadog-failing-resources
description: "Query Datadog RUM resources with status_code >= 400 (4xx/5xx) via the public API. Returns structured JSON with method, URL, status, duration, breakdown by status code, and top failing paths. Sub-second. Use when the user asks 'check failing requests', 'show 4xx', 'which APIs are erroring'. Usage: /datadog-failing-resources --app <alias|uuid> [--last 1h|24h] [--status >=400] [--tenant <id>] [--user <email>]"
user-invocable: true
allowed-tools: Bash
argument-hint: "--app <alias|uuid> [--last 1h|24h] [--status >=400|:403] [--tenant <id>] [--limit 100]"
---

# /datadog-failing-resources — RUM 4xx/5xx Search (API)

Calls `POST /api/v2/rum/events/search` with `@type:resource @resource.status_code:<status>` filter.

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/failing-resources.mjs" $ARGUMENTS
```

## Flags

- `--app <alias|uuid>` — **required**
- `--status >=400` (default) — also `>=500`, `:403`, `:404`
- `--tenant <tenantId>` — narrow to one tenant
- `--user <email>` — narrow to one user
- `--last 1h` (recommended for live triage)
- `--from ISO --to ISO` — explicit window
- `--query <raw>` — extra DQL terms
- `--limit 100` (default)

## Returns

```json
{
  "query": "...",
  "time": { "from", "to" },
  "total_returned": N,
  "has_more": true|false,
  "breakdown_by_status": { "401": 3, "404": 12 },
  "top_paths": [["/api/path", 5], ...],
  "resources": [
    { "timestamp", "method", "url", "status_code", "duration_ms",
      "user_email", "tenant_id", "session_id", "view_url" }
  ]
}
```

## Common patterns

| User says | Args |
|---|---|
| "check failing requests last hour" | `--app myapp --last 1h` |
| "5xx in last 15 min for tenant abc" | `--app myapp --tenant abc --status ">=500" --last 15m` |
| "all 403s today" | `--app myapp --status :403 --last 24h` |
| "401s on /checkout" | `--app myapp --status :401 --query "@resource.url:*checkout*"` |

## Drill-in chain

Take a `session_id` from interesting resources and feed to `/datadog-watch` to see what the user did.

## Failure modes

- `Datadog … 401`: bad keys → check `DD_API_KEY`/`DD_APP_KEY` or 1Password item
- Empty results: broaden window, check status filter syntax (`>=400` not `400+`)
