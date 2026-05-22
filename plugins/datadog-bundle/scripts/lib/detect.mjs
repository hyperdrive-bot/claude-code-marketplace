import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export function detectPackageManager(projectPath) {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(projectPath, 'bun.lockb'))) return 'bun'
  if (existsSync(join(projectPath, 'package-lock.json'))) return 'npm'
  return 'npm'
}

export function readPkgJson(projectPath) {
  const path = join(projectPath, 'package.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new Error(`package.json is unreadable at ${path}: ${err.message}`)
  }
}

function hasConfigFile(projectPath, names) {
  return names.some(n => existsSync(join(projectPath, n)))
}

function depsOf(pkg) {
  return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
}

function findFirstExisting(projectPath, candidates) {
  for (const candidate of candidates) {
    if (existsSync(join(projectPath, candidate))) return candidate
  }
  return null
}

export function detectFramework(projectPath) {
  const pkg = readPkgJson(projectPath)
  if (!pkg) return { framework: 'unknown', reason: 'no_package_json' }

  const deps = depsOf(pkg)

  if (deps.next || hasConfigFile(projectPath, ['next.config.js', 'next.config.ts', 'next.config.mjs'])) {
    const hasAppDir = existsSync(join(projectPath, 'src/app')) || existsSync(join(projectPath, 'app'))
    const hasPagesDir = existsSync(join(projectPath, 'src/pages')) || existsSync(join(projectPath, 'pages'))
    const router = hasAppDir ? 'app' : (hasPagesDir ? 'pages' : 'app')
    return {
      framework: router === 'app' ? 'next-app-router' : 'next-pages-router',
      version: deps.next,
      router,
      srcDir: existsSync(join(projectPath, 'src')) ? 'src' : '.',
      pkg,
    }
  }

  if (deps.vite || hasConfigFile(projectPath, ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'])) {
    const entrypoint = findFirstExisting(projectPath, [
      'src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js',
    ])
    return {
      framework: 'vite',
      version: deps.vite,
      entrypoint,
      srcDir: 'src',
      pkg,
    }
  }

  if (deps['react-scripts']) {
    const entrypoint = findFirstExisting(projectPath, [
      'src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js',
    ])
    return {
      framework: 'cra',
      version: deps['react-scripts'],
      entrypoint,
      srcDir: 'src',
      pkg,
    }
  }

  return { framework: 'unknown', reason: 'no_known_framework_in_deps', pkg }
}

export function envVarPrefix(framework) {
  if (framework.startsWith('next-')) return 'NEXT_PUBLIC_'
  if (framework === 'vite') return 'VITE_'
  if (framework === 'cra') return 'REACT_APP_'
  throw new Error(`No env prefix for framework "${framework}"`)
}

export function isPackageInstalled(projectPath, pkgName) {
  const pkg = readPkgJson(projectPath)
  if (!pkg) return false
  const deps = depsOf(pkg)
  return Boolean(deps[pkgName])
}

export function detectExistingInit(projectPath) {
  try {
    const out = execSync(
      `grep -rln "datadogRum.init" ${JSON.stringify(join(projectPath, 'src'))} 2>/dev/null || true`,
      { encoding: 'utf8' },
    )
    const files = out.trim().split('\n').filter(Boolean)
    if (files.length === 0) return { found: false }
    return { found: true, files }
  } catch {
    return { found: false }
  }
}

export function gitignoreCoversEnvLocal(projectPath) {
  const path = join(projectPath, '.gitignore')
  if (!existsSync(path)) return false
  const contents = readFileSync(path, 'utf8')
  return /\.env\.local|\.env\*\.local|^\.env$/m.test(contents)
}
