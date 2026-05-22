---
name: datadog-errors
description: "Query Datadog RUM error events via the public API. Returns structured JSON with message, type, source, stack first line, user, view URL, and grouped top messages. Sub-second. Use when the user asks 'show frontend errors', 'what's blowing up', 'errors for tenant X'. Usage: /datadog-errors --app <alias|uuid> [--last 1h|24h] [--tenant <id>] [--user <email>] [--query <DQL>]"
user-invocable: true
allowed-tools: Bash
argument-hint: "--app <alias|uuid> [--last 1h|24h] [--tenant <id>] [--user <email>] [--limit 100]"
---

# /datadog-errors — RUM Error Search (API)

Calls `POST /api/v2/rum/events/search` with `@type:error` filter. Groups errors by message in the response.

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/errors.mjs" $ARGUMENTS
```

## Flags

- `--app <alias|uuid>` — **required**
- `--tenant <tenantId>` — narrow to one tenant
- `--user <email>` — narrow to one user
- `--last 24h` (default)
- `--from ISO --to ISO` — explicit window
- `--query <raw>` — extra DQL terms (e.g. `"@error.source:console"`, `"@view.url:*folders*"`)
- `--limit 100`

## Returns

```json
{
  "query": "...",
  "time": { "from", "to" },
  "total_returned": N,
  "has_more": true|false,
  "top_messages": [["Error sending invitation:", 3], ...],
  "errors": [
    { "timestamp", "message", "type", "source", "stack_first_line",
      "user_email", "tenant_id", "session_id", "view_url" }
  ]
}
```

## Common patterns

| User says | Args |
|---|---|
| "frontend errors last 24h" | `--app myapp` |
| "errors for tenant abc last hour" | `--app myapp --tenant abc --last 1h` |
| "what's blowing up in checkout" | `--app myapp --query "@view.url:*checkout*"` |
| "JS errors only" | `--app myapp --query "@error.source:source"` |

## Drill-in chain

The `top_messages` aggregation surfaces the dominant errors. For any session_id of interest, hand off to `/datadog-watch` to see the user's actual interaction.

## Failure modes

- `Datadog … 401`: bad keys → check `DD_API_KEY`/`DD_APP_KEY` or 1Password item
- Empty `errors: []`: app may genuinely have no errors in window — confirm by checking sessions list with `--query "@error:*"` via `/datadog-sessions`
