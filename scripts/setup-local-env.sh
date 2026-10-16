#!/usr/bin/env bash
# Link the shared local settings into every app of this checkout.
#
# Real settings live OUTSIDE the repo, so deleting or recreating a worker copy
# never loses them:
#
#   $NORTHTAP_ENV_DIR/<app>.env.local      (default: ~/.ao/data/env/credit-card)
#
# For each app (api, web, admin, mobile, crawler) this symlinks
# apps/<app>/.env.local to that file. This script contains no secret values and
# never prints any.
#
# Usage:
#   scripts/setup-local-env.sh            # symlink (default)
#   scripts/setup-local-env.sh --copy     # copy instead (chmod 600)
#   NORTHTAP_ENV_DIR=/some/dir scripts/setup-local-env.sh
set -euo pipefail

APPS=(api web admin mobile crawler)
ENV_DIR="${NORTHTAP_ENV_DIR:-$HOME/.ao/data/env/credit-card}"
MODE=link

for arg in "$@"; do
  case "$arg" in
    --copy) MODE=copy ;;
    --link) MODE=link ;;
    -h|--help)
      # Header comments only — stop at the first non-comment line so the
      # range does not drift when the header changes.
      sed -n '2,/^[^#]/{/^#/p;}' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
missing=0

for app in "${APPS[@]}"; do
  src="$ENV_DIR/$app.env.local"
  dest="$ROOT/apps/$app/.env.local"

  if [ ! -d "$ROOT/apps/$app" ]; then
    echo "skip   $app (no apps/$app in this checkout)"
    continue
  fi

  if [ ! -f "$src" ]; then
    echo "MISSING $src" >&2
    echo "        create it from apps/$app/.env.example (see README, \"Local settings\")" >&2
    missing=1
    continue
  fi

  # Keep any pre-existing, different local file instead of clobbering it.
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ] && [ "$MODE" = link ]; then
      echo "ok     apps/$app/.env.local -> $src"
      continue
    fi
    if [ -L "$dest" ]; then
      rm "$dest"
    else
      backup="$dest.bak.$(date +%Y%m%d%H%M%S)"
      mv "$dest" "$backup"
      chmod 600 "$backup"
      echo "backup apps/$app/.env.local -> ${backup#"$ROOT"/}"
    fi
  fi

  if [ "$MODE" = copy ]; then
    cp "$src" "$dest"
    chmod 600 "$dest"
    echo "copied apps/$app/.env.local <- $src"
  else
    ln -s "$src" "$dest"
    echo "linked apps/$app/.env.local -> $src"
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Some settings files are missing; see messages above." >&2
  exit 1
fi
