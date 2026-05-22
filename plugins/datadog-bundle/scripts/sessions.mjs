#!/usr/bin/env node
import { parseArgs } from './lib/args.mjs'
import { searchRumEvents } from './lib/api.mjs'
import { buildQuery, timeRange, pickSessionFields } from './lib/format.mjs'

const args = parseArgs(process.argv.slice(2))
const { from_ts, to_ts } = timeRange(args)
const limit = Number(args.limit ?? 50)

const query = buildQuery({
  app: args.app,
  tenant: args.tenant,
  user: args.user,
  baseTerms: ['@type:session'],
  extra: args.query,
})

const res = await searchRumEvents({ query, from_ts, to_ts, limit })
const sessions = (res.data ?? []).map(pickSessionFields)

console.log(JSON.stringify({
  query,
  time: { from: new Date(from_ts).toISOString(), to: new Date(to_ts).toISOString() },
  total_returned: sessions.length,
  has_more: !!res.meta?.page?.after,
  sessions,
}, null, 2))
