# hyperdrive.bot — Claude Code plugins marketplace

> **AI dev tools, battle-tested in production.**
> Skills built and used daily by a working team — shared for the rest of the Claude Code community.

This is a [Claude Code plugin marketplace](https://docs.claude.com/claude-code/plugins) maintained by [hyperdrive.bot](https://github.com/hyperdrive-bot). Every skill in here is something the team actually uses — no toy demos, no AI-slop. Showcase repo: no support promised, PRs welcome.

---

## Install

```bash
/plugin marketplace add hyperdrive-bot/marketplace
```

Then install whichever plugins you want:

```bash
/plugin install post-mortem@hyperdrive-bot
/plugin install reflect@hyperdrive-bot
/plugin install transcript@hyperdrive-bot
/plugin install watch-jam@hyperdrive-bot
/plugin install paseo-bundle@hyperdrive-bot
/plugin install branded-pdf@hyperdrive-bot
/plugin install diagram-design@hyperdrive-bot
/plugin install session-naming@hyperdrive-bot
/plugin install datadog-bundle@hyperdrive-bot
/plugin install resilient-run@hyperdrive-bot
```

---

## The plugins

### 📄 `post-mortem` — incident reports that don't hedge

Generates branded, multi-page post-mortem PDFs from incident facts. The opinionated bit: **smoking-gun rigor**. Every claim in Fault/Detection/Response/Recovery/Root-cause must carry evidence (CloudWatch line + UTC timestamp, commit SHA, support ticket ID, AWS request ID, query result). The 14 banned hedging words (`likely`, `probably`, `may have`, `appears to`, ...) are caught by a linter before render — you can't ship a PDF that says "we believe the deploy may have caused it."

- Five-whys discipline: must end at a **systemic** cause, not a person
- Branded templates registry: `./templates/<your-brand>/proposal.html` — copy and customize
- Chrome-headless render loop with page-overflow detection (splits at natural boundaries; never edits CSS to shoehorn content)
- Ships with a neutral default template (charcoal + indigo); BYO brand to taste

**Usage:** `/post-mortem --branding <name> --title "Auth Outage 2025-01-15"`

---

### 🪞 `reflect` — promote session patterns into durable rules

A reflective learning loop. Analyzes accumulated MEMORY.md, checkpoint logs, and the last 5 session transcripts for recurring corrections and confirmations. Identifies promotable patterns (≥2 sessions, actionable, not already covered), drafts the exact file content for `.claude/rules/<topic>.md` or global CLAUDE.md additions, and returns numbered proposals you can approve all/some/none.

- Runs in a forked context — your main conversation stays clean
- Emotional redaction: strips profanity/frustration, keeps the technical signal
- Logs every promotion to `rule-promotions.md` so the next reflect doesn't re-propose
- Resets the session counter after approved promotions

**Usage:** `/reflect` (or `/reflect --dry-run`)

---

### 🎙️ `transcript` — Whisper transcription for voice notes

Transcribes any audio file via OpenAI's Whisper API. Handles WhatsApp `.opus` voice notes by auto-converting to `.mp3` first (Whisper doesn't accept opus directly). Optional summary mode for long recordings.

- Supports mp3, wav, m4a, ogg, opus, webm, flac, mp4
- Language hint via `--lang pt|en|es|...` (ISO 639-1)
- Auto-summary when transcription exceeds 500 words
- Offers to save as `<filename>.transcript.md` alongside the source

**Requires:** `OPENAI_API_KEY` env var, `ffmpeg` on PATH (for opus conversion).

**Usage:** `/transcript path/to/voicenote.opus --lang pt --summary`

---

### 📼 `watch-jam` — Jam.dev recording analysis with vision

Pastes a `jam.dev/c/<uuid>` URL → downloads the raw WebM via anonymous GraphQL → extracts evenly-spaced key frames with ffmpeg → Claude reads them with vision and tells you what the user actually did. Pairs beautifully with the Jam MCP server for full debug context (frames answer "what did the user see"; MCP answers "what did the browser do").

- Detail levels: `quick` (3 frames), `standard` (6), `thorough` (12), `many` (24), or any integer
- Frames spread 5%→95% of duration (avoids recorder chrome at start/end)
- Cached per-UUID under `$TMPDIR/watch-jam/` — re-runs only re-extract frames
- No auth required (anonymous share-URL access)

**Requires:** `ffmpeg`, `node` on PATH.

**Usage:** `/watch-jam https://jam.dev/c/abc123... thorough`

---

### 🎯 `paseo-bundle` — multi-agent orchestration patterns

Six skills that lean on the [Paseo](https://paseo.dev) daemon for managing background coding agents across providers (Claude Opus, GPT-5.4, etc.) and isolated git worktrees.

| Skill | When to use |
|---|---|
| `paseo` | Reference — load whenever you create agents or manage worktrees |
| `paseo-epic` | Heavy-ceremony orchestration: research → plan → adversarial review → phased implementation → audit → delivery. For all-night work. |
| `paseo-committee` | Stuck or looping? Two contrasting agents do parallel root-cause analysis, then you implement |
| `paseo-advisor` | Second opinion on the current task — single agent, no editing |
| `paseo-loop` | Worker/verifier cycle that runs until an exit condition is met (drive PR to green, drive tests to green, babysit a long process) |
| `paseo-handoff` | Transfer the current task to a fresh agent with full context (zero-context briefing) |

**Requires:** [Paseo](https://paseo.dev) installed locally (the daemon manages agent lifecycle).

**Usage:** `/paseo-epic --autopilot "implement the new auth flow end to end"`, `/paseo-committee "why is this test flaky"`, etc.

---

### 📑 `branded-pdf` — any branded multi-page PDF

Same render-and-overflow engine as `post-mortem`, but for any document (proposals, briefings, executive summaries, monthly reports, retrospectives). First-run wizard collects colors, fonts, and logo via `AskUserQuestion`, generates a brand template under `./templates/<name>/`, and reuses it across all future documents.

- Brand registry: `./templates/<name>/proposal.html` + `render.sh` — copy + edit CSS vars to add brands manually
- Ships with a neutral default (charcoal + indigo) for zero-config first use
- Section components: `.metrics`, `.timeline`, `.phase-card`, `.highlight-box`, `.check-list`, tables, badges
- Chrome-headless render loop with page-overflow detection — splits at natural boundaries, never edits CSS to shoehorn

**Usage:** `/branded-pdf --brand acme --title "Q1 2025 Proposal"` — or `--register-brand <name>` to run the wizard standalone.

---

### 📐 `diagram-design` — 13 diagram types, editorial design system

Generate technical and product diagrams as standalone HTML files with inline SVG. Types: architecture, flowchart, sequence, state machine, ER / data model, timeline, swimlane, quadrant, nested, tree, layer stack, venn, pyramid. Neutral editorial skin out of the box; first-run gate that prompts to customize the style guide from your brand site.

- Annotation-callout primitive for inline notes
- Optional sketchy variant (loose hand-drawn style)
- Complexity budget: target density 4/10 — earn every node, every connection
- Type-specific conventions live in `references/type-<name>.md` and load only when relevant

**Usage:** describe the system you want diagrammed; the skill picks the right type and emits a self-contained HTML file.

---

### 🪧 `session-naming` (hooks) — auto-rename Claude Code sessions

Five hooks that name your sessions automatically based on conversation topic, prefix `done-` when you say bye, and nudge `/reflect` every 10 sessions:

| Hook | Event | What it does |
|---|---|---|
| `session-id-inject` | SessionStart | Injects session ID + auto-rename directive into Claude's context |
| `session-counter` | SessionStart | Increments session counter; emits a reflect nudge when threshold hit |
| `session-auto-rename` | UserPromptSubmit | After 3 unnamed exchanges, forces Claude to rename NOW |
| `session-exit-rename` | UserPromptSubmit | Detects exit keywords (bye, tchau, done, exit, ...) and tells Claude to prefix `done-` |
| `session-done-on-end` | SessionEnd | Final prefix-`done-` pass on natural session end |

Plus a `session-rename.sh` utility that updates the JSONL `custom-title` record and the sessions-index so `/resume` picks up the new name.

**Usage:** install + use. The hooks run themselves. Pair with `reflect` for the full effect (reflect nudge → /reflect → durable rules).

---

### 📊 `datadog-bundle` — Datadog RUM observability (9 skills)

A complete browser-vision + REST stack for any Datadog RUM org. No hardcoded org refs — resolves credentials via `DD_API_KEY`/`DD_APP_KEY` env vars (preferred) or a 1Password item named via `DD_OP_ITEM` (default `"Datadog"`). Non-US sites configurable via `DD_SITE_BASE`.

| Skill | What it does |
|---|---|
| `datadog-login` | Playwright login + storageState cache (~weeks) |
| `datadog-sessions` | RUM session search via REST — filter tenant/user/time/DQL |
| `datadog-errors` | RUM error search, grouped by top messages |
| `datadog-performance` | Analytics aggregate (slow views, FCP, LCP, CLS) |
| `datadog-failing-resources` | 4xx/5xx breakdown per app/tenant/path |
| `datadog-watch` | Frame capture from a specific session replay |
| `datadog-create-app` | Provision a new RUM application + register an alias |
| `datadog-add` | Wire `@datadog/browser-rum` into a Next.js / Vite / CRA frontend — detect framework, scaffold init code, set env keys, optionally call `create-app` |
| `datadog` | Top-level browse skill — Playwright over Session Explorer / Error Tracking / Replays |

App aliases registered with `/datadog-create-app` are stored at `~/.local/share/datadog-skill/apps.json` and accepted as `--app <alias>` in every skill. Pass a raw UUID to skip the registry.

**Requires:** `node`, `playwright` (installed via the plugin's `npm install`), `op` CLI if using 1Password fallback.

**Usage:** `/datadog-login` → `/datadog-create-app <name>` → then `/datadog-sessions --app <name> --tenant <id> --last 1h`, etc.

---

### ♻️ `resilient-run` — context-compaction-resilient runs

A checkpoint-and-resume protocol for long-running agent sessions. Writes a centralized progress file as the single source of truth. When Claude Code compacts your conversation, the protocol restores from the file — work picks up exactly where it left off.

- Three modes: `init` (new run from a goal), `resume` (continue from progress file), `discovery` (find existing runs)
- Single-source-of-truth progress file at `docs/resilient-run/<slug>/PROGRESS.md`
- Frequent writes — every meaningful step
- Slug auto-generated from the goal

**Usage:** `/resilient-run "Build the new auth flow end to end"` or `/resilient-run resume` to find and resume.

---

## What's intentionally NOT here

This marketplace is curated. It does not include:

- **Client-specific tooling** — every skill here is generic and self-contained
- **Hooks** — those live in a future plugin once they're properly portable
- **Rules** — there are great ones in our day-to-day stack, but they're tightly coupled to our codebase. A separate `claude-code-good-practices` plugin may ship later with the generic ones (Lambda async patterns, CFN deletion-policy hygiene, etc.)

If you want to see the "real" super-repo with all the rules, agents, hooks, and the full BMAD-based workflow, it's on GitLab — but it's read-mostly and assumes a specific stack.

---

## Roadmap

- **v0.1** ✅ — `post-mortem`, `reflect`, `transcript`, `watch-jam`, `paseo-bundle`
- **v0.2** ✅ — `branded-pdf` (PDF engine wizard), `diagram-design` (13 diagram types), `session-naming` (hooks)
- **v0.3** ✅ — `datadog-bundle` (8 skills for RUM observability), `resilient-run` (checkpoint-and-resume protocol)
- **v0.4** — Rules plugin: generic Lambda / CFN / Git / npm rules from production incidents
- **v1.0** — Polished landing page at hyperdrive.bot

---

## Contributing

PRs welcome but go in with low expectations:

- This is a showcase, not a community-maintained suite
- Bug reports and clean fixes — likely yes
- Big new features — probably better as your own marketplace
- Style/cosmetic changes — generally no

**Skills, hooks, and rules added here must be:**
1. **Generic** — works in any codebase, not tied to one company's stack
2. **Self-contained** — no internal dependencies, no private CLI requirements
3. **Battle-tested** — used in real work, not "looked cool in a demo"

---

## License

[MIT](./LICENSE)

---

Built and maintained by the team at [DevSquad](https://devsquad.email). The opinions encoded in these skills (smoking-gun post-mortems, refactor-first orchestration, ban hedging in incident reports, no waitForTimeout in tests) come from real production scars. We figured shipping the tools was less work than re-deriving them.
