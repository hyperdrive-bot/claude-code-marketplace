export function pickSessionFields(event) {
  const a = event.attributes?.attributes ?? {}
  return {
    session_id: a.session?.id,
    timestamp: event.attributes?.timestamp,
    user_email: a.usr?.email ?? null,
    user_name: a.usr?.name ?? null,
    user_role: a.usr?.role ?? null,
    tenant_id: a.usr?.tenantId ?? null,
    view_count: a.session?.view?.count ?? null,
    error_count: a.session?.error?.count ?? null,
    action_count: a.session?.action?.count ?? null,
    initial_view_url: a.session?.initial_view?.url ?? null,
    last_view_url: a.session?.last_view?.url ?? null,
    duration_ms: a.session?.time_spent != null ? Math.round(a.session.time_spent / 1e6) : null,
    has_replay: a.session?.has_replay ?? null,
    browser: a.browser?.name,
    os: a.os?.name,
    geo: a.geo?.country_iso_code,
  }
}

export function pickResourceFields(event) {
  const a = event.attributes?.attributes ?? {}
  return {
    timestamp: event.attributes?.timestamp,
    method: a.resource?.method ?? a.http?.method,
    url: a.resource?.url ?? a.http?.url,
    status_code: a.resource?.status_code ?? a.http?.status_code,
    duration_ms: a.resource?.duration != null ? Math.round(a.resource.duration / 1e6) : null,
    user_email: a.usr?.email ?? null,
    tenant_id: a.usr?.tenantId ?? null,
    session_id: a.session?.id,
    view_url: a.view?.url,
  }
}

export function pickErrorFields(event) {
  const a = event.attributes?.attributes ?? {}
  return {
    timestamp: event.attributes?.timestamp,
    message: a.error?.message?.slice(0, 200),
    type: a.error?.type,
    source: a.error?.source,
    stack_first_line: a.error?.stack?.split('\n')[0]?.slice(0, 200),
    user_email: a.usr?.email ?? null,
    tenant_id: a.usr?.tenantId ?? null,
    session_id: a.session?.id,
    view_url: a.view?.url,
  }
}

// Resolves `app` to a RUM application.id via the local registry
// (~/.local/share/datadog-skill/apps.json). Pass a raw UUID to skip the
// lookup. `--app` is required — there's no built-in default.
import { appId as resolveAppId } from './url.mjs'

export function buildQuery({ app, tenant, user, baseTerms = [], extra }) {
  const parts = [...baseTerms, `@application.id:${resolveAppId(app)}`]
  if (tenant) parts.push(`@usr.tenantId:${tenant}`)
  if (user) parts.push(`@usr.email:${user}`)
  if (extra) parts.push(extra)
  return parts.join(' ')
}

export function timeRange({ last = '24h', from, to } = {}) {
  if (from && to) return { from_ts: Date.parse(from), to_ts: Date.parse(to) }
  const m = /^(\d+)([smhdw])$/.exec(String(last).trim())
  if (!m) throw new Error(`Bad duration "${last}" — use 15m, 1h, 24h, 7d`)
  const ms = parseInt(m[1], 10) * { s: 1e3, m: 60e3, h: 3.6e6, d: 8.64e7, w: 6.048e8 }[m[2]]
  return { from_ts: Date.now() - ms, to_ts: Date.now() }
}
