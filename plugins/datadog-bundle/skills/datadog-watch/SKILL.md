---
name: datadog-watch
description: "Open a specific Datadog RUM session replay and capture N frames as screenshots. Use when the user pastes a session ID or says 'watch session X', 'replay session abc123', 'show me what the user did'. Usage: /datadog-watch <session-id> [--frames 6]"
user-invocable: true
allowed-tools: Bash, Read
argument-hint: "<session-id> [--frames 3|6|12|24]"
---

# /datadog-watch — Session Replay (Frames)

Loads the Datadog session replay page for a specific session, hits Play, and captures N frames as PNG screenshots so you can inspect the UX visually.

## What to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/watch.mjs" $ARGUMENTS
```

The first positional arg is the session ID (full UUID from the Session Explorer).

## Flags

- `--frames 6` (default) — number of frames spread across playback. Use `3` for quick check, `12-24` for dense recordings.
- `--headed` — show browser

## Common patterns

| User says | Args |
|---|---|
| "watch session abc-123-def" | `abc-123-def` |
| "show me 12 frames of session X" | `X --frames 12` |

## After it returns

Read each frame path with the Read tool — they're full screenshots so the visual state at each timestamp is inspectable. The JSON also includes a `events_sample` (first 10 user actions/views) extracted from the timeline panel.

## Limitations

- Native MP4 export is **not** automated. The Datadog UI has an Export → Video button but the flow varies by replay length and account tier.
- Replay availability depends on Datadog retention (default 30 days for replays vs 15 days for events).
- Requires the Playwright session from `/datadog-login`.
