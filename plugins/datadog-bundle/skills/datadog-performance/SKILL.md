---
name: datadog-performance
description: "Aggregate Datadog RUM view loading times via the public Analytics Aggregate API. Returns top slow views (avg loading_time per @view.name) sorted desc. Sub-second. Use when the user asks 'how is performance', 'check loading times', 'show app perf last week', 'slowest views'. Usage: /datadog-performance --app <alias|uuid> [--last 24h|7d] [--metric @view.loading_time] [--group-by @view.name]"
user-invocable: true
allowed-tools: Bash
argument-hint: "--app <alias|uuid> [--last 24h|7d] [--metric @view.first_contentful_paint|@view.largest_contentful_paint] [--limit 25]"
---

# /datadog-performance — RUM Analytics Aggregate (API)

Calls `POST /api/v2/rum/analytics/aggregate` with avg-of-metric grouped by view name. Returns slowest views first.

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/performance.mjs" $ARGUMENTS
```

## Flags

- `--app <alias|uuid>` — **required**
- `--metric @view.loading_time` (default) — alternatives: `@view.first_contentful_paint`, `@view.largest_contentful_paint`, `@view.first_input_delay`, `@view.cumulative_layout_shift`, `@view.dom_complete`, `@view.time_spent`
- `--group-by @view.name` (default) — could also be `@geo.country`, `@browser.name`, `@os.name`
- `--last 24h` (default)
- `--from ISO --to ISO`
- `--query <raw>` — extra DQL terms (e.g. `"@usr.tenantId:abc"`)
- `--limit 25` — top N buckets

## Returns

```json
{
  "query": "...",
  "metric": "@view.loading_time",
  "time": { "from", "to" },
  "total_views": N,
  "buckets": [
    { "view_name": "/documents/abc", "avg_loading_time_ms": 6716 },
    ...
  ]
}
```

Sorted by metric desc — slowest first.

## Common patterns

| User says | Args |
|---|---|
| "how is performance last 24h" | `--app myapp` |
| "FCP last 7 days" | `--app myapp --metric @view.first_contentful_paint --last 7d` |
| "perf by country last hour" | `--app myapp --group-by @geo.country --last 1h` |
| "slowest views for tenant abc" | `--app myapp --query "@usr.tenantId:abc"` |

## Note on metric units

Datadog stores RUM timing metrics in **nanoseconds**. The script converts to milliseconds in the output (`avg_loading_time_ms`). If you change `--metric` to non-timing measures (like `@view.cumulative_layout_shift`), the field name `avg_loading_time_ms` will be misleading — refer to the raw `metric` field for the source.
