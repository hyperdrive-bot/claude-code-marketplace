#!/usr/bin/env node
import path from 'path'
import { hasStorageState, VIDEO_DIR } from './lib/auth.mjs'
import { launch, snap, isLoggedIn, parseArgs } from './lib/browser.mjs'
import { urlSessionReplay } from './lib/url.mjs'

const args = parseArgs(process.argv.slice(2))
const sessionId = args._[0] || args.session

if (!sessionId) {
  console.error(JSON.stringify({ error: 'missing_session_id', usage: 'watch.mjs <session-id> [--frames N]' }))
  process.exit(1)
}

if (!hasStorageState()) {
  console.error(JSON.stringify({ error: 'not_logged_in', hint: 'Run scripts/login.mjs --headed first' }))
  process.exit(2)
}

const url = urlSessionReplay(sessionId)
const frameCount = Number(args.frames ?? 6)
console.error(`[datadog] replay → ${url} (capturing ${frameCount} frames)`)

const { browser, page } = await launch({ headed: !!args.headed })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {})
await page.waitForTimeout(5000)

if (!(await isLoggedIn(page))) {
  await browser.close()
  console.error(JSON.stringify({ error: 'storage_state_expired', hint: 'Re-run scripts/login.mjs' }))
  process.exit(2)
}

const playButton = page.locator('button[aria-label*="Play" i], button:has-text("Play")').first()
if (await playButton.count() > 0) {
  await playButton.click().catch(() => {})
}

const initial = await snap(page, `replay-${sessionId}-frame-0`)

const frames = [initial]
for (let i = 1; i < frameCount; i++) {
  await page.waitForTimeout(3000)
  frames.push(await snap(page, `replay-${sessionId}-frame-${i}`))
}

const eventLog = []
try {
  const rows = await page.locator('[data-testid*="action"], [data-testid*="event"]').all()
  for (const row of rows.slice(0, 50)) {
    const text = (await row.textContent().catch(() => ''))?.trim()
    if (text) eventLog.push(text.slice(0, 200))
  }
} catch {}

console.log(JSON.stringify({
  url,
  session_id: sessionId,
  frames,
  events_visible: eventLog.length,
  events_sample: eventLog.slice(0, 10),
  video_dir: VIDEO_DIR,
  note: 'Native MP4 download not implemented. Frames captured. For full replay download use the Datadog UI Export menu.',
}, null, 2))

await browser.close()
