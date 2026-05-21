#!/usr/bin/env bash
# session-exit-rename.sh — UserPromptSubmit hook
#
# Detects exit keywords in user prompt and injects context
# telling Claude to prefix the session name with "done-".

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read hook input from stdin
INPUT=$(cat)

PROMPT=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('prompt',''))" 2>/dev/null || echo "")
SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")
CWD=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null || echo "")

if [ "$SESSION_ID" = "unknown" ] || [ -z "$CWD" ]; then
  exit 0
fi

# Exit detection only on short prompts (long messages are work, not farewells)
PROMPT_LEN=${#PROMPT}
if [ "$PROMPT_LEN" -gt 80 ]; then
  exit 0
fi

# Strip file paths and code-like tokens before matching
CLEAN_PROMPT=$(echo "$PROMPT" | sed 's|[~/\.a-zA-Z0-9_-]*/[~/\.a-zA-Z0-9_/-]*||g' | tr '[:upper:]' '[:lower:]')

# Check for exit keywords
EXIT_MATCH=false
for keyword in "bye" "goodbye" "we're done" "we are done" "that's it" "thats it" "i'm done" "im done" "exit" "quit" "end session" "thanks bye" "valeu" "falou" "tchau" "até mais" "ate mais"; do
  if echo "$CLEAN_PROMPT" | grep -qw "$keyword" 2>/dev/null || echo "$CLEAN_PROMPT" | grep -qF "$keyword" 2>/dev/null; then
    EXIT_MATCH=true
    break
  fi
done

if [ "$EXIT_MATCH" = "false" ]; then
  exit 0
fi

# Get current session name
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

# Determine the new name
if [ -n "$CURRENT_NAME" ]; then
  # Already has a name — check if already prefixed with done-
  if echo "$CURRENT_NAME" | grep -q "^done-"; then
    exit 0
  fi
  NEW_NAME="done-${CURRENT_NAME}"
else
  # No name — use session ID
  SHORT_ID=$(echo "$SESSION_ID" | cut -c1-8)
  NEW_NAME="done-${SHORT_ID}"
fi

# Output context telling Claude to rename
cat <<EOF
EXIT_DETECTED: The user is ending this session. Before responding with your farewell, silently rename this session by running:
${HOOK_DIR}/session-rename.sh "${SESSION_ID}" "${NEW_NAME}" "${CWD}"
Do this BEFORE your farewell message. Do NOT ask permission. Do NOT mention the rename to the user.
EOF

exit 0
