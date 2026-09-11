#!/usr/bin/env bash
#
# docs/architecture.md §14 — unified-origin dev. `bun run dev:all` serves the
# whole site, apps included, on https://iamafshin.localhost:
#
#   - every app in src/data/apps.json and src/data/bundled-apps.json (except
#     archived ones) that has a checkout next to this repository, at
#     ../<repo name>, running its own `bun run dev` with base /apps/<slug>/,
#     so HMR works and the URLs match production
#   - the website on :4321, or a `bun dev` that is already running there
#   - Caddy in front, routing /apps/<slug>* to the app and the rest to Astro
#
# Plain `bun dev` is unaffected and needs none of this.
#
# What an app repository must provide: `bun run dev` is Vite, so it accepts
# --base, --port and --strictPort. Apps without a checkout are skipped and
# answer with a 502 page.
#
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
SITE_PORT=4321
FIRST_APP_PORT=5173

if ! command -v caddy >/dev/null 2>&1; then
  echo "dev:all: caddy is not installed. Once: brew install caddy" >&2
  exit 1
fi

# Background commands in a script ignore Ctrl-C, and `bun run dev` sits above
# the Vite process, so stopping means walking each process tree.
children=()
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}
cleanup() {
  local pid
  for pid in "${children[@]+"${children[@]}"}"; do kill_tree "$pid"; done
  wait 2>/dev/null || true
  rm -f "$ROOT/.caddy/apps.caddy"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Prefix each line with its source: several servers share one terminal.
label() { awk -v p="[$1] " '{ print p $0; fflush() }'; }

# ── Apps ─────────────────────────────────────────────────────────────────────
APPS="$(bun -e '
  const fs = require("fs")
  for (const file of ["apps.json", "bundled-apps.json"]) {
    const path = `./src/data/${file}`
    if (!fs.existsSync(path)) continue
    for (const a of JSON.parse(fs.readFileSync(path, "utf8")))
      if (a.status !== "archived") console.log(a.slug, a.repo)
  }')"

mkdir -p .caddy
: > .caddy/apps.caddy
port=$FIRST_APP_PORT
while read -r slug repo; do
  [[ -z "$slug" ]] && continue
  dir="$(cd "$ROOT/.." && pwd)/$(basename "$repo")"
  if [[ ! -f "$dir/package.json" ]]; then
    echo "dev:all: /apps/$slug skipped: no checkout at $dir"
    continue
  fi
  if [[ ! -d "$dir/node_modules" ]]; then
    echo "dev:all: /apps/$slug skipped: run \`bun install\` in $dir"
    continue
  fi

  # The rewrite: /apps/<slug> (what the /apps cards link to) is served in
  # production, but Vite only answers under its base, /apps/<slug>/. Internal,
  # so the address bar keeps the production URL; the query string survives.
  printf 'handle /apps/%s* {\n\trewrite /apps/%s /apps/%s/\n\treverse_proxy localhost:%s\n}\n' \
    "$slug" "$slug" "$slug" "$port" >> .caddy/apps.caddy
  # stdin is /dev/null so Vite does not grab the terminal for its keyboard
  # shortcuts; Astro in the foreground keeps it. --strictPort makes a busy
  # port an error instead of a silent move to one Caddy does not know about.
  (cd "$dir" && bun run dev --base "/apps/$slug/" --port "$port" --strictPort < /dev/null 2>&1 | label "$slug") &
  children+=("$!")
  echo "dev:all: /apps/$slug -> $dir (:$port)"
  port=$((port + 1))
done <<< "$APPS"

# ── Proxy ────────────────────────────────────────────────────────────────────
# Keeps the terminal on stdin: on the very first run Caddy installs its local
# CA into the system trust store, and sudo asks for a password.
(caddy run --config Caddyfile --adapter caddyfile 2>&1 | label caddy) &
caddy_pid=$!
children+=("$caddy_pid")

# A port-443 conflict or a bad Caddyfile kills Caddy at once. Without this
# check the site would come up with the proxy silently missing.
for _ in $(seq 60); do
  nc -z 127.0.0.1 443 2>/dev/null && break
  if ! kill -0 "$caddy_pid" 2>/dev/null; then
    echo "dev:all: caddy failed to start (see its error above)." >&2
    exit 1
  fi
  sleep 1
done

# ── Website ──────────────────────────────────────────────────────────────────
echo "dev:all: → https://iamafshin.localhost"
if nc -z localhost "$SITE_PORT" 2>/dev/null; then
  echo "dev:all: something is already listening on :$SITE_PORT (a running \`bun dev\`?), proxying to it."
  wait
else
  astro dev --port "$SITE_PORT" "$@"
fi
