#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  detectFramework, detectPackageManager, envVarPrefix,
  isPackageInstalled, gitignoreCoversEnvLocal, readPkgJson,
  detectExistingInit,
} from './lib/detect.mjs'
import {
  initFileBody, writeIfAbsent, appendEnvLocal, prependImport,
  entrypointPath, injectionTarget,
} from './lib/scaffold.mjs'

function parseArgs(argv) {
  const args = { _: [], apply: false, noCreate: false, forceOverwrite: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--no-create') args.noCreate = true
    else if (a === '--force-overwrite') args.forceOverwrite = true
    else if (a === '--app-id') args.appId = argv[++i]
    else if (a === '--client-token') args.clientToken = argv[++i]
    else if (a === '--name') args.name = argv[++i]
    else if (a === '--service') args.service = argv[++i]
    else if (a.startsWith('--')) throw new Error(`Unknown flag: ${a}`)
    else args._.push(a)
  }
  args.projectPath = resolve(args._[0] || process.cwd())
  return args
}

function installCmd(manager, pkg) {
  switch (manager) {
    case 'pnpm': return ['pnpm', 'add', pkg]
    case 'yarn': return ['yarn', 'add', pkg]
    case 'bun':  return ['bun', 'add', pkg]
    default:     return ['npm', 'install', '--save', pkg]
  }
}

async function provisionApp({ name, apply }) {
  const cmd = `node ${resolve(import.meta.dirname || new URL('.', import.meta.url).pathname, '../../datadog-create-app/scripts/create-app.mjs')} ${JSON.stringify(name)}`
  if (!apply) return { status: 'deferred', willCreateOnApply: true, name }
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const parsed = JSON.parse(out)
    if (parsed.status === 'error') return { status: 'error', message: parsed.message }
    return { status: parsed.status, applicationId: parsed.app.applicationId, clientToken: parsed.app.clientToken, name: parsed.app.name, alias: parsed.app.alias }
  } catch (err) {
    return { status: 'error', message: err.stderr?.toString() || err.message }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!existsSync(join(args.projectPath, 'package.json'))) {
    console.log(JSON.stringify({ status: 'error', message: `No package.json at ${args.projectPath}` }, null, 2))
    process.exit(1)
  }

  const fw = detectFramework(args.projectPath)
  if (fw.framework === 'unknown') {
    console.log(JSON.stringify({ status: 'error', error: 'unsupported_framework', detail: fw.reason, projectPath: args.projectPath }, null, 2))
    process.exit(1)
  }

  const existing = detectExistingInit(args.projectPath)
  const registerOnly = existing.found

  const pkgManager = detectPackageManager(args.projectPath)
  const pkg = fw.pkg || readPkgJson(args.projectPath)
  const projectName = args.name || pkg.name || 'rum-app'
  const service = args.service || projectName
  const envPrefix = envVarPrefix(fw.framework)

  // Plan
  const actions = []
  const alreadyInstalled = isPackageInstalled(args.projectPath, '@datadog/browser-rum')

  let entryPath, initBody, inject
  if (registerOnly) {
    actions.push({ kind: 'detect', existingInit: existing.files, note: 'project already wired; skipping install/scaffold/inject' })
  } else {
    if (!alreadyInstalled) actions.push({ kind: 'install', package: '@datadog/browser-rum', manager: pkgManager })
    entryPath = entrypointPath({ framework: fw.framework, srcDir: fw.srcDir, entrypoint: fw.entrypoint, projectPath: args.projectPath })
    initBody = initFileBody({ envPrefix, service })
    actions.push(writeIfAbsent(entryPath, initBody, { apply: false, force: args.forceOverwrite }))
    inject = injectionTarget({ framework: fw.framework, projectPath: args.projectPath, entrypoint: fw.entrypoint })
    if (inject) actions.push({ ...prependImport(inject.path, inject.importLine, { apply: false }), importLine: inject.importLine })
  }

  // RUM provisioning
  let rumApp
  if (args.appId && args.clientToken) {
    rumApp = { status: 'provided', applicationId: args.appId, clientToken: args.clientToken, name: projectName }
  } else if (args.noCreate) {
    rumApp = { status: 'error', message: '--no-create set but no --app-id/--client-token provided' }
  } else {
    rumApp = await provisionApp({ name: projectName, apply: args.apply })
  }

  // Env vars
  const envPath = join(args.projectPath, '.env.local')
  const kv = {}
  if (rumApp.applicationId) {
    kv[`${envPrefix}DATADOG_APPLICATION_ID`] = rumApp.applicationId
    kv[`${envPrefix}DATADOG_CLIENT_TOKEN`] = rumApp.clientToken || ''
  }
  const envAction = Object.keys(kv).length
    ? appendEnvLocal(envPath, kv, { apply: false })
    : { kind: 'env', file: envPath, action: 'deferred', reason: 'no_credentials_yet' }
  actions.push(envAction)

  const warnings = []
  if (!gitignoreCoversEnvLocal(args.projectPath)) warnings.push('.env.local is not gitignored — add it to .gitignore before committing.')
  if (rumApp.status === 'error') warnings.push(`rumApp: ${rumApp.message}`)
  const conflictAction = actions.find(a => a.action === 'conflict')
  if (conflictAction) warnings.push(`conflict on ${conflictAction.path || conflictAction.file} — pass --force-overwrite (file) or resolve env mismatch manually`)

  if (!args.apply) {
    console.log(JSON.stringify({
      status: 'plan',
      project: { path: args.projectPath, framework: fw.framework, router: fw.router, packageManager: pkgManager, service, envPrefix },
      rumApp,
      actions,
      warnings,
      hint: 'Re-run with --apply to perform the install.',
    }, null, 2))
    return
  }

  // APPLY
  if (rumApp.status === 'error' || (!rumApp.applicationId && !args.noCreate)) {
    console.log(JSON.stringify({ status: 'error', message: 'RUM provisioning failed; aborting before file writes', rumApp }, null, 2))
    process.exit(1)
  }
  if (conflictAction) {
    console.log(JSON.stringify({ status: 'aborted', message: 'Refusing to overwrite due to conflict', conflict: conflictAction }, null, 2))
    process.exit(1)
  }

  const wrote = []
  const installed = []
  const skipped = []

  if (registerOnly) {
    skipped.push('install/scaffold/inject (project already wired)')
  } else {
    if (!alreadyInstalled) {
      const [bin, ...rest] = installCmd(pkgManager, '@datadog/browser-rum')
      execSync([bin, ...rest].join(' '), { cwd: args.projectPath, stdio: 'inherit' })
      installed.push('@datadog/browser-rum')
    } else {
      skipped.push('install:@datadog/browser-rum (already in deps)')
    }

    const writeResult = writeIfAbsent(entryPath, initBody, { apply: true, force: args.forceOverwrite })
    if (writeResult.action === 'create' || writeResult.action === 'overwrite') wrote.push(writeResult.path)
    else skipped.push(`write:${writeResult.path} (${writeResult.action})`)

    if (inject) {
      const injectResult = prependImport(inject.path, inject.importLine, { apply: true })
      if (injectResult.action === 'prepend') wrote.push(inject.path)
      else skipped.push(`inject:${inject.path} (${injectResult.action})`)
    }
  }

  if (Object.keys(kv).length) {
    const envResult = appendEnvLocal(envPath, kv, { apply: true })
    if (envResult.action === 'create' || envResult.action === 'append') wrote.push(envPath)
    else skipped.push(`env:${envPath} (${envResult.action})`)
  }

  console.log(JSON.stringify({
    status: 'applied',
    project: { path: args.projectPath, framework: fw.framework, router: fw.router, packageManager: pkgManager, service, envPrefix },
    rumApp: { applicationId: rumApp.applicationId, clientToken: rumApp.clientToken, name: rumApp.name, alias: rumApp.alias },
    wrote,
    installed,
    skipped,
    warnings,
    next: 'Restart the dev server and visit the app. Verify events at https://app.datadoghq.com/rum/list',
  }, null, 2))
}

main().catch(err => {
  console.log(JSON.stringify({ status: 'error', message: err.message, stack: err.stack?.split('\n').slice(0, 3) }, null, 2))
  process.exit(1)
})
