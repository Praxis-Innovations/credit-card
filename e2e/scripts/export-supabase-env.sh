#!/usr/bin/env bash
# Print env assignments for the local Supabase stack + E2E app settings.
# Usage:
#   eval "$(e2e/scripts/export-supabase-env.sh)"
#   E2E_ENV_FORMAT=github e2e/scripts/export-supabase-env.sh >> "$GITHUB_ENV"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=(npx -y supabase@2.121.0)
ENV_FILE="$(mktemp)"
CLEAN_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE" "$CLEAN_FILE"' EXIT
"${SUPABASE[@]}" status -o env >"$ENV_FILE"

# Keep only known KEY=value lines (drop CLI warnings that may land on stdout).
while IFS= read -r line; do
  case "$line" in
    [A-Za-z_]*=*)
      key="${line%%=*}"
      case "$key" in
        API_URL|ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|DB_URL|GRAPHQL_URL|INBUCKET_URL|MAILPIT_URL|STUDIO_URL|STORAGE_S3_URL|S3_PROTOCOL_ACCESS_KEY_ID|S3_PROTOCOL_ACCESS_KEY_SECRET|S3_PROTOCOL_REGION)
          printf '%s\n' "$line"
          ;;
      esac
      ;;
  esac
done <"$ENV_FILE" >"$CLEAN_FILE"

# shellcheck disable=SC1090
set -a
# shellcheck disable=SC1091
source "$CLEAN_FILE"
set +a

: "${API_URL:=http://127.0.0.1:54321}"
if [ -z "${ANON_KEY:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "Could not parse ANON_KEY / SERVICE_ROLE_KEY from \`supabase status -o env\`." >&2
  echo "Keys seen:" >&2
  cut -d= -f1 "$CLEAN_FILE" >&2 || true
  exit 1
fi

E2E_KEY="nt_e2e_local_only_not_for_prod"

emit() {
  local k="$1" v="$2"
  if [ "${E2E_ENV_FORMAT:-export}" = "github" ]; then
    printf '%s=%s\n' "$k" "$v"
  else
    local esc=${v//\'/\'\"\'\"\'}
    printf "export %s='%s'\n" "$k" "$esc"
  fi
}

emit SUPABASE_URL "$API_URL"
emit SUPABASE_ANON_KEY "$ANON_KEY"
emit SUPABASE_SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
emit NEXT_PUBLIC_SUPABASE_URL "$API_URL"
emit NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$ANON_KEY"
emit EXPO_PUBLIC_SUPABASE_URL "$API_URL"
emit EXPO_PUBLIC_SUPABASE_ANON_KEY "$ANON_KEY"
emit EXPO_PUBLIC_NORTHTAP_API_URL "http://127.0.0.1:8787"
emit EXPO_PUBLIC_NORTHTAP_API_KEY "$E2E_KEY"
emit NORTHTAP_STATIC_API_KEY "$E2E_KEY"
emit NORTHTAP_CATALOG_SOURCE "static"
emit NORTHTAP_CORS_ORIGIN "*"
emit ADMIN_ORIGIN "http://127.0.0.1:3100"
emit E2E_API_URL "http://127.0.0.1:8787"
emit E2E_WEB_URL "http://127.0.0.1:3000"
emit E2E_ADMIN_URL "http://127.0.0.1:3100"
emit E2E_APP_URL "http://127.0.0.1:8082"
