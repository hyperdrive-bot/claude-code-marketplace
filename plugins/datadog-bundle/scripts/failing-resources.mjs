#!/usr/bin/env node
import { parseArgs } from './lib/args.mjs'
import { searchRumEvents } from './lib/api.mjs'
import { buildQuery, timeRange, pickResourceFields } from './lib/format.mjs'

const args = parseArgs(process.argv.slice(2))
const { from_ts, to_ts } = timeRange(args)
const limit = Number(args.limit ?? 100)
const status = args.status ?? '>=400'

const query = buildQuery({
  app: args.app,
  tenant: args.tenant,
  user: args.user,
  baseTerms: ['@type:resource', `@resource.status_code:${status}`],
  extra: args.query,
})

const res = await searchRumEvents({ query, from_ts, to_ts, limit })
const resources = (res.data ?? []).map(pickResourceFields)

const byStatus = {}
const byPath = {}
for (const r of resources) {
  if (r.status_code != null) byStatus[r.status_code] = (byStatus[r.status_code] ?? 0) + 1
  if (r.url) {
    const path = r.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0].slice(0, 80)
    byPath[path] = (byPath[path] ?? 0) + 1
  }
}

console.log(JSON.stringify({
  query,
  time: { from: new Date(from_ts).toISOString(), to: new Date(to_ts).toISOString() },
  total_returned: resources.length,
  has_more: !!res.meta?.page?.after,
  breakdown_by_status: byStatus,
  top_paths: Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 10),
  resources,
}, null, 2))
