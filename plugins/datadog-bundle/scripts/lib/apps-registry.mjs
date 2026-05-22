// RUM application registry.
//
// Stores per-machine map of <alias> → { applicationId, clientToken, type }.
// Storage location: ~/.local/share/datadog-skill/apps.json (chmod 600).
//
// There are no built-in apps — register your own with /datadog-create-app
// or by appending to the registry file directly.

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const REGISTRY_PATH = process.env.DD_APPS_REGISTRY ||
  join(homedir(), '.local', 'share', 'datadog-skill', 'apps.json')

function load() {
  if (!existsSync(REGISTRY_PATH)) return {}
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))
  } catch (err) {
    throw new Error(`apps.json is corrupt at ${REGISTRY_PATH}: ${err.message}`)
  }
}

function save(registry) {
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true })
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n')
  try { chmodSync(REGISTRY_PATH, 0o600) } catch {}
}

export function listApps() {
  return load()
}

export function getApp(name) {
  const all = listApps()
  return all[name] || null
}

export function registerApp(name, { applicationId, clientToken, type = 'browser', org }) {
  if (!name) throw new Error('registerApp: name required')
  if (!applicationId) throw new Error('registerApp: applicationId required')
  const registry = load()
  registry[name] = {
    applicationId,
    clientToken: clientToken || null,
    type,
    ...(org ? { org } : {}),
    source: 'created',
    registeredAt: new Date().toISOString(),
  }
  save(registry)
  return registry[name]
}

export function registryPath() {
  return REGISTRY_PATH
}
