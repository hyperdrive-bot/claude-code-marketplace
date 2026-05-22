#!/usr/bin/env node
import { chromium } from 'playwright'
import { ensureDirs, getCredentials, hasStorageState, storageStateAgeHours, lockdownStorage, STORAGE_STATE } from './lib/auth.mjs'
import { parseArgs, persistAuth } from './lib/browser.mjs'

const args = parseArgs(process.argv.slice(2))
const FRESH_HOURS = Number(args['fresh-hours'] ?? 24)
const headed = args.headed !== false
const probeOnly = args.probe === true

if (!args.force && hasStorageState() && storageStateAgeHours() < FRESH_HOURS) {
  console.log(JSON.stringify({
    status: 'cached',
    age_hours: Number(storageStateAgeHours().toFixed(2)),
    storage_state: STORAGE_STATE,
  }))
  process.exit(0)
}

if (probeOnly) {
  console.log(JSON.stringify({ status: 'stale_or_missing', need_login: true }))
  process.exit(2)
}

ensureDirs()
const { email, password } = getCredentials()
console.error(`[datadog] launching browser (headed=${headed}). Complete MFA in the window if prompted.`)

const browser = await chromium.launch({ headless: !headed })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

await page.goto('https://app.datadoghq.com/account/login', { waitUntil: 'networkidle', timeout: 30000 })

const userInput = page.locator('input[name="username"]').first()
await userInput.waitFor({ timeout: 15000 })
await userInput.fill(email)

const pwInput = page.locator('input[name="password"]').first()
await pwInput.fill(password)

await page.locator('button:has-text("Log in")').first().click()

console.error('[datadog] waiting for dashboard (up to 180s — handle MFA in the browser if needed)...')
try {
  await page.waitForURL(
    url => {
      const s = url.toString()
      return s.includes('app.datadoghq.com') && !s.includes('/account/login') && !s.includes('/login')
    },
    { timeout: 180000 },
  )
} catch (e) {
  console.error('[datadog] login window did not advance. Browser stays open 30s for manual completion...')
  await page.waitForTimeout(30000)
}

const finalUrl = page.url()
const ok = finalUrl.includes('app.datadoghq.com') && !finalUrl.includes('/account/login')

if (ok) {
  await persistAuth(context)
  console.log(JSON.stringify({
    status: 'logged_in',
    storage_state: STORAGE_STATE,
    landed_url: finalUrl,
  }))
} else {
  console.log(JSON.stringify({
    status: 'failed',
    landed_url: finalUrl,
    hint: 'Re-run with --headed and complete MFA manually',
  }))
  process.exit(1)
}

await browser.close()
