#!/usr/bin/env bash
# session-done-on-end.sh — SessionEnd hook
#
# When a session ends (Ctrl-C, /exit, or natural end), prefix the
# session name with "done-" if it has a name and isn't already prefixed.

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")
CWD=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null || echo "")

if [ "$SESSION_ID" = "unknown" ] || [ -z "$CWD" ]; then
  exit 0
fi

PROJECT_DIR=$(echo "$CWD" | sed 's|/|-|g')
JSONL_FILE="$HOME/.claude/projects/${PROJECT_DIR}/${SESSION_ID}.jsonl"

if [ ! -f "$JSONL_FILE" ]; then
  exit 0
fi

# Get current name
CURRENT_NAME=$(head -5 "$JSONL_FILE" | python3 -c "
import json, sys
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        if d.get('type') == 'custom-title':
            print(d.get('customTitle', ''))
            break
    except:
        continue
" 2>/dev/null || echo "")

# Skip if unnamed or already done-
if [ -z "$CURRENT_NAME" ]; then
  exit 0
fi
if echo "$CURRENT_NAME" | grep -q "^done-"; then
  exit 0
fi

# Prefix with done-
${HOOK_DIR}/session-rename.sh "$SESSION_ID" "done-${CURRENT_NAME}" "$CWD" >/dev/null 2>&1

# Clean up prompt counter
rm -f "/tmp/claude-session-prompts/${SESSION_ID}" 2>/dev/null

exit 0
