---
name: transcript
description: Transcribe audio files (WhatsApp voice notes, mp3, wav, m4a, ogg, opus) to text using OpenAI Whisper API
user-invocable: true
allowed-tools: Read, Bash, Write, Edit
argument-hint: "<audio-file-path> [--lang pt|en|es] [--summary]"
---

# Audio Transcription Skill

Transcribe audio files to text using the OpenAI Whisper API. Handles WhatsApp voice notes (.opus, .ogg), mp3, wav, m4a, and other common formats.

## Arguments

- `$ARGUMENTS[0]` — Path to the audio file (required)
- `--lang <code>` — Language hint (default: `pt` for Portuguese). Use ISO 639-1 codes.
- `--summary` — Also produce a concise bullet-point summary after transcription.

## Instructions

### Step 1: Validate Input

1. Check that the audio file exists at the given path. If relative, resolve from the current working directory.
2. Check the file extension. Supported: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.opus`, `.webm`, `.flac`, `.mp4`.
3. If the file is `.opus` or `.ogg`, convert to `.mp3` first using ffmpeg (Whisper API doesn't accept opus directly):
   ```bash
   ffmpeg -i input.opus -y /tmp/transcript-input.mp3
   ```

### Step 2: Transcribe with Whisper API

Use the OpenAI Whisper API via curl. The `OPENAI_API_KEY` environment variable must be set (typically in `~/.zshrc`).

```bash
export OPENAI_API_KEY=$(grep OPENAI_API_KEY ~/.zshrc | sed 's/export OPENAI_API_KEY=//' | tr -d '"' | tr -d "'")

curl -s https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F file="@<file_path>" \
  -F model="whisper-1" \
  -F language="<lang>" \
  -F response_format="verbose_json"
```

- Use the converted `.mp3` path if conversion was needed, otherwise use the original file.
- Parse the JSON response to extract the transcription text.
- If the API returns an error about file format, try converting to mp3 first.
- If the API returns an error about API key, instruct the user to set `OPENAI_API_KEY`.

### Step 3: Output the Transcription

1. Display the full transcription text to the user.
2. If `--summary` was passed, add a concise bullet-point summary below the transcription.
3. If the transcription is long (>500 words), automatically include a summary even without the flag.

### Step 4: Save Output (Optional)

If the user's file is at `path/to/audio.opus`, offer to save the transcription to `path/to/audio.transcript.md` with this format:

```markdown
# Transcription — <filename>

**Date:** <today>
**Duration:** <from API response if available>
**Language:** <lang>

## Full Text

<transcription text>

## Summary

<bullet points if applicable>
```

Only save if the user confirms or if the transcription is particularly long/important.

### Error Handling

- **No OPENAI_API_KEY**: Tell the user to run `export OPENAI_API_KEY=sk-...` or add it to `~/.zshrc`.
- **ffmpeg not installed**: Tell the user to install via `brew install ffmpeg`.
- **File too large (>25MB)**: Whisper API has a 25MB limit. Tell the user and suggest compressing: `ffmpeg -i input.mp3 -b:a 64k /tmp/compressed.mp3`.
- **Unsupported format**: Convert to mp3 via ffmpeg as fallback.

### Cleanup

Remove any temporary files created during conversion (`/tmp/transcript-input.mp3`).
