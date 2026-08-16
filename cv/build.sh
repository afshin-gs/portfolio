#!/usr/bin/env bash
#
# Compile cv/main.tex to a PDF inside Docker. Nothing LaTeX-related is needed
# on the host — only Docker.
#
# Outputs:
#   cv/output/cv.pdf   (plus latexmk's aux files, all confined to output/)
#   public/cv.pdf      (so Astro serves it at /cv.pdf; skip with --no-publish)
#
# Used by:
#   bun run cv:build   — and therefore by bun run deploy
#   VS Code / LaTeX Workshop on save (see .vscode/settings.json)
#
set -euo pipefail

CV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$CV_DIR")"
IMAGE="${CV_IMAGE:-afshin-cv-latex:latest}"
JOBNAME="cv"
PUBLISH=1

for arg in "$@"; do
  case "$arg" in
    --no-publish) PUBLISH=0 ;;
    *) echo "build.sh: unknown argument '$arg'" >&2; exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "build.sh: docker is not installed or not on PATH." >&2
  exit 1
fi

# First run (or after a Dockerfile change that was never built) bootstraps the
# image rather than failing with an opaque "image not found".
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "==> $IMAGE not found, building it (one-off, a few minutes)"
  docker build -t "$IMAGE" "$CV_DIR"
fi

mkdir -p "$CV_DIR/output"

# --user keeps the generated files owned by the caller instead of root.
# HOME must be writable: latexmk and fontconfig both want a cache dir.
# The bind mount deliberately uses the SAME path inside the container as on the
# host, so the paths SyncTeX records resolve for the VS Code viewer.
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env HOME=/tmp \
  --volume "$CV_DIR:$CV_DIR" \
  --workdir "$CV_DIR" \
  "$IMAGE" \
  latexmk \
    -pdf \
    -synctex=1 \
    -jobname="$JOBNAME" \
    -outdir=output \
    -interaction=nonstopmode \
    -halt-on-error \
    -file-line-error \
    main.tex

if [[ "$PUBLISH" == "1" ]]; then
  # Delegated, not duplicated: publish.sh is also what CI runs, and two copies
  # of a copy are two things that can disagree about the destination.
  "$CV_DIR/publish.sh"
else
  echo "==> cv/output/$JOBNAME.pdf"
fi
