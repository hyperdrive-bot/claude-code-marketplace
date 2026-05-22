#!/usr/bin/env node
import { parseArgs } from './lib/args.mjs'
import { searchRumEvents } from './lib/api.mjs'
import { buildQuery, timeRange, pickErrorFields } from './lib/format.mjs'

const args = parseArgs(process.argv.slice(2))
const { from_ts, to_ts } = timeRange(args)
const limit = Number(args.limit ?? 100)

const query = buildQuery({
  app: args.app,
  tenant: args.tenant,
  user: args.user,
  baseTerms: ['@type:error'],
  extra: args.query,
})

const res = await searchRumEvents({ query, from_ts, to_ts, limit })
const errors = (res.data ?? []).map(pickErrorFields)

const byMessage = {}
for (const e of errors) {
  const key = (e.message ?? e.type ?? 'unknown').slice(0, 100)
  byMessage[key] = (byMessage[key] ?? 0) + 1
}

console.log(JSON.stringify({
  query,
  time: { from: new Date(from_ts).toISOString(), to: new Date(to_ts).toISOString() },
  total_returned: errors.length,
  has_more: !!res.meta?.page?.after,
  top_messages: Object.entries(byMessage).sort((a, b) => b[1] - a[1]).slice(0, 10),
  errors,
}, null, 2))
