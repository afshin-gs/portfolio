#!/usr/bin/env bash
#
# Build every bundled app (docs/architecture.md D12) and copy its output into
# dist/apps/<slug>/. `bun run build` runs this after `astro build`, which empties
# dist/, so a laptop and CI ship exactly the same thing.
#
# Each app is cloned fresh from the `repo` in src/data/bundled-apps.json at its
# default branch, which is what CI does too. USE_LOCAL_APPS=1 builds the sibling
# checkout ../<repo name> instead, to preview an unpushed change locally.
#
# What a bundled app repository must provide: `bun install --frozen-lockfile`
# works, and `bun run build:portfolio` writes a static site to dist/ whose asset
# URLs all start with /apps/<slug>/.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT_DIR/dist"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "bundle-apps.sh: dist/index.html is missing. Run astro build first." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# One "slug repo" pair per line, from the same registry the /apps page reads.
APPS="$(cd "$ROOT_DIR" && bun -e 'for (const a of require("./src/data/bundled-apps.json")) console.log(a.slug, a.repo)')"

while read -r slug repo; do
  [[ -z "$slug" ]] && continue
  target="$DIST/apps/$slug"

  # Something Astro built (an internal app or a page) already owns this path.
  if [[ -e "$target" ]]; then
    echo "bundle-apps.sh: dist/apps/$slug already exists, so another route owns the slug '$slug'." >&2
    exit 1
  fi

  if [[ "${USE_LOCAL_APPS:-}" == "1" ]]; then
    src="$ROOT_DIR/../$(basename "$repo")"
    if [[ ! -f "$src/package.json" ]]; then
      echo "bundle-apps.sh: USE_LOCAL_APPS=1, but $src is not a checkout of $repo." >&2
      exit 1
    fi
    echo "==> $slug: building local checkout $src"
  else
    src="$WORK/$slug"
    echo "==> $slug: cloning $repo"
    git clone --quiet --depth 1 "$repo.git" "$src" < /dev/null
    if [[ ! -f "$src/package.json" ]]; then
      echo "bundle-apps.sh: $repo has no package.json on its default branch (is anything pushed?)." >&2
      exit 1
    fi
  fi

  (cd "$src" && bun install --frozen-lockfile && bun run build:portfolio) < /dev/null

  # A build made for "/" would load its assets from the site root and 404.
  if ! grep -q "/apps/$slug/" "$src/dist/index.html" 2>/dev/null; then
    echo "bundle-apps.sh: $slug did not build a dist/index.html for /apps/$slug/. Check its build:portfolio script." >&2
    exit 1
  fi

  mkdir -p "$target"
  cp -R "$src/dist/." "$target/"
  echo "==> $slug: dist/ -> dist/apps/$slug/"
done <<< "$APPS"
