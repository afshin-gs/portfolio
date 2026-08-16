---
name: add-app
description: Add an interactive web app to iamafshin.me/apps — either internal (built inside this repo) or external (its own repository deployed as its own Cloudflare Worker). Use when the user wants to add, register, scaffold, or wire up an app, tool, calculator, widget, or demo under /apps.
---

# Adding an app

An app can exist two ways. **Choosing wrong is expensive to undo**, so settle it
before writing code.

## 1. Ask: internal or external?

| | **External** *(default — D2)* | **Internal** |
|---|---|---|
| Lives in | Its own repository | `src/apps/<slug>/` here |
| Deploys | Itself, own Worker, own route | With the website |
| A fix means | Push that repo — site untouched | Rebuild and redeploy the whole site |
| Stack | Anything | Must be React (this repo's renderer) |
| Local dev | Needs Caddy for the shared origin (D9/§14) | Just `bun dev` |
| Good for | Anything real, anything that will grow | Small self-contained widgets |

**Default to external.** It is the architecture's primary path: independent
deploys, constant website build time, genuinely standalone repos.

Choose internal only if the app is small, self-contained, React, and unlikely to
grow — or if the user explicitly wants it in this repo.

Then ask for: **title**, **description** (one sentence — it is the card text),
**slug**, **status** (`live` | `wip` | `archived`), **tags**, and **repo URL**
if external.

### Validate the slug before anything else

```bash
python3 -c "
import json,glob,os
ext=[a['slug'] for a in json.load(open('src/data/apps.json'))]
internal=[os.path.basename(os.path.dirname(p)) for p in glob.glob('src/apps/*/meta.ts')]
print('existing slugs:', sorted(ext+internal))"
```

Rules, both enforced at build time:

- lowercase-kebab-case
- **must not be a prefix of, or prefixed by, any existing slug** — the
  Cloudflare route `/apps/<slug>*` also captures `/apps/<slug>anything`, so
  `calc` would silently swallow `calculator` (D10)

## 2a. External app

The website has no build-time access to another repo, so it cannot be
discovered — it must be declared. Add one entry to `src/data/apps.json`:

```jsonc
{
  "slug": "calculator",
  "title": "Calculator",
  "description": "One sentence, shown on the card.",
  "repo": "https://github.com/<user>/app-calculator",
  "tags": ["react", "vite"],
  "status": "live"
}
```

That file is the **entire** coupling between this repo and every app repo. Do
not add a route here — the app claims that URL at the Cloudflare edge, and a
page emitted by the website would fight it for the same path.

Then, in the app's own repository (§11):

```jsonc
// wrangler.jsonc
{
  "name": "app-<slug>",
  "compatibility_date": "2025-11-01",
  "routes": [
    { "pattern": "iamafshin.me/apps/<slug>*", "zone_name": "iamafshin.me" }
  ],
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

Four requirements in the app repo, each load-bearing:

1. **One greedy route pattern** — `/apps/<slug>*`. Not `/apps/<slug>/*`, which
   misses the bare path; not a separate literal pattern, which breaks on query
   strings. Verified in R1.
2. **Entry `index.html` at the asset bucket root**, hashed assets nested under
   `dist/apps/<slug>/`. SPA fallback resolves to the *bucket root*, not the
   nearest `index.html`, so a nested entry 404s on any hard refresh of a client
   route (D10).
3. **Vite `base: '/apps/<slug>/'`** and router `basename: '/apps/<slug>'`.
4. **Copy the theme contract** (§12) — `localStorage['afshin:theme']`, the
   blocking inline head script, and the CSS custom-property names. Consume
   `--bg`/`--fg`/`--accent`; never hardcode colours. Copied, not packaged (D7).

## 2b. Internal app

```
src/apps/<slug>/
├── meta.ts        # auto-discovered → appears on /apps
├── App.tsx        # default export = root component
└── <name>.css
```

```ts
// meta.ts — slug MUST equal the directory name (build-time enforced)
import type { AppMeta } from '../../lib/apps'
export const meta: AppMeta = {
  slug: '<slug>',
  title: '…',
  description: '…',
  tags: ['react'],
  status: 'live',
}
```

```tsx
// App.tsx
import './<name>.css'
export { default } from './<Component>'
```

Then the entrypoint page — **required**, and the one thing that is not
auto-generated:

```astro
---
// src/pages/apps/<slug>.astro
import AppShell from '../../layouts/AppShell.astro'
import App from '../../apps/<slug>/App'
import { meta } from '../../apps/<slug>/meta'
---
<AppShell app={meta}><App client:only="react" /></AppShell>
```

**Why this file cannot be generated:** Astro resolves `client:*` at compile
time. A component pulled from `import.meta.glob` and passed through props fails
with `NoMatchingImport`. The app *list* is fully auto-generated; only the
hydration entrypoint must be static. Forgetting it is caught by a build-time
guard that names the missing file.

Style using **only** theme-contract custom properties — `--bg`, `--fg`,
`--muted`, `--border`, `--surface`, `--accent`. Hardcoded colours will not
survive a theme switch.

## 3. Verify

```bash
bun run check
bun run build
```

Build-time guards will reject: invalid slug, prefix collision, directory/slug
mismatch, and an internal app with no route.

```bash
# listed on /apps
grep -o '<h2[^>]*>[^<]*' dist/apps/index.html

# internal only — route built
ls dist/apps/<slug>/index.html
```

Then **actually run it** — an internal app is `client:only`, so a runtime error
shows a blank page and leaves no trace in the HTML:

```bash
bunx astro dev --background
# visit /apps and /apps/<slug>
bunx astro dev stop
```

Check the browser console for errors, and **toggle the theme with the app on
screen** — theme-contract violations only show up that way.

For an **external** app, the website build cannot verify anything. After the app
repo deploys, confirm the route actually resolves — and cache-bust, or you will
read a stale edge response (R1 methodology note):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Cache-Control: no-cache' \
  "https://iamafshin.me/apps/<slug>/?cb=$RANDOM"
```

## 4. Report back

- the URL, and whether it is live or only local
- for external: that `apps.json` is only the listing — the app repo must deploy
  itself, and until it does the card links to a 404 (mitigate with
  `status: "wip"`)
- for internal: that this app now ships with every site deploy

Do **not** run `bun run deploy` unless asked. It replaces the live site.
