#!/usr/bin/env bash
# =========================================================================
#  Solitaire Web - Single-File Release Build
#  Produces ONE self-contained release/index.html with every asset
#  (JS bundle, CSS, favicon, all images) inlined. No external files needed.
# =========================================================================
set -euo pipefail

cd "$(dirname "$0")"

OUT_DIR="release"
OUT_FILE="index.html"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "========================================="
echo " Solitaire Web - Single-File Build"
echo "========================================="

# ── Step 1: TypeScript type-check (best-effort; esbuild does the transpile) ─
echo "[1/4] Type-checking (tsc)..."
if command -v tsc >/dev/null 2>&1; then
  tsc --noEmit || { echo "       tsc reported errors; aborting."; exit 1; }
  echo "       OK"
else
  echo "       tsc not found on PATH; skipping type-check."
fi

# ── Step 2: Bundle all modules into one IIFE (esbuild) ───────────────────
echo "[2/4] Bundling JS (esbuild)..."
npx --yes esbuild src/main.ts \
  --bundle --format=iife --target=es2020 \
  --outfile="$TMP/bundle.js"
echo "       OK"

# ── Step 3: Inline images / css / js into a single index.html ────────────
echo "[3/4] Inlining assets..."
mkdir -p "$OUT_DIR"
node build-inline.cjs "$TMP/bundle.js" "index.html" "css/style.css" "img" "$OUT_DIR/$OUT_FILE"
echo "       OK"

# ── Step 4: Summary ──────────────────────────────────────────────────────
echo "[4/4] Done."
echo "========================================="
echo " Build complete:"
echo "   $(pwd)/$OUT_DIR/$OUT_FILE  (self-contained, no external files)"
echo "========================================="
