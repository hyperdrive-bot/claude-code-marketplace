#!/usr/bin/env bash
# session-auto-rename.sh — UserPromptSubmit hook
#
# After 3+ prompts, if the session is still unnamed, injects a strong
# directive telling Claude to rename NOW. Checks on every prompt until renamed.

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")
CWD=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null || echo "")

if [ "$SESSION_ID" = "unknown" ] || [ -z "$CWD" ]; then
  exit 0
fi

# Track prompt count per session
COUNTER_DIR="/tmp/claude-session-prompts"
mkdir -p "$COUNTER_DIR"
COUNTER_FILE="${COUNTER_DIR}/${SESSION_ID}"

COUNT=0
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
  if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then COUNT=0; fi
fi
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Only kick in after 3 prompts
if [ "$COUNT" -lt 3 ]; then
  exit 0
fi

# Check if session already has a name
PROJECT_DIR=$(echo "$CWD" | sed 's|/|-|g')
JSONL_FILE="$HOME/.claude/projects/${PROJECT_DIR}/${SESSION_ID}.jsonl"

if [ ! -f "$JSONL_FILE" ]; then
  exit 0
fi

HAS_NAME=$(head -5 "$JSONL_FILE" | python3 -c "
import json, sys
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        if d.get('type') == 'custom-title':
            print('yes')
            break
    except:
        continue
" 2>/dev/null || echo "")

if [ "$HAS_NAME" = "yes" ]; then
  # Already named — stop checking, clean up counter
  rm -f "$COUNTER_FILE"
  exit 0
fi

# Not yet named — inject directive
cat <<EOF
<user-prompt-submit-hook>
AUTO_RENAME_REQUIRED: This session has had ${COUNT} exchanges and is STILL unnamed. You MUST rename it NOW before doing anything else. Run:
${HOOK_DIR}/session-rename.sh "${SESSION_ID}" "<descriptive-kebab-name>" "${CWD}"
Pick a short kebab-case name (3-6 words) based on what this conversation is about. Do it silently — no need to mention it to the user.
</user-prompt-submit-hook>
EOF

exit 0
