---
name: post-mortem
description: Create a branded post-mortem PDF deliverable for an incident. Asks for branding before doing anything. Maps incident facts onto the canonical post-mortem template sections (Leadup → Fault → Impact → Detection → Response → Recovery → Timeline → 5-Whys → Root cause → Backlog → Related → Lessons → Follow-up), then renders + iteratively splits pages until no overflow remains. Enforces smoking-gun rigor — every claim in Fault/Detection/Response/Recovery/Root-cause MUST have evidence (log line + UTC timestamp, commit SHA, support ticket ID, AWS request ID, query result). Banned hedging words ("likely", "probably", "may have", "appears to", "seems to", "could be", "potentially", "we believe"). Use when the user says "post mortem", "postmortem", "incident report", "RCA", "5-whys", or wants a branded incident deliverable.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash, Glob, AskUserQuestion
argument-hint: "[--branding <name>] [--title '...'] [--output <path>]"
---

# Post-Mortem PDF Generator

Creates a branded multi-page post-mortem PDF for any incident. Renders via headless Chrome with a page-overflow detection loop, and adds:

- **Branding choice** (asked first, never assumed) — pick from registered brand templates
- **Section mapping** for the 13 standard post-mortem fields (Cover → Executive summary → Affected → Leadup → Fault → Impact → Detection → Response → Recovery → Timeline → 5-Whys → Root cause → Backlog → Related → Lessons → Follow-up)
- **Smoking-gun enforcement** — every claim about cause/impact/detection MUST carry evidence; hedging language is rejected at draft time

Use for any incident that needs a shareable artifact: customer-facing RCA, internal blameless review, regulator request, audit trail, board reporting.

---

## Inputs

- `--branding <name>` — visual identity. Looks up `./templates/<name>/proposal.html`. **If omitted, the skill ASKS** before doing anything else. Never assume.
- `--title "..."` — incident title (cover + filename). E.g. `"Cloud Database Outage — 2025-01-15"`.
- `--output <path>` — full output path override. Default: `./postmortems/<slug>-<YYYY-MM-DD>.html`.

---

## Template Registry

Branding templates live under `./templates/<name>/`. Each branding directory must contain:

| File | Purpose |
|---|---|
| `proposal.html` | The HTML template with `{{PLACEHOLDER}}` slots for cover + content sections |
| `render.sh` | Shared render-and-overflow-detect script (copied from `./templates/default/render.sh`) |
| `branding/` (optional) | Logo PNG/SVG assets if the template references them relatively |

**Ships with**: `./templates/default/` — a neutral navy/charcoal palette suitable for any team. Copy it and customize colors/logo to register your own brand.

**To add a new brand template**:

```bash
cp -r ./templates/default ./templates/<your-brand>
# Edit ./templates/<your-brand>/proposal.html — swap logo SVG, palette CSS vars
```

---

## Workflow

### Step 0 — Pick branding (ASK, do not assume)

If `--branding` was not passed, ask via `AskUserQuestion`:

```
Question: "Which branding for this post-mortem?"
Header: "Branding"
Options: [scan ./templates/ subdirectories — present each as an option]
```

If no `./templates/` directory exists yet, **stop** and tell the user: "No branding templates registered. Run `cp -r <plugin>/templates/default ./templates/default` to start, or create your own." Do NOT silently fall back.

### Step 1 — Gather incident facts

Ask in ONE message — keep tight, ≤6 questions. Skip any that the user already wrote.

**Identity**
1. Incident title (e.g. "Auth Service Outage — 2025-01-15")
2. Severity / Priority (P0 / P1 / P2 / P3 — pick the team's convention)
3. Owner (who's writing this — appears in cover meta)
4. Affected services (comma list — e.g. "auth.example.com, customers/api, ECS service `auth-api`")
5. Window (start UTC → end UTC; or "ongoing")

**Impact**
6. Quantified impact — choose at least one: # of users affected, # of failed requests, $ revenue at risk, # of support tickets, # of contracts in flight. **Numbers, not adjectives.**

If the user provides a brief or paste-dump (chat log, Slack thread, Jira ticket) — extract from it; do not re-ask.

### Step 2 — Map facts to template sections + enforce rigor

#### 2a. Section structure (in this order)

| # | Section | What goes here | Page hint |
|---|---|---|---|
| 1 | **Cover** | Severity badge + title + 3 meta (Date, Severity, Owner) | Cover only |
| 2 | **Executive summary** | 3–4 sentence TL;DR — what broke, blast radius, root cause, status | Page 01 |
| 3 | **Affected services + Priority** | Bulleted services + `.metrics` block (impact KPIs) | Page 01 |
| 4 | **Leadup** | Sequence of events that led to the incident — preceding deploys, config changes, traffic patterns | Page 02 |
| 5 | **Fault** | What broke and why the change didn't work as expected | Page 02 or 03 |
| 6 | **Impact** | Internal + external user impact, support cases, revenue, SLA | Page 03 |
| 7 | **Detection** | When the team saw it, how (alarm? customer ticket? someone noticed?), TTD gap analysis | Page 04 |
| 8 | **Response** | Who responded at what UTC times, decisions, escalation, delays/obstacles | Page 04 |
| 9 | **Recovery** | How user impact was mitigated, when resolved, TTM gap analysis | Page 05 |
| 10 | **Timeline** | UTC table: timestamp / event / actor / source-of-truth | Page 06 (table can span if needed) |
| 11 | **Five whys** | Numbered 1→5 chain ending at the systemic cause | Page 07 |
| 12 | **Blameless root cause** | One paragraph naming the systemic flaw + what changes | Page 07 |
| 13 | **Backlog check** | Was this in the backlog and de-prioritized? Cite Jira IDs | Page 08 |
| 14 | **Related incidents** | Same root cause before? Cite past post-mortem links | Page 08 |
| 15 | **Lessons learned** | What went well, what we improved | Page 09 |
| 16 | **Follow-up tasks** | Table — Jira key, owner, due date, link | Page 09 (last) |

Aim for ~9 numbered pages + 1 cover. Real incidents will land between 7 and 12.

#### 2b. Smoking-gun rigor (BLOCKING — do not skip)

For every claim in **Fault, Detection, Response, Recovery, Five Whys, and Blameless Root Cause**, you MUST attach evidence inline. Acceptable evidence:

| Type | Example citation |
|---|---|
| CloudWatch log line | `CloudWatch /aws/lambda/auth-api · 14:22:07 UTC · "OperationCanceledException: ..."` |
| Application log | `app.log line 4912 — "TypeError: Cannot read property 'userId' of undefined"` |
| Commit / MR | `commit a1b2c3d on master · "feat(AUTH-145): add userId arg"` or `MR !366` |
| AWS request ID | `requestId 6f9b1c... · DDB UpdateItem · ConditionalCheckFailedException` |
| Support ticket | `Zendesk #4412 — Customer X · 2025-01-15 09:14 UTC` |
| Query result | `aws dynamodb query → 0 items returned for pk=USER#xyz` |
| Screenshot | `screenshot-cf-403-error.png — captured 2025-01-15 14:55 UTC` |
| Observability session | `session 8a3c1f... · view /api/orders/list · status_code=500` |
| Pipeline | `gitlab pipeline #88421 — job validate-stage-name · exit 1` |
| Vendor confirmation | `Provider support case 5-1234567890 · "internal escalation under review"` |

If evidence is **not yet available**, write the placeholder `EVIDENCE PENDING — <what's needed and where to find it>` instead of hedging. Never write a soft claim.

#### 2c. Banned hedging words (LINTER — block before render)

Reject the draft if any of these appear in body content (titles/quotes are fine):

```
likely, probably, may have, appears to, seems to, could be,
potentially, presumably, perhaps, suspected, we believe,
might have, possibly, plausibly
```

Replace each instance with a definite statement plus evidence, OR convert to `EVIDENCE PENDING — ...` if the team doesn't actually know. Run this one-liner against the HTML before render:

```bash
python3 -c "
import re, sys, pathlib
banned = ['likely','probably','may have','appears to','seems to','could be','potentially','presumably','perhaps','suspected','we believe','might have','possibly','plausibly']
html = pathlib.Path(sys.argv[1]).read_text()
text = re.sub(r'<[^>]+>', ' ', html)
text = re.sub(r'<!--.*?-->', ' ', text, flags=re.DOTALL)
hits = [w for w in banned if re.search(r'\b'+w+r'\b', text, re.IGNORECASE)]
if hits:
    print('HEDGE LINT FAIL — found:', hits)
    sys.exit(1)
print('HEDGE LINT OK')
" <path-to.html>
```

If the linter exits 1, **stop and surface the offending words to the user** before rendering. The user may downgrade with explicit consent (e.g. preliminary draft for legal review where evidence is still being gathered) — in that case add an inline `<div class="banner banner-warning">DRAFT — evidence pending</div>` on the cover page.

#### 2d. Five whys discipline

The `Five Whys` section is the heart of the document. Enforce:

- Numbered exactly 1 → 5 (not "Why? Why? Why?" prose)
- Each `Why N` MUST cite evidence for the answer (same rules as 2b)
- `Why 5` MUST land on a **systemic** cause (process gap, missing alarm, training gap, architectural shortcoming, vendor SLA), NOT a person ("X deployed without checking" is wrong; "the deploy gate didn't require a CHANGES file with a blast-radius section" is right)
- If `Why 5` ends with a person, you have not gone deep enough — push to `Why 6+` or restart from `Why 1` with a different framing

#### 2e. Timeline discipline

- All timestamps in **UTC** (`HH:MM UTC`). Show local-time conversion only when essential (e.g. customer-facing window).
- Each row MUST cite source-of-truth (CloudWatch log, Slack message ID, Jira comment, support ticket, observability event)
- Include the full window: from the FIRST anomalous signal (even if undetected) to incident-declared-resolved

### Step 3 — Copy template and fill content

1. Copy `./templates/<branding>/proposal.html` to the target path (default `./postmortems/<slug>-<date>.html`).
2. Replace cover `{{...}}` placeholders. Each branding template documents its own placeholder set — common ones:
   - `{{DOC_TITLE}}` — `<title>` tag
   - `{{COVER_LABEL}}` — e.g. `"Post Mortem · Infrastructure"` or `"Post Mortem · Security"`
   - `{{COVER_TITLE_HTML}}` — main title (may include `<span>` accent class)
   - `{{COVER_SUBTITLE}}` — 1–2 sentences max
   - `{{COVER_META_LABEL_N}}` / `{{COVER_META_VALUE_N}}` — `Date`/`<UTC date>`, `Severity`/`P0`, `Owner`/`<name>`
   - `{{FOOTER_LABEL}}` — short tag e.g. `"Post Mortem · 2025-01-15"`
3. Add a severity cover badge between logo and label:
   - P0 — `<span class="cover-badge is-critical">P0 · Outage</span>`
   - P1 — `<span class="cover-badge is-warning">P1 · Degradation</span>`
   - P2 — `<span class="cover-badge">P2 · Bug</span>`
   - P3 — `<span class="cover-badge is-success">P3 · Resolved</span>`

**Content components** (same across well-formed templates):
- `.metrics` — 3–4 cards on Page 01 with impact KPIs (users affected, requests failed, $ at risk, support tickets)
- `.timeline` — 3 colored phases on Page 04 (Detect / Mitigate / Resolve) with timestamps
- `.phase-card` — one per major section (Leadup, Fault, Impact, Detection, Response, Recovery, etc.)
- `table` — Timeline (UTC), Follow-up tasks (Jira), Related incidents
- `.highlight-box` — Blameless root cause (single paragraph callout)
- `.check-list` — Lessons learned, follow-up summary
- `.badge` — inline severity/status tags

Number pages `NN / TT` and keep `TT` consistent across all `.page` divs (renumber at the end with the helper below).

**Language**: defaults to English. Pass the language hint inline if needed for the brand template — the methodology rules (hedging, evidence) apply in any language.

**Tone**: factual, blameless, business-impact first. No emojis. No theatrics. No "we believe". Numbers and citations.

### Step 4 — Render and detect overflow (loop until clean)

```bash
bash ./templates/<branding>/render.sh <path-to.html>
```

- Exit 0 → no overflow, done.
- Exit 1 → overflow report; read `OK` vs `SPILL from logical page N` lines.

For every overflowing page, split at the nearest natural boundary (preference order):

1. Between two `<table>` elements
2. Between `<h3>` sections
3. Between `<h4>` sub-sections (inside a `.phase-card`)
4. Between `.phase-card` subsections — close the card, open a new page with a continuation card titled `"... (continued)"`
5. Last resort: drop the `<p class="section-intro">` paragraph (the timeline/h2 carries the meaning)

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

### Step 5 — Run hedge linter (final gate before release)

Execute the hedge linter from Step 2c against the final HTML. If any hedging word survived the draft pass, fix and re-render. Do not hand the user a PDF that still says "likely" or "appears to".

### Step 6 — Open the PDF + report

```bash
open <path-to.pdf>     # macOS
xdg-open <path-to.pdf> # Linux
```

Report to the user:
- Path of HTML and PDF
- Total pages
- Severity badge applied
- Number of `EVIDENCE PENDING` placeholders still in the document (if >0, list each section)
- Any content tradeoffs (e.g. "moved related-incidents table to page 09 to fit follow-up table on page 08")

---

## Smoking-Gun Examples (style reference)

These are hypothetical examples illustrating the methodology — not real incidents.

### ❌ Wrong — hedging, no evidence

> Detection was likely delayed because the alarm probably wasn't paging the right team. The fault appears to have been introduced by a recent deploy that may have broken the connection pool.

### ✅ Right — definite, cited

> Detection: First customer impact at `14:07 UTC` (observability session `8a3c1f...`, view `/api/orders/list`, status 500). PagerDuty did not page until `14:22 UTC` — a 15-min gap. Root cause of the alarm gap: the CloudWatch alarm `api-orders-5xx-rate` was scoped to the `live` stage but the breaking deploy went to `staging` first and bled traffic via the misconfigured CDN distribution (commit `a1b2c3d`, MR !271).

### ❌ Wrong — Five Whys ending on a person

> 1. Why? Engineer deployed broken code.
> 2. Why? They didn't run tests.
> 3. Why? They were in a hurry.
> 4. Why? The release pressure was high.
> 5. Why? They decided to ship anyway.

### ✅ Right — Five Whys ending on a system gap

> 1. Why? The orders list endpoint returned 500. **Evidence**: CloudWatch `/aws/lambda/api-orders · 14:22:07 UTC · AccessDeniedException`.
> 2. Why? The Lambda role lacked `dynamodb:BatchGetItem` on `orders-index-table`. **Evidence**: `aws iam get-role-policy` showed only `GetItem`/`Query`.
> 3. Why? The orders module's IAM statements were written before the index lookup switched to `BatchGetItemCommand`. **Evidence**: commit `e3a4b56` introduced `BatchGetItemCommand`; the IAM file was last modified 4 months earlier.
> 4. Why? No CI check enforces that modules declare the full IAM action set for their data dependencies. **Evidence**: `.gitlab-ci.yml` has no IAM-policy-coverage gate.
> 5. Why? The team treated cross-module IAM as a per-module concern, with no shared linter or rule. **Evidence**: an IAM-coverage rule was added AFTER this incident as the systemic mitigation.

---

## Gotchas

- **Chrome headless path** on macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (default in `render.sh`). On Linux: `chromium` / `google-chrome` on PATH.
- **pdftotext** required (`brew install poppler` on macOS, `apt-get install poppler-utils` on Linux).
- **`@page { margin: 0 }`** in templates — do not change; the cover bleeds edge-to-edge.
- **Logo paths** in branding templates may be relative (`branding/logo-header.png`). If you output HTML outside the template directory, copy or symlink the `branding/` folder alongside the output.
- **Never use the OS PDF generator** (macOS Print to PDF) — only Chrome headless gives consistent results with this CSS.
- **Don't promise mitigations the team hasn't committed to.** If the user wants to publish before action items are agreed, mark `Follow-up tasks` table rows as `PROPOSED` (not `OWNED`) until a Jira ticket exists.

---

## Why this skill exists

Post-mortems fail when they hedge. "Likely caused by the deploy" is not a finding — it's a guess. The smoking-gun rule (banned hedging words + mandatory evidence citations + 5-whys ending on a systemic cause) forces the document to do its job: explain what happened with enough specificity that the next team can prevent the recurrence.

The render-and-overflow-detect loop exists because PDFs that overflow into ghost pages are unprofessional and the CSS print-mode is brittle. The script catches it before the PDF reaches the customer.
