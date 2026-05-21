#!/usr/bin/env bash
# session-rename.sh — Core utility to rename a Claude Code session
#
# Usage: session-rename.sh <session_id> <new_name> [cwd]
#
# Writes/updates a "custom-title" record in the session JSONL file.
# If a custom-title already exists, it's updated in place.
# If not, it's prepended as the first line.

set -euo pipefail

SESSION_ID="${1:?Usage: session-rename.sh <session_id> <new_name> [cwd]}"
NEW_NAME="${2:?Usage: session-rename.sh <session_id> <new_name> [cwd]}"
CWD="${3:-$(pwd)}"

# Derive project directory from CWD (replace non-alnum with -)
PROJECT_DIR=$(echo "$CWD" | sed 's|/|-|g')
SESSIONS_DIR="$HOME/.claude/projects/${PROJECT_DIR}"
JSONL_FILE="${SESSIONS_DIR}/${SESSION_ID}.jsonl"

if [ ! -f "$JSONL_FILE" ]; then
  echo "ERROR: Session JSONL not found: $JSONL_FILE" >&2
  exit 1
fi

# Use python3 with proper argument passing (no shell interpolation in python code)
python3 - "$JSONL_FILE" "$SESSION_ID" "$NEW_NAME" <<'PYEOF'
import json, sys

jsonl_file = sys.argv[1]
session_id = sys.argv[2]
new_name = sys.argv[3]

title_record = json.dumps({
    "type": "custom-title",
    "customTitle": new_name,
    "sessionId": session_id
}, separators=(",", ":"))

with open(jsonl_file, "r") as f:
    lines = f.readlines()

# Check if custom-title exists in first 5 lines
updated = False
for i, line in enumerate(lines[:5]):
    try:
        d = json.loads(line.strip())
        if d.get("type") == "custom-title":
            lines[i] = title_record + "\n"
            updated = True
            break
    except:
        continue

if not updated:
    lines.insert(0, title_record + "\n")

with open(jsonl_file, "w") as f:
    f.writelines(lines)

action = "UPDATED" if updated else "CREATED"
print(f"{action}: Session renamed to '{new_name}'")
PYEOF

# Also update sessions-index.json so /resume picks up the new name
INDEX_FILE="${SESSIONS_DIR}/sessions-index.json"
if [ -f "$INDEX_FILE" ]; then
  python3 - "$INDEX_FILE" "$SESSION_ID" "$NEW_NAME" "$JSONL_FILE" <<'PYEOF'
import json, sys, os
from datetime import datetime, timezone

index_file = sys.argv[1]
session_id = sys.argv[2]
new_name = sys.argv[3]
jsonl_file = sys.argv[4]

try:
    with open(index_file, "r") as f:
        idx = json.load(f)
except:
    sys.exit(0)

entries = idx.get("entries", [])
found = False
for entry in entries:
    if entry.get("sessionId") == session_id:
        entry["customTitle"] = new_name
        found = True
        break

if not found:
    # Session not in index — add a minimal entry so /resume can find it
    mtime = int(os.path.getmtime(jsonl_file) * 1000)
    now = datetime.now(timezone.utc).isoformat()
    entries.append({
        "sessionId": session_id,
        "fullPath": jsonl_file,
        "fileMtime": mtime,
        "customTitle": new_name,
        "firstPrompt": "",
        "messageCount": 0,
        "created": now,
        "modified": now,
        "gitBranch": "",
        "projectPath": os.path.dirname(jsonl_file),
        "isSidechain": False
    })

with open(index_file, "w") as f:
    json.dump(idx, f, separators=(",", ":"))
PYEOF
fi

# Update our own name→id index (used by rclauded)
NAMES_FILE="$HOME/.claude/session-names.json"
python3 - "$NAMES_FILE" "$SESSION_ID" "$NEW_NAME" "$SESSIONS_DIR" <<'PYEOF'
import json, sys, os

names_file = sys.argv[1]
session_id = sys.argv[2]
new_name = sys.argv[3]
sessions_dir = sys.argv[4]

# Load existing index
names = {}
if os.path.exists(names_file):
    try:
        with open(names_file, "r") as f:
            names = json.load(f)
    except:
        names = {}

# Remove old name for this session (if renamed)
names = {k: v for k, v in names.items() if v["sessionId"] != session_id}

# Add new entry
names[new_name] = {
    "sessionId": session_id,
    "projectDir": sessions_dir
}

with open(names_file, "w") as f:
    json.dump(names, f, indent=2, sort_keys=True)
PYEOF
