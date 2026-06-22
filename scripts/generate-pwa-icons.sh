#!/usr/bin/env bash
#
# Regenerate the PWA icons in public/icons/ from the open-book brand SVG.
#
# Requires rsvg-convert (librsvg). On macOS: `port install librsvg` or
# `brew install librsvg`. Run from the repo root: `bash scripts/generate-pwa-icons.sh`
#
# The standard icons are rendered on a white background (the logo's strokes are
# black, so transparency would make it vanish on dark home screens). The maskable
# icon renders the logo at ~80% of the canvas, centred, so Android's mask never
# crops the book frame (the maskable "safe zone" is the central 80%).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/readitinabook-logo-openbook.svg"
OUT="$ROOT/public/icons"
BG="#ffffff"

mkdir -p "$OUT"

# Standard "any" icons + apple-touch — logo on a white field, its own ~11% margin.
rsvg-convert -b "$BG" -w 192 -h 192 "$SRC" -o "$OUT/icon-192.png"
rsvg-convert -b "$BG" -w 512 -h 512 "$SRC" -o "$OUT/icon-512.png"
rsvg-convert -b "$BG" -w 180 -h 180 "$SRC" -o "$OUT/apple-touch-icon.png"

# Maskable 512 — logo at 410px (80% of 512) centred on a 512 white page (51px margin).
rsvg-convert -b "$BG" -w 410 -h 410 --page-width 512 --page-height 512 \
  --top 51 --left 51 "$SRC" -o "$OUT/icon-512-maskable.png"

echo "Generated PWA icons in $OUT:"
ls -1 "$OUT"
