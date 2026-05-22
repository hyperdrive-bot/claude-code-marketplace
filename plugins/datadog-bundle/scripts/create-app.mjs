#!/usr/bin/env node
import { ddFetch } from '../../datadog/scripts/lib/api.mjs'
import { registerApp, registryPath } from '../../datadog/scripts/lib/apps-registry.mjs'

function parseArgs(argv) {
  const args = { _: [], type: 'browser', force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--type') args.type = argv[++i]
    else if (a === '--register-as') args.alias = argv[++i]
    else if (a === '--force') args.force = true
    else if (a.startsWith('--')) throw new Error(`Unknown flag: ${a}`)
    else args._.push(a)
  }
  args.name = args._[0]
  return args
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

async function listExistingApps() {
  return ddFetch('/api/v2/rum/applications')
}

async function createApp({ name, type }) {
  return ddFetch('/api/v2/rum/applications', {
    method: 'POST',
    body: {
      data: {
        type: 'rum_application_create',
        attributes: { name, type },
      },
    },
  })
}

function extractApp(record) {
  const attrs = record.attributes || record
  return {
    name: attrs.name,
    applicationId: attrs.application_id || record.id,
    clientToken: attrs.client_token || null,
    type: attrs.type || 'browser',
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.name) {
    console.error('Usage: create-app.mjs <app-name> [--type browser] [--register-as <alias>] [--force]')
    process.exit(2)
  }

  const alias = args.alias || slugify(args.name)

  if (!args.force) {
    const existing = await listExistingApps()
    const records = existing.data || []
    const match = records.find(r => (r.attributes?.name || '') === args.name)
    if (match) {
      const app = extractApp(match)
      registerApp(alias, { ...app })
      console.log(JSON.stringify({
        status: 'exists',
        app: { alias, ...app, datadogUrl: 'https://app.datadoghq.com/rum/list' },
        registry: registryPath(),
        hint: 'Pass --force to create a duplicate, or reuse the existing applicationId.',
      }, null, 2))
      return
    }
  }

  const created = await createApp({ name: args.name, type: args.type })
  const app = extractApp(created.data || created)
  registerApp(alias, { ...app })

  console.log(JSON.stringify({
    status: 'created',
    app: { alias, ...app, datadogUrl: 'https://app.datadoghq.com/rum/list' },
    registry: registryPath(),
  }, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ status: 'error', message: err.message }, null, 2))
  process.exit(1)
})
