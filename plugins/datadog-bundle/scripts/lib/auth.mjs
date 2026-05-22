// Datadog auth helpers.
//
// Credentials resolution order:
//   1. DD_API_KEY + DD_APP_KEY env vars (preferred — works in CI + local)
//   2. 1Password item via `op` CLI (local dev convenience)
//      - Item name from env var DD_OP_ITEM (default: "Datadog")
//
// Storage layout (writable, per-machine):
//   ~/.local/share/datadog-skill/storage-state.json   — Playwright auth cookies
//   ~/.local/share/datadog-skill/screenshots/         — per-action PNGs
//   ~/.local/share/datadog-skill/videos/              — replay frames

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ENV_FILE = path.join(SKILL_ROOT, '.env')
if (fs.existsSync(ENV_FILE) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(ENV_FILE) } catch {}
}

export const STORAGE_DIR = path.join(os.homedir(), '.local/share/datadog-skill')
export const STORAGE_STATE = path.join(STORAGE_DIR, 'storage-state.json')
export const SCREENSHOT_DIR = path.join(STORAGE_DIR, 'screenshots')
export const VIDEO_DIR = path.join(STORAGE_DIR, 'videos')

const OP_ITEM = process.env.DD_OP_ITEM || 'Datadog'

export function ensureDirs() {
  for (const dir of [STORAGE_DIR, SCREENSHOT_DIR, VIDEO_DIR]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

function readOpItem() {
  let json
  try {
    json = execSync(`op item get "${OP_ITEM}" --format json`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (err) {
    const msg = err.stderr?.toString() || err.message
    throw new Error(
      `op CLI failed reading "${OP_ITEM}": ${msg.trim()}\n` +
      `Is op signed in? Try: eval $(op signin)\n` +
      `Or set DD_OP_ITEM env var to point at a different 1Password item.`,
    )
  }
  const item = JSON.parse(json)
  const byId = Object.fromEntries((item.fields || []).map(f => [f.id, f.value]))
  const byLabel = Object.fromEntries((item.fields || []).map(f => [f.label, f.value]))
  return { byId, byLabel }
}

export function getCredentials() {
  const { byId } = readOpItem()
  if (!byId.username || !byId.password) {
    throw new Error(`1Password item "${OP_ITEM}" missing username/password fields`)
  }
  return { email: byId.username, password: byId.password }
}

export function getApiKeys() {
  if (process.env.DD_API_KEY && process.env.DD_APP_KEY) {
    return { apiKey: process.env.DD_API_KEY.trim(), appKey: process.env.DD_APP_KEY.trim() }
  }
  const { byLabel } = readOpItem()
  let apiKey, appKey
  for (const v of Object.values(byLabel)) {
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (/^ddap[p]?_/i.test(t) || /^[a-f0-9]{40}$/i.test(t)) appKey ??= t
    else if (/^ddak_/i.test(t) || /^[a-f0-9]{32}$/i.test(t)) apiKey ??= t
  }
  if (!apiKey || !appKey) {
    throw new Error(
      `Missing Datadog credentials. Either:\n` +
      `  - set DD_API_KEY + DD_APP_KEY in env or ${ENV_FILE}, OR\n` +
      `  - add API key (ddak_*/32-hex) and App key (ddap_*/40-hex) to 1Password "${OP_ITEM}"\n` +
      `1Password labels found: ${Object.keys(byLabel).join(', ')}`,
    )
  }
  return { apiKey, appKey }
}

export function hasStorageState() {
  return fs.existsSync(STORAGE_STATE)
}

export function storageStateAgeHours() {
  if (!hasStorageState()) return Infinity
  return (Date.now() - fs.statSync(STORAGE_STATE).mtimeMs) / 3.6e6
}

export function lockdownStorage() {
  if (hasStorageState()) fs.chmodSync(STORAGE_STATE, 0o600)
}
