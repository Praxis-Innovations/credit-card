#!/usr/bin/env bash
# Print `export KEY='…'` lines for the local Supabase stack + E2E app settings.
# Usage:  eval "$(e2e/scripts/export-supabase-env.sh)"
#     or: e2e/scripts/export-supabase-env.sh >> "$GITHUB_ENV"  (after stripping `export `)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUPABASE=(npx -y supabase@2.121.0)
# Flat KEY=value (ANON_KEY, API_URL, SERVICE_ROLE_KEY, …)
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
"${SUPABASE[@]}" status -o env >"$ENV_FILE"

python3 - "$ENV_FILE" <<'PY'
import sys
from pathlib import Path

raw = Path(sys.argv[1]).read_text()
vals = {}
for line in raw.splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    vals[k.strip()] = v.strip().strip('"').strip("'")

url = vals.get("API_URL") or "http://127.0.0.1:54321"
anon = vals.get("ANON_KEY")
service = vals.get("SERVICE_ROLE_KEY")
if not anon or not service:
    raise SystemExit(
        "Could not parse ANON_KEY / SERVICE_ROLE_KEY from `supabase status -o env`. "
        f"Keys seen: {sorted(vals)}"
    )

e2e_key = "nt_e2e_local_only_not_for_prod"
pairs = {
    "SUPABASE_URL": url,
    "SUPABASE_ANON_KEY": anon,
    "SUPABASE_SERVICE_ROLE_KEY": service,
    "NEXT_PUBLIC_SUPABASE_URL": url,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": anon,
    "EXPO_PUBLIC_SUPABASE_URL": url,
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": anon,
    "EXPO_PUBLIC_NORTHTAP_API_URL": "http://127.0.0.1:8787",
    "EXPO_PUBLIC_NORTHTAP_API_KEY": e2e_key,
    "NORTHTAP_STATIC_API_KEY": e2e_key,
    "NORTHTAP_CATALOG_SOURCE": "static",
    "NORTHTAP_CORS_ORIGIN": "*",
    "ADMIN_ORIGIN": "http://127.0.0.1:3100",
    "E2E_API_URL": "http://127.0.0.1:8787",
    "E2E_WEB_URL": "http://127.0.0.1:3000",
    "E2E_ADMIN_URL": "http://127.0.0.1:3100",
    "E2E_APP_URL": "http://127.0.0.1:8082",
}

fmt = sys.environ.get("E2E_ENV_FORMAT", "export")  # export | github
for k, v in pairs.items():
    if fmt == "github":
        # GITHUB_ENV multiline-safe: KEY=value per line (no secrets logging by us)
        print(f"{k}={v}")
    else:
        esc = str(v).replace("'", "'\"'\"'")
        print(f"export {k}='{esc}'")
PY
