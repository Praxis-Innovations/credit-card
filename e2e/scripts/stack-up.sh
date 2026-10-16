#!/usr/bin/env bash
# Build and start api / web / admin / mobile (Expo web export) against local Supabase.
# Prerequisites: Docker + `e2e/scripts/supabase-up.sh --reset` (or supabase already seeded).
# Writes PIDs to e2e/.stack-pids for stack-down.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
E2E_DIR="$ROOT/e2e"
PID_FILE="$E2E_DIR/.stack-pids"
LOG_DIR="$E2E_DIR/.stack-logs"
mkdir -p "$LOG_DIR"

# Load local Supabase + E2E env into this shell (and child processes).
# shellcheck disable=SC1091
eval "$("$E2E_DIR/scripts/export-supabase-env.sh")"

echo "Building api, web, admin…"
pnpm --filter api --filter web --filter admin build

echo "Exporting mobile web…"
# Keep a developer's shared .env.local out of the E2E bundle.
(
  cd apps/mobile
  EXPO_NO_DOTENV=1 \
    EXPO_PUBLIC_SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" \
    EXPO_PUBLIC_SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
    EXPO_PUBLIC_NORTHTAP_API_URL="$EXPO_PUBLIC_NORTHTAP_API_URL" \
    EXPO_PUBLIC_NORTHTAP_API_KEY="$EXPO_PUBLIC_NORTHTAP_API_KEY" \
    pnpm exec expo export --platform web --clear
)

# Tear down any previous stack from this script.
if [ -f "$PID_FILE" ]; then
  bash "$E2E_DIR/scripts/stack-down.sh" || true
fi
: >"$PID_FILE"

start() {
  local name="$1"
  shift
  echo "Starting $name…"
  "$@" >"$LOG_DIR/$name.log" 2>&1 &
  echo "$name $!" >>"$PID_FILE"
}

start api pnpm --filter api start
start web pnpm --filter web exec next start --port 3000
start admin pnpm --filter admin start
start app pnpm --filter mobile serve:dist

wait_url() {
  local url="$1"
  local label="$2"
  local i
  for i in $(seq 1 90); do
    if curl -sf -o /dev/null "$url"; then
      echo "ready  $label ($url)"
      return 0
    fi
    sleep 2
  done
  echo "timeout waiting for $label at $url" >&2
  echo "---- $label log ----" >&2
  tail -n 80 "$LOG_DIR/$label.log" >&2 || true
  exit 1
}

wait_url "http://127.0.0.1:8787/v1/health" api
wait_url "http://127.0.0.1:3000/" web
wait_url "http://127.0.0.1:3100/login" admin
wait_url "http://127.0.0.1:8082/" app

echo
echo "Stack is up. Run: pnpm --filter e2e run test:smoke"
echo "Stop with:      pnpm --filter e2e stack:down"
