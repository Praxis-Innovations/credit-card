#!/usr/bin/env bash
# Stop processes started by stack-up.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_FILE="$ROOT/e2e/.stack-pids"

if [ ! -f "$PID_FILE" ]; then
  echo "no stack pid file ($PID_FILE)"
  exit 0
fi

while read -r name pid; do
  [ -z "${pid:-}" ] && continue
  if kill -0 "$pid" 2>/dev/null; then
    echo "stopping $name (pid $pid)"
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
done <"$PID_FILE"

rm -f "$PID_FILE"
echo "stack stopped"
