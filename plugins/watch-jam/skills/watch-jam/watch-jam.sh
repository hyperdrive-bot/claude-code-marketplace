#!/usr/bin/env bash
# watch-jam.sh <jam-url-or-uuid> [detail]
# detail: quick (3) | standard (6, default) | thorough (12) | many (24) | <number>
# Downloads the raw WebM via anonymous GraphQL and extracts N frames at evenly-spaced timestamps.

set -euo pipefail
export LC_ALL=C LANG=C

INPUT="${1:-}"
DETAIL="${2:-standard}"

if [ -z "$INPUT" ]; then
  echo "usage: watch-jam.sh <jam-url-or-uuid> [quick|standard|thorough|many|<n>]" >&2
  exit 2
fi

# Extract UUID
UUID=$(echo "$INPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
if [ -z "$UUID" ]; then
  echo "ERR: no UUID found in input: $INPUT" >&2
  exit 2
fi

# Resolve frame count
case "$DETAIL" in
  quick)     N=3  ;;
  standard)  N=6  ;;
  thorough)  N=12 ;;
  many)      N=24 ;;
  ''|*[!0-9]*) echo "ERR: unknown detail '$DETAIL'" >&2; exit 2 ;;
  *)         N="$DETAIL" ;;
esac

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="${TMPDIR:-/tmp}/watch-jam/$UUID"
mkdir -p "$WORK/frames"

# 1. Fetch jam metadata (skip if cached)
if [ ! -s "$WORK/meta.json" ]; then
  node -e '
  (async()=>{
    const fs=await import("fs");
    const tpl=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    tpl.variables.id=process.argv[2];
    const r=await fetch("https://graphql.jam.dev/graphql?op=jam",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(tpl)
    });
    const body=await r.text();
    if(!r.ok){console.error("GQL",r.status,body);process.exit(1)}
    fs.writeFileSync(process.argv[3],body);
  })();
  ' "$SKILL_DIR/jam-query.json" "$UUID" "$WORK/meta.json"
fi

# 2. Extract useful fields
node -e '
const fs=require("fs");
const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).data?.jam;
if(!d){console.error("no jam in response");process.exit(1)}
const out={
  id:d.id, type:d.__typename, title:d.title, createdAt:d.createdAt,
  author:d.author?.name, email:d.author?.email, team:d.team?.name,
  originalUrl:d.originalUrl, country:d.country,
  browser:d.systemInfo?.browser, os:d.systemInfo?.os,
  durationMs:d.data?.durationMs, width:d.data?.width, height:d.data?.height,
  videoUrl:d.data?.media?.url, posterUrl:d.data?.posterImageMedia?.url,
  contentType:d.data?.media?.contentType, sizeBytes:d.data?.media?.sizeBytes
};
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
' "$WORK/meta.json" "$WORK/summary.json"

VIDEO_URL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).videoUrl||"")' "$WORK/summary.json")
DURATION_MS=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).durationMs||0)' "$WORK/summary.json")

if [ -z "$VIDEO_URL" ]; then
  echo "ERR: no video URL in jam response (maybe not a VideoJam)" >&2
  exit 1
fi

# 3. Download the video (skip if cached)
EXT="${VIDEO_URL##*.}"; EXT="${EXT%%\?*}"
VIDEO_FILE="$WORK/video.$EXT"
if [ ! -s "$VIDEO_FILE" ]; then
  echo ">> downloading $VIDEO_URL"
  node -e '
  (async()=>{
    const r=await fetch(process.argv[1]);
    if(!r.ok){console.error("dl",r.status);process.exit(1)}
    const fs=await import("fs");
    fs.writeFileSync(process.argv[2],Buffer.from(await r.arrayBuffer()));
  })();
  ' "$VIDEO_URL" "$VIDEO_FILE"
fi

# 4. Extract N frames at evenly-spaced timestamps (avoid 0 and exact end)
rm -f "$WORK/frames"/*.png 2>/dev/null || true
DURATION_S=$(node -e "console.log(($DURATION_MS/1000).toFixed(3))")
for i in $(seq 1 "$N"); do
  # spread frames from 5% to 95% of duration
  T=$(node -e "
    const n=$N,i=$i,d=$DURATION_S;
    const start=d*0.05,end=d*0.95;
    const t=n===1?d/2:start+((end-start)*(i-1)/(n-1));
    console.log(t.toFixed(3));
  ")
  LABEL=$(printf "f%02d_t%06.2f" "$i" "$T")
  ffmpeg -y -loglevel error -ss "$T" -i "$VIDEO_FILE" -frames:v 1 "$WORK/frames/${LABEL}.png" 2>&1 || true
done

echo
echo ">> frames ($N) at $WORK/frames/"
ls "$WORK/frames" | sed "s|^|$WORK/frames/|"
echo
echo ">> video: $VIDEO_FILE"
echo ">> summary: $WORK/summary.json"
