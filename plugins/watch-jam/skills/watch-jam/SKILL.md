---
name: watch-jam
description: Watch a jam.dev bug recording by downloading the raw video and extracting key frames for visual analysis. Usage — /watch-jam <jam-url-or-uuid> [quick|standard|thorough|many|<n>]. Trigger when the user pastes a jam.dev link or asks you to "watch", "analyze", or "look at" a Jam recording.
---

# watch-jam

Fetches a jam.dev recording via its anonymous GraphQL endpoint, downloads the raw WebM source, and extracts evenly-spaced key frames so you can see the UI with your vision capabilities.

## Usage

`/watch-jam <jam-url-or-uuid> [detail-level]`

- `<jam-url-or-uuid>` — either a full `https://jam.dev/c/<uuid>` URL or the bare UUID
- `[detail-level]` — optional, controls how many frames to extract:

| Level | Frames | When to use |
|---|---|---|
| `quick` | 3 | Sanity-check the recording covers what the user described |
| `standard` (default) | 6 | General debugging — enough to trace the main flow |
| `thorough` | 12 | Complex multi-step flows, multiple state changes |
| `many` | 24 | Dense recordings, many UI changes per second |
| `<n>` (any integer) | N | Custom count |

Frames are spread from 5% to 95% of the video duration (avoiding the recorder's start/stop chrome).

## How to run

1. Execute the script:
   ```bash
   bash ~/.claude/skills/watch-jam/watch-jam.sh "$ARGS"
   ```
   (`$ARGS` = whatever the user passed after `/watch-jam`.)

2. The script prints:
   - A JSON summary (author, title, duration, tenant URL, browser, OS, video URL)
   - Paths to the extracted PNG frames under `$TMPDIR/watch-jam/<uuid>/frames/`
   - Path to the downloaded video (cached — re-runs don't re-download)

3. **Read every frame PNG** using the Read tool — that loads the pixels into your vision context so you can actually see the UI.

4. After reading, narrate what you observed per frame in chronological order. Quote on-screen text verbatim. Cross-reference with the summary JSON (originalUrl, author) to anchor the bug in its tenant/user context.

## Output format for the user

```
📼 Jam by <author> · <duration> · <originalUrl>

Frame 1 (t=00:03) — <what you see, verbatim on-screen text>
Frame 2 (t=00:13) — ...
...

## Observations
- <user-goal-level summary of the flow>
- <any bug symptoms visible across frames — counter mismatches, error states, stale UI, etc.>
```

If the user didn't ask for a specific angle, lead with what's visually interesting or anomalous (stale counters, error toasts, empty states, mismatches between tabs).

## Notes / gotchas

- **No auth needed** — the share URL's anonymous GraphQL access is sufficient. Never prompt the user for a PAT or login.
- **Rate**: The raw WebM is usually 5–50MB. On slow links, warn the user if a download takes more than ~15s.
- **Cache**: Video and metadata are cached per-UUID under `$TMPDIR/watch-jam/<uuid>/`. Re-running with a different `<n>` only re-extracts frames.
- **Non-VideoJam types**: If the jam is a `ScreenshotJam` or `ReplayJam`, the script exits with "no video URL". For those, suggest the user use the Jam MCP `getScreenshots` tool instead (if available).
- **Complement with Jam MCP**: If the `mcp__jam__*` tools are connected, pair this skill with `getDetails`/`getConsoleLogs`/`getNetworkRequests` for a full debug picture — video frames answer "what did the user see", MCP tools answer "what did the browser do".
