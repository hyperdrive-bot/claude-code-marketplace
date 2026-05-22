import { listApps } from './apps-registry.mjs'

// Datadog site (US1 by default). Override via DD_SITE_BASE for EU, AP1, etc.
//   https://app.datadoghq.com      (US1, default)
//   https://app.datadoghq.eu       (EU1)
//   https://us3.datadoghq.com      (US3)
//   https://us5.datadoghq.com      (US5)
//   https://ap1.datadoghq.com      (AP1)
const BASE = process.env.DD_SITE_BASE || 'https://app.datadoghq.com'

export function appId(name) {
  const apps = listApps()
  if (!name) {
    const registered = Object.keys(apps)
    if (registered.length === 0) {
      throw new Error(
        `No app specified and no apps registered.\n` +
        `Pass --app <alias-or-uuid> explicitly, or register one with /datadog-create-app.`,
      )
    }
    throw new Error(
      `--app required. Known aliases: ${registered.join(', ')} — or pass a raw RUM application UUID.`,
    )
  }
  if (apps[name]) return apps[name].applicationId
  if (/^[0-9a-f-]{36}$/i.test(name)) return name
  throw new Error(`Unknown app "${name}". Known: ${Object.keys(apps).join(', ') || '(none registered)'} — or pass a raw UUID.`)
}

export function timeRange({ last = '24h', from, to } = {}) {
  if (from && to) {
    return { from_ts: Date.parse(from), to_ts: Date.parse(to) }
  }
  const now = Date.now()
  return { from_ts: now - parseDuration(last), to_ts: now }
}

function parseDuration(s) {
  const m = /^(\d+)([smhdw])$/.exec(String(s).trim())
  if (!m) throw new Error(`Bad duration "${s}" — use forms like 15m, 1h, 24h, 7d`)
  const unit = { s: 1e3, m: 60e3, h: 3.6e6, d: 8.64e7, w: 6.048e8 }[m[2]]
  return parseInt(m[1], 10) * unit
}

function buildQuery(parts, { tenant, user, query } = {}) {
  if (tenant) parts.push(`@usr.tenantId:${tenant}`)
  if (user) parts.push(`@usr.email:${user}`)
  if (query) parts.push(query)
  return parts.join(' ')
}

export function urlSessionExplorer(opts = {}) {
  const { from_ts, to_ts } = timeRange(opts)
  const q = buildQuery([`@type:session`, `@application.id:${appId(opts.app)}`], opts)
  const params = new URLSearchParams({
    query: q,
    agg_m: 'count', agg_m_source: 'base', agg_t: 'count', cols: '',
    from_ts: String(from_ts), to_ts: String(to_ts), live: 'true',
  })
  return `${BASE}/rum/sessions?${params.toString()}`
}

export function urlPerformance(opts = {}) {
  const { from_ts, to_ts } = timeRange(opts)
  const q = buildQuery([`@session.type:user`, `@application.id:${appId(opts.app)}`], opts)
  const params = new URLSearchParams({
    query: q,
    agg_m: '@view.loading_time',
    from_ts: String(from_ts), to_ts: String(to_ts), live: 'true',
  })
  return `${BASE}/rum/performance-monitoring?${params.toString()}`
}

export function urlFailingResources(opts = {}) {
  const { from_ts, to_ts } = timeRange(opts)
  const status = opts.status || '>=400'
  const q = buildQuery(
    [`@session.type:user`, `@application.id:${appId(opts.app)}`, `@type:resource`, `@resource.status_code:${status}`],
    opts,
  )
  const params = new URLSearchParams({
    query: q,
    refresh_mode: 'sliding', viz: 'stream',
    from_ts: String(from_ts), to_ts: String(to_ts), live: 'true',
  })
  return `${BASE}/rum/sessions?${params.toString()}`
}

export function urlErrorTracking(opts = {}) {
  const { from_ts, to_ts } = timeRange(opts)
  const params = new URLSearchParams({
    query: `application.id:${appId(opts.app)}`,
    fromUser: 'false',
    refresh_mode: 'sliding',
    source: opts.source || 'browser',
    from_ts: String(from_ts), to_ts: String(to_ts), live: 'true',
  })
  return `${BASE}/error-tracking?${params.toString()}`
}

export function urlSessionReplay(sessionId) {
  if (!sessionId) throw new Error('sessionId required')
  return `${BASE}/rum/replay/sessions/${sessionId}`
}
