import { chromium } from 'playwright'
import path from 'path'
import { ensureDirs, hasStorageState, lockdownStorage, STORAGE_STATE, SCREENSHOT_DIR } from './auth.mjs'

export async function launch({ headed = false, useStorage = true } = {}) {
  ensureDirs()
  const browser = await chromium.launch({ headless: !headed })
  const ctxOpts = { viewport: { width: 1600, height: 1000 } }
  if (useStorage && hasStorageState()) ctxOpts.storageState = STORAGE_STATE
  const context = await browser.newContext(ctxOpts)
  const page = await context.newPage()
  return { browser, context, page }
}

export async function persistAuth(context) {
  await context.storageState({ path: STORAGE_STATE })
  lockdownStorage()
}

export async function snap(page, name) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(SCREENSHOT_DIR, `${name}-${ts}.png`)
  await page.screenshot({ path: file, fullPage: false })
  return file
}

export async function isLoggedIn(page) {
  const url = page.url()
  return url.includes('app.datadoghq.com') && !url.includes('/account/login')
}

export { parseArgs } from './args.mjs'
