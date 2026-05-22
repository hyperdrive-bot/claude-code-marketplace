export function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--headed') { out.headed = true; continue }
    if (a === '--force') { out.force = true; continue }
    if (a === '--ui') { out.ui = true; continue }
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) { out[key] = true }
      else { out[key] = next; i++ }
    } else {
      out._.push(a)
    }
  }
  return out
}
