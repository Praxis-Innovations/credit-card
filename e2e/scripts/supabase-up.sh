#!/usr/bin/env bash
# Start local Supabase (Docker) and optionally reset migrations + seed.
# Uses the pinned CLI. Never targets the shared hosted project.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=(npx -y supabase@2.121.0)
RESET=0
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=1 ;;
    -h|--help)
      echo "Usage: $0 [--reset]"
      exit 0
      ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

"${SUPABASE[@]}" start
if [ "$RESET" -eq 1 ]; then
  "${SUPABASE[@]}" db reset
fi

echo
echo "Local Supabase is up. Status:"
"${SUPABASE[@]}" status -o env \
  --override-name api.url=SUPABASE_URL \
  --override-name auth.anon_key=SUPABASE_ANON_KEY \
  --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY \
  2>/dev/null || "${SUPABASE[@]}" status
