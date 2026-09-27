#!/usr/bin/env bash
# Rasterises the approved NorthTap SVGs in assets/brand/ into the PNGs that
# app.json points at. The SVGs are the source of truth: never edit their
# geometry here, only size and pad them.
#
# Requires rsvg-convert (librsvg) and ImageMagick 7 (`magick`).
#   brew install librsvg imagemagick
set -euo pipefail

cd "$(dirname "$0")/../assets/brand"

for tool in rsvg-convert magick; do
  command -v "$tool" >/dev/null || { echo "missing $tool" >&2; exit 1; }
done

# The mark SVGs have a 76-unit-wide viewBox around a 74-unit-wide card.
render_mark_on_canvas() {
  local src=$1 card_px=$2 canvas_px=$3 out=$4
  local render_px=$(( card_px * 76 / 74 ))
  rsvg-convert -w "$render_px" "$src" \
    | magick - -background none -gravity center -extent "${canvas_px}x${canvas_px}" \
      -strip "PNG32:$out"
}

# iOS / default icon: the full-bleed teal tile with the white card.
rsvg-convert -w 1024 -h 1024 northtap-app-icon.svg | magick - -strip PNG24:icon.png

# Android adaptive foreground (background colour #0c5c56 lives in app.json).
# The safe zone is a 66dp circle on the 108dp canvas (r = 313px at 1024).
# At 548px wide the card's rounded corners reach r = 304px.
render_mark_on_canvas northtap-mark-reverse.svg 548 1024 adaptive-icon.png

# Splash: the reverse (white) mark, centred on #0c5c56 by expo-splash-screen.
render_mark_on_canvas northtap-mark-reverse.svg 710 1024 splash-icon.png

# Web favicon; Expo CLI turns this into favicon.ico during `expo export`.
render_mark_on_canvas northtap-favicon.svg 248 256 favicon.png

echo "Wrote icon.png adaptive-icon.png splash-icon.png favicon.png"
