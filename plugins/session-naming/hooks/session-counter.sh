#!/usr/bin/env bash
# session-counter.sh — Counts sessions and nudges reflection every N sessions (ADR-7)
#
# Triggered by: SessionStart
# When count >= N (default 10), injects additionalContext suggesting /reflect
# Counter resets when /reflect is run (reflect skill touches the counter file)

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# State file lives inside the plugin so each install has its own counter
COUNTER_FILE="${HOOK_DIR}/.session-count"
REFLECT_THRESHOLD="${REFLECT_THRESHOLD:-10}"

# Read current count
CURRENT_COUNT=0
if [ -f "$COUNTER_FILE" ]; then
  CURRENT_COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
  # Sanitize — must be a number
  if ! [[ "$CURRENT_COUNT" =~ ^[0-9]+$ ]]; then
    CURRENT_COUNT=0
  fi
fi

# Increment
NEW_COUNT=$((CURRENT_COUNT + 1))
echo "$NEW_COUNT" > "$COUNTER_FILE"

# Check if we should nudge
if [ "$NEW_COUNT" -ge "$REFLECT_THRESHOLD" ]; then
  # Plain text stdout is added as context for SessionStart hooks
  echo "SESSION MEMORY REFLECTION AVAILABLE: You have completed ${NEW_COUNT} sessions since your last reflection. Consider suggesting the user run /reflect to analyze accumulated learnings and promote patterns to durable rules. Don't be pushy — mention it naturally if there's a pause, or at the end of the current task."
fi

exit 0
