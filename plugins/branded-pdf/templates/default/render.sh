#!/usr/bin/env bash
# Render an HTML proposal to PDF via headless Chrome and detect page overflow.
#
# Usage: render-proposal.sh <input.html> [output.pdf]
#
# Exits 0 if actual PDF page count == expected (1 cover + N <div class="page">),
# exits 1 otherwise and prints which PDF pages are overflow spills (no page-number
# element). The overflowing logical page is the one whose page-number precedes
# the spill.

set -euo pipefail

INPUT="${1:?usage: render-proposal.sh <input.html> [output.pdf]}"
OUTPUT="${2:-${INPUT%.html}.pdf}"

[ -f "$INPUT" ] || { echo "ERROR: $INPUT not found" >&2; exit 2; }

INPUT_ABS="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v chromium || command -v google-chrome || true)"
[ -n "$CHROME" ] || { echo "ERROR: Chrome/Chromium not found" >&2; exit 2; }

# Expected pages = 1 cover + count of <div class="page">
EXPECTED=$(grep -c 'class="page"' "$INPUT" || true)
EXPECTED=$((EXPECTED + 1))

"$CHROME" --headless --disable-gpu --no-pdf-header-footer --no-margins \
  --print-to-pdf="$OUTPUT" "file://$INPUT_ABS" 2>/dev/null

command -v pdftotext >/dev/null || { echo "ERROR: pdftotext not installed (brew install poppler)" >&2; exit 2; }

TXT=$(mktemp)
pdftotext -layout "$OUTPUT" "$TXT"

# Count actual pages: form feeds + 1 (if file doesn't end with FF)
ACTUAL=$(python3 -c "
import sys
t = open('$TXT').read()
pages = t.split('\x0c')
# pdftotext emits a trailing \x0c, drop empty trailing chunks
while pages and not pages[-1].strip():
    pages.pop()
print(len(pages))
")

echo "Expected pages: $EXPECTED   Actual: $ACTUAL"

if [ "$ACTUAL" -eq "$EXPECTED" ]; then
  echo "✓ No overflow"
  rm -f "$TXT"
  exit 0
fi

echo "✗ OVERFLOW detected — $(($ACTUAL - $EXPECTED)) extra physical page(s)"
echo ""
echo "Per-PDF-page diagnosis:"
python3 <<PYEOF
import re
pages = open("$TXT").read().split("\x0c")
while pages and not pages[-1].strip():
    pages.pop()
last_pg = None
for i, p in enumerate(pages, 1):
    lines = [l.strip() for l in p.split("\n") if l.strip()]
    m = next((l for l in lines if re.match(r'\d+\s*/\s*\d+', l)), None)
    heading = next((l for l in lines if l != m), "") if lines else ""
    if m:
        last_pg = m.strip()
        status = "OK"
    else:
        status = f"SPILL from logical page {last_pg or '?'}"
    print(f"  PDF P{i:>2}  [{status:<38}]  {heading[:60]}")
PYEOF

rm -f "$TXT"
exit 1
