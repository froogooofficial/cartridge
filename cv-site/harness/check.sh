#!/usr/bin/env bash
# One command: serve, capture, audit, lighthouse, regenerate progress page.
# Usage: harness/check.sh [label]
set -uo pipefail
cd "$(dirname "$0")/.."
LABEL="${1:-ours}"
PORT="${PORT:-4173}"
URL="http://127.0.0.1:${PORT}/"

node harness/serve.mjs "$PWD/site" "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 1 40); do
  curl -s -o /dev/null "$URL" && break
  sleep 0.25
done

mkdir -p captures/"$LABEL" reports

echo "== capture =="
node harness/capture.mjs "$URL" "captures/$LABEL" "$LABEL"

echo "== audit (tap targets / jank / CLS / overflow) =="
node harness/audit.mjs "$URL" "reports/audit-$LABEL.json"
AUDIT=$?

echo "== lighthouse mobile =="
node harness/lh.mjs "$URL" "reports/lh-$LABEL.json"
LH=$?

echo "== progress page =="
node harness/progress.mjs

echo
echo "audit=$AUDIT lighthouse=$LH  (0 = pass)"
exit $(( AUDIT != 0 || LH != 0 ))
