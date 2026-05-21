#!/usr/bin/env bash
# session-id-inject.sh — SessionStart hook
#
# Injects the session ID and auto-rename instructions into Claude's context.
# Also checks if this session already has a custom-title.

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read hook input from stdin
INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")
CWD=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null || echo "")

if [ "$SESSION_ID" = "unknown" ] || [ -z "$CWD" ]; then
  exit 0
fi

# Derive project dir and check for existing title
PROJECT_DIR=$(echo "$CWD" | sed 's|/|-|g')
JSONL_FILE="$HOME/.claude/projects/${PROJECT_DIR}/${SESSION_ID}.jsonl"

CURRENT_NAME=""
if [ -f "$JSONL_FILE" ]; then
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
fi

# Output context for Claude
if [ -n "$CURRENT_NAME" ]; then
  echo "SESSION_ID=${SESSION_ID} | CURRENT_NAME=${CURRENT_NAME} | Session already named."
else
  echo "SESSION_ID=${SESSION_ID} | CURRENT_NAME=<unnamed> | This session has no name yet. Once you understand the direction of this conversation (after 2-3 exchanges), auto-rename it by running: ${HOOK_DIR}/session-rename.sh \"${SESSION_ID}\" \"<descriptive-kebab-name>\" \"${CWD}\" — choose a short, descriptive kebab-case name summarizing the conversation topic. Do NOT ask for permission, just rename silently."
fi

exit 0
