#!/usr/bin/env bash
#
# Copy the compiled CV into public/ so Astro serves it at /cv.pdf.
#
# Split out of build.sh because CI never compiles. GitHub Actions has no Docker
# step and is not going to grow one, so `cv/output/cv.pdf` is COMMITTED and this
# copy is the only thing the deploy has to do with it. `bun run build` calls
# this first, which is what makes it impossible to ship a dist/ without the PDF.
#
# Recompiling (bun run cv:build) runs this too, so there is one copy path rather
# than two that can disagree.
#
set -euo pipefail

CV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$CV_DIR")"
SRC="$CV_DIR/output/cv.pdf"
DEST="$ROOT_DIR/public/cv.pdf"

if [[ ! -f "$SRC" ]]; then
  # A warning, not an error. The site is still a valid site without the PDF, and
  # failing a deploy over it is worse than shipping with one dead download link.
  # The ::warning:: form surfaces it in the GitHub Actions run summary instead of
  # burying it three hundred lines into a build log; outside Actions it is just
  # an odd-looking line, which is why the plain-English version follows it.
  echo "::warning file=cv/output/cv.pdf::cv/output/cv.pdf is missing, so /cv.pdf will 404. Run 'bun run cv:build' locally and commit the result."
  echo "cv/publish.sh: no cv/output/cv.pdf, nothing to publish" >&2
  exit 0
fi

mkdir -p "$ROOT_DIR/public"
cp "$SRC" "$DEST"
echo "==> cv/output/cv.pdf -> public/cv.pdf"
