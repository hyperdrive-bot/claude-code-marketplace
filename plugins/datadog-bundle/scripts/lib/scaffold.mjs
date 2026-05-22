import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function initFileBody({ envPrefix, service, env = 'process.env.NODE_ENV' }) {
  const appIdEnv = `${envPrefix}DATADOG_APPLICATION_ID`
  const tokenEnv = `${envPrefix}DATADOG_CLIENT_TOKEN`
  return `import { datadogRum } from '@datadog/browser-rum'

const applicationId = process.env.${appIdEnv}
const clientToken = process.env.${tokenEnv}

if (applicationId && clientToken && typeof window !== 'undefined') {
  datadogRum.init({
    applicationId,
    clientToken,
    site: 'datadoghq.com',
    service: ${JSON.stringify(service)},
    env: ${env},
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  })
}
`
}

export function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

export function writeIfAbsent(filePath, content, { apply, force }) {
  const exists = existsSync(filePath)
  if (exists) {
    const current = readFileSync(filePath, 'utf8')
    if (current === content) return { kind: 'write', path: filePath, exists: true, action: 'skip-identical', bytes: content.length }
    if (!force) return { kind: 'write', path: filePath, exists: true, action: 'conflict', bytes: content.length, diff: { currentBytes: current.length, newBytes: content.length } }
    if (apply) { ensureDir(filePath); writeFileSync(filePath, content) }
    return { kind: 'write', path: filePath, exists: true, action: 'overwrite', bytes: content.length }
  }
  if (apply) { ensureDir(filePath); writeFileSync(filePath, content) }
  return { kind: 'write', path: filePath, exists: false, action: 'create', bytes: content.length }
}

export function appendEnvLocal(envPath, kv, { apply }) {
  const exists = existsSync(envPath)
  const current = exists ? readFileSync(envPath, 'utf8') : ''
  const lines = current.split(/\r?\n/)
  const existingKeys = new Map()
  for (const line of lines) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line)
    if (m) existingKeys.set(m[1], m[2])
  }
  const conflicts = []
  const toAppend = []
  for (const [k, v] of Object.entries(kv)) {
    if (existingKeys.has(k)) {
      if (existingKeys.get(k) !== v) conflicts.push({ key: k, current: existingKeys.get(k), incoming: v })
    } else {
      toAppend.push(`${k}=${v}`)
    }
  }
  if (conflicts.length) return { kind: 'env', file: envPath, action: 'conflict', conflicts, keys: Object.keys(kv) }
  if (toAppend.length === 0) return { kind: 'env', file: envPath, action: 'skip-identical', keys: Object.keys(kv) }
  if (apply) {
    const sep = current.length && !current.endsWith('\n') ? '\n' : ''
    const header = existsSync(envPath) ? '' : ''
    const block = `${sep}# Datadog RUM\n${toAppend.join('\n')}\n`
    writeFileSync(envPath, current + header + block)
  }
  return { kind: 'env', file: envPath, action: exists ? 'append' : 'create', keys: Object.keys(kv), addedKeys: toAppend.map(s => s.split('=')[0]) }
}

export function prependImport(filePath, importLine, { apply }) {
  if (!existsSync(filePath)) return { kind: 'inject', path: filePath, action: 'missing' }
  const current = readFileSync(filePath, 'utf8')
  if (current.includes(importLine)) return { kind: 'inject', path: filePath, action: 'skip-identical' }
  const next = importLine + '\n' + current
  if (apply) writeFileSync(filePath, next)
  return { kind: 'inject', path: filePath, action: 'prepend', bytes: next.length }
}

export function entrypointPath({ framework, srcDir, entrypoint, projectPath }) {
  if (framework === 'next-app-router') {
    return join(projectPath, srcDir === '.' ? 'instrumentation-client.ts' : `${srcDir}/instrumentation-client.ts`)
  }
  if (framework === 'next-pages-router') {
    return join(projectPath, srcDir === '.' ? 'lib/datadog.ts' : `${srcDir}/lib/datadog.ts`)
  }
  if (framework === 'vite' || framework === 'cra') {
    return join(projectPath, 'src/datadog.ts')
  }
  throw new Error(`No entrypoint mapping for framework "${framework}"`)
}

export function injectionTarget({ framework, projectPath, entrypoint }) {
  if (framework === 'next-app-router') return null
  if (framework === 'next-pages-router') {
    const candidates = ['pages/_app.tsx', 'pages/_app.ts', 'pages/_app.jsx', 'pages/_app.js', 'src/pages/_app.tsx', 'src/pages/_app.ts', 'src/pages/_app.jsx', 'src/pages/_app.js']
    for (const c of candidates) {
      if (existsSync(join(projectPath, c))) return { path: join(projectPath, c), importLine: "import '@/lib/datadog'" }
    }
    return null
  }
  if (framework === 'vite' || framework === 'cra') {
    if (!entrypoint) return null
    return { path: join(projectPath, entrypoint), importLine: "import './datadog'" }
  }
  return null
}
