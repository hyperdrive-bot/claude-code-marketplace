#!/usr/bin/env node
import { parseArgs } from './lib/args.mjs'
import { aggregateRumAnalytics } from './lib/api.mjs'
import { buildQuery, timeRange } from './lib/format.mjs'

const args = parseArgs(process.argv.slice(2))
const { from_ts, to_ts } = timeRange(args)
const metric = args.metric ?? '@view.loading_time'

const query = buildQuery({
  app: args.app,
  baseTerms: ['@type:view'],
  extra: args.query,
})

const res = await aggregateRumAnalytics({
  query,
  from_ts,
  to_ts,
  computeMetric: metric,
  groupBy: args['group-by'] ? [args['group-by']] : ['@view.name'],
  limit: Number(args.limit ?? 25),
})

const buckets = (res.data?.buckets ?? []).map(b => ({
  view_name: b.by?.['@view.name'],
  avg_loading_time_ms: b.computes?.c0 != null ? Math.round(b.computes.c0 / 1e6) : null,
}))

console.log(JSON.stringify({
  query,
  metric,
  time: { from: new Date(from_ts).toISOString(), to: new Date(to_ts).toISOString() },
  total_views: buckets.length,
  buckets: buckets.sort((a, b) => (b.avg_loading_time_ms ?? 0) - (a.avg_loading_time_ms ?? 0)),
}, null, 2))
