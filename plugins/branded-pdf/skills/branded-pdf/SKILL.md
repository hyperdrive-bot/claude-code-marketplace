---
name: branded-pdf
description: Generate a branded, multi-page PDF document (proposals, briefings, executive summaries, reports, retrospectives, deliverables) with cover + content pages + page-overflow detection. On first use, runs a brand wizard that collects colors, fonts, and logo, then generates a brand template you can reuse. Use when the user asks for a "branded PDF", "client deliverable", "proposal document", or any multi-page polished PDF.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash, Glob, AskUserQuestion
argument-hint: "[--brand <name>] [--title '...'] [--output <path>] [--register-brand <name>]"
---

# Branded PDF Generator

Creates any multi-page PDF with a branded cover + content pages. The opinionated bits:

- **Brand once, reuse forever** — register a brand (colors, fonts, logo) and it lives in `./templates/<name>/`
- **Page-overflow detection** — Chrome-headless renders, `pdftotext` counts pages, the script reports which logical page spilled over so you can split at natural boundaries
- **Section components** — `.metrics`, `.timeline`, `.phase-card`, `.highlight-box`, `.check-list`, `table`, `.badge` — same primitives that the `post-mortem` skill uses, so styling is consistent
- **Never edit CSS to shoehorn content** — overflow gets split at natural section boundaries

Use for any multi-page PDF that needs polish: client proposals, briefings, post-mortems (use the dedicated skill), retrospectives, executive summaries, monthly reports.

---

## Inputs

- `--brand <name>` — visual identity. Looks up `./templates/<name>/proposal.html`. If missing, triggers the brand wizard.
- `--title "..."` — document title (cover + filename).
- `--output <path>` — full output path override. Default: `./out/<slug>-<YYYY-MM-DD>.html`.
- `--register-brand <name>` — explicit wizard entry: collect colors/fonts/logo + save the template, then exit (no document generated).

---

## Template Registry

Brand templates live under `./templates/<name>/`. Each contains:

| File | Purpose |
|---|---|
| `proposal.html` | HTML template with `{{PLACEHOLDER}}` slots for content (cover + pages). CSS variables hold the brand colors. |
| `render.sh` | Chrome-headless render script with page-overflow detection. Identical across brands. |
| `branding/` (optional) | Logo PNG/SVG assets referenced by the template. |

**Ships with `./templates/default/`** — neutral charcoal + indigo. Works zero-config so the first run never fails.

---

## Workflow

### Step 0 — Resolve brand

1. If `--brand <name>` is provided, check `./templates/<name>/proposal.html`:
   - **Exists** → use it. Continue to Step 2.
   - **Missing** → ask via `AskUserQuestion`:
     ```
     Question: "Brand '<name>' isn't registered. Set it up now?"
     Header: "Brand wizard"
     Options:
       1. Yes — run the brand wizard
       2. No — use `--brand default` instead (neutral palette)
       3. Cancel
     ```
     If "Yes" → run the **Brand wizard** (Step 1).

2. If `--brand` is omitted, default to `default`.

3. If `--register-brand <name>` is passed, run the wizard for `<name>` and EXIT (no document rendered).

### Step 1 — Brand wizard (collects colors, fonts, logo)

Ask via `AskUserQuestion` — ONE message, multiple questions:

**Colors** (hex, with `#`):
- Primary background color (cover background) — default `#18181B` (near-black)
- Accent color (highlights, links, dividers) — default `#6366F1` (indigo)
- Accent secondary (subtle glow / hover) — default `#818CF8`
- Page background — default `#FFFFFF`

**Fonts** (Google Fonts family name):
- Heading font — default `Inter`
- Body font — default `Inter`

**Logo:**
- Path to PNG/SVG in this project (e.g. `./assets/logo.png`), OR
- Text-only brand name (will render as a styled wordmark), OR
- `none` (no logo, just brand name in plain type)

**Document tone:**
- Footer brand label (appears on every page) — e.g. `"Acme Corp — Confidential"`

Then:
1. `cp -r ./templates/default ./templates/<name>` (or create with the same shape).
2. Substitute placeholders in `./templates/<name>/proposal.html`:
   - `--brand-black`, `--brand-accent`, `--brand-accent-i`, `--brand-accent-ii`, `--brand-bg` CSS variables
   - Google Fonts `<link href>` URL
   - `font-family` in `body { ... }`
   - `{{BRAND_NAME}}`, `{{FOOTER_LABEL}}` literals (cover + page footer)
   - Logo block (if path provided, inject `<img>` tag; if text-only, leave as text wordmark; if `none`, drop)
3. Confirm to the user: `✓ Brand '<name>' registered at ./templates/<name>/`

If invoked as `--register-brand`, exit here.

### Step 2 — Gather document facts

Ask in ONE message (≤6 questions). Skip any the user already provided:

1. **Document title** (cover, filename)
2. **Cover label** — short uppercase tag, e.g. `"Proposal · Q1 2025"`, `"Briefing · Migration Plan"`, `"Report · Performance Audit"`
3. **Subtitle** — 1–2 sentences max
4. **Audience** — who's it for (cover meta)
5. **Date** — usually today
6. **Optional: severity/priority/status badge** — if the document needs a banner (e.g. `DRAFT`, `FINAL`, `P0`)

If the user gave a brief or paste-dump, extract from it — don't re-ask.

### Step 3 — Map content to template

The default template ships with these page components. Use them in the content area of each `<div class="page">`:

| Component | When to use |
|---|---|
| `.metrics` (3–4 cards) | Page 01 — top-line KPIs or numbers |
| `.timeline` (3 colored phases) | Sequence overview (planning → executing → wrap-up) |
| `.phase-card` | Major narrative sections — one per topic |
| `<table>` | Tabular data — comparisons, line items, timelines, follow-ups |
| `.highlight-box` | Callout box for key recommendations or root causes |
| `.check-list` | Lessons learned, action items, deliverables |
| `.badge` (inline) | Status tags inside paragraphs |

Number content pages `NN / TT` and keep `TT` consistent across all pages. Use the page-renumber helper in Step 4.

**Language**: defaults to English. Pass `--lang pt|es|en|...` if needed; the methodology applies to any.

**Tone**: factual, plain. No emojis unless the user requests. No hedging language. Numbers and citations.

### Step 4 — Render and detect overflow (loop until clean)

```bash
bash ./templates/<brand>/render.sh <path-to.html>
```

- Exit 0 → no overflow, done.
- Exit 1 → overflow report; the script prints `OK` vs `SPILL from logical page N` per physical page.

For every overflowing page, split at the nearest natural boundary (preference order):

1. Between two `<table>` elements
2. Between `<h3>` sections
3. Between `<h4>` sub-sections (inside a `.phase-card`)
4. Between `.phase-card` subsections — close the card, open a new page with a continuation card titled `"... (continued)"`
5. Last resort: drop the `<p class="section-intro">` paragraph

**Never edit CSS to shoehorn content. Always split.**

After every restructure, renumber pages:

```bash
python3 -c "
import re, sys
p = sys.argv[1]
html = open(p).read()
total = len(re.findall(r'<div class=\"page\">', html))
idx = [0]
def bump(m):
    idx[0] += 1
    return f'<span class=\"page-number\">{idx[0]:02d} / {total:02d}</span>'
html = re.sub(r'<span class=\"page-number\">[^<]+</span>', bump, html)
open(p, 'w').write(html)
print(f'Renumbered {idx[0]} pages as NN / {total:02d}')
" <path-to.html>
```

Re-run render. Loop until exit 0.

### Step 5 — Open PDF + report

```bash
open <path-to.pdf>     # macOS
xdg-open <path-to.pdf> # Linux
```

Report to the user:
- HTML + PDF paths
- Total pages
- Brand used
- Any content tradeoffs (splits taken, sections dropped, etc.)

---

## Brand Template Anatomy

A brand template is just a parameterized HTML file. Open `./templates/default/proposal.html` to see the canonical shape:

```css
:root {
  --brand-black:      #18181B;  /* cover background */
  --brand-accent:     #6366F1;  /* main accent (links, dividers, hover) */
  --brand-accent-i:   #4F46E5;  /* darker accent variant */
  --brand-accent-ii:  #818CF8;  /* lighter accent variant (glows) */
  --brand-bg:         #FFFFFF;  /* page background */
  --brand-gray-i:     #27272A;  /* primary text */
  --brand-gray-ii:    #3F3F46;  /* secondary text */
  /* ... */
}
```

To create a new brand by hand (without the wizard):

```bash
cp -r ./templates/default ./templates/<your-brand>
# Edit ./templates/<your-brand>/proposal.html — swap the CSS vars above
```

Then `--brand <your-brand>` picks it up.

---

## Example invocations

```bash
# First time — register a brand
/branded-pdf --register-brand acme
# > Wizard runs, asks colors/fonts/logo, writes ./templates/acme/

# Then use it for any document
/branded-pdf --brand acme --title "Q1 2025 Proposal"

# Default brand, no setup needed
/branded-pdf --title "Briefing — Cloud Migration Phase 1"

# Specific output path
/branded-pdf --brand acme --title "Annual Report 2024" --output ./reports/annual-2024.html
```

---

## Gotchas

- **Chrome headless path** on macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. On Linux: `chromium` / `google-chrome` on PATH.
- **pdftotext required** — install via `brew install poppler` (macOS) or `apt-get install poppler-utils` (Linux). Without it, the overflow-detection loop can't count pages.
- **`@page { margin: 0 }`** in templates — do not change. The cover bleeds edge-to-edge.
- **Logo paths in templates are relative** — if you output HTML outside the template directory, copy the `branding/` folder alongside or use absolute paths.
- **Never use the OS PDF generator** (macOS Print to PDF, browser "Save as PDF" UI). Only Chrome headless via `render.sh` gives consistent results.
- **Brand name should be filesystem-safe** — kebab-case, no spaces (e.g. `acme-corp`, not `Acme Corp`).
- **First-run is interactive** — `--register-brand` blocks on `AskUserQuestion`. To set up brands non-interactively, copy `./templates/default/` manually and edit the CSS vars + Google Fonts URL.

---

## Why this skill exists

We were maintaining three branded-PDF skills internally — one per client + one for internal docs — each with the same render-loop, page-numbering helper, and overflow-detect dance. Identical engine, different chrome. This skill is the extracted engine: bring your brand, get a polished PDF, never re-derive the page-overflow logic.

The companion skill `post-mortem` uses the same engine but layers on incident-specific structure (sections + 5-whys + smoking-gun evidence rules + hedge linter). When you need an incident report, use `post-mortem`. When you need anything else (proposal, briefing, executive summary, monthly report, retrospective), use this skill.
