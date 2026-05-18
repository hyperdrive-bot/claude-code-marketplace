# claude-code-marketplace

> **AI dev tools, battle-tested in production.**
> Skills built and used daily by a working team — shared for the rest of the Claude Code community.

This is a [Claude Code plugin marketplace](https://docs.claude.com/claude-code/plugins) maintained by [hyperdrive.bot](https://github.com/hyperdrive-bot). Every skill in here is something the team actually uses — no toy demos, no AI-slop. Showcase repo: no support promised, PRs welcome.

---

## Install

```bash
/plugin marketplace add hyperdrive-bot/claude-code-marketplace
```

Then install whichever plugins you want:

```bash
/plugin install post-mortem@claude-code-marketplace
/plugin install reflect@claude-code-marketplace
/plugin install transcript@claude-code-marketplace
/plugin install watch-jam@claude-code-marketplace
/plugin install paseo-bundle@claude-code-marketplace
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

## What's intentionally NOT here

This marketplace is curated. It does not include:

- **Client-specific tooling** — every skill here is generic and self-contained
- **Hooks** — those live in a future plugin once they're properly portable
- **Rules** — there are great ones in our day-to-day stack, but they're tightly coupled to our codebase. A separate `claude-code-good-practices` plugin may ship later with the generic ones (Lambda async patterns, CFN deletion-policy hygiene, etc.)

If you want to see the "real" super-repo with all the rules, agents, hooks, and the full BMAD-based workflow, it's on GitLab — but it's read-mostly and assumes a specific stack.

---

## Roadmap

- **v0.2** — Hooks plugin: session naming, checkpoint stop-hook, RTK wrapper
- **v0.2** — Rules plugin: generic Lambda / CFN / Git / npm rules from production incidents
- **v0.3** — BMAD-agent bundle: Marra-customized BMAD personas (Pirlo, Lena, Coach, Tiririca, ...)
- **v1.0** — A polished landing page at hyperdrive.bot

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
