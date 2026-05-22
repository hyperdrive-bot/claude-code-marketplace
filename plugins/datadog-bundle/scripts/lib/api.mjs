import { getApiKeys } from './auth.mjs'

const BASE = process.env.DD_SITE_BASE || 'https://api.datadoghq.com'

export async function ddFetch(path, { method = 'GET', body, query } = {}) {
  const { apiKey, appKey } = getApiKeys()
  const url = new URL(BASE + path)
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v))
  const res = await fetch(url, {
    method,
    headers: {
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    let parsed
    try { parsed = JSON.parse(text) } catch {}
    const msg = parsed?.errors?.[0] || parsed?.error || text.slice(0, 800)
    throw new Error(`Datadog ${method} ${path} → ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`)
  }
  return text ? JSON.parse(text) : null
}

export async function searchRumEvents({ query, from_ts, to_ts, limit = 100, sort = '-timestamp' }) {
  return ddFetch('/api/v2/rum/events/search', {
    method: 'POST',
    body: {
      filter: {
        from: new Date(from_ts).toISOString(),
        to: new Date(to_ts).toISOString(),
        query,
      },
      page: { limit },
      sort,
    },
  })
}

export async function aggregateRumAnalytics({ query, from_ts, to_ts, computeMetric, groupBy = [], limit = 25 }) {
  return ddFetch('/api/v2/rum/analytics/aggregate', {
    method: 'POST',
    body: {
      filter: {
        from: new Date(from_ts).toISOString(),
        to: new Date(to_ts).toISOString(),
        query,
      },
      compute: [{ aggregation: 'avg', metric: computeMetric, type: 'total' }],
      group_by: groupBy.map(g => ({ facet: g, limit, sort: { aggregation: 'count', order: 'desc', type: 'measure' } })),
    },
  })
}

export async function searchErrorTracking({ query, from_ts, to_ts, limit = 50 }) {
  return ddFetch('/api/v2/error-tracking/events/search', {
    method: 'POST',
    body: {
      filter: {
        from: new Date(from_ts).toISOString(),
        to: new Date(to_ts).toISOString(),
        query,
      },
      page: { limit },
      sort: '-timestamp',
    },
  })
}
