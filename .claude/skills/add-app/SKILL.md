---
name: add-app
description: Add an interactive web app to iamafshin.me/apps — internal (built inside this repo), external (its own repository deployed as its own Cloudflare Worker), or bundled (its own repository, built into the website) — and set or change an app's card thumbnail. Use when the user wants to add, register, scaffold, or wire up an app, tool, calculator, widget, or demo under /apps, or add, replace, or remove the image on an app's card.
---

# Adding an app

An app can exist three ways. **Choosing wrong is expensive to undo**, so settle it
before writing code. (Only changing a thumbnail? Go straight to §2d.)

## 1. Ask: internal or external?

| | **External** *(default — D2)* | **Internal** |
|---|---|---|
| Lives in | Its own repository | `src/apps/<slug>/` here |
| Deploys | Itself, own Worker, own route | With the website |
| A fix means | Push that repo — site untouched | Rebuild and redeploy the whole site |
| Stack | Anything | Must be React (this repo's renderer) |
| Local dev | `bun run dev:all` here, with the app checked out at `../<repo name>` (§14) | Just `bun dev` |
| Good for | Anything real, anything that will grow | Small self-contained widgets |

**Default to external.** It is the architecture's primary path: independent
deploys, constant website build time, genuinely standalone repos.

Choose internal only if the app is small, self-contained, React, and unlikely to
grow — or if the user explicitly wants it in this repo.

A third option, **bundled** (D12, section 2c), keeps its own repository but has
no Worker: the website build clones it and ships it. Use it only when the user
asks for it; it brings back the rebuild-the-site cost that D2 avoids.

Then ask for: **title**, **description** (one sentence — it is the card text),
**slug**, **status** (`live` | `wip` | `archived`), **tags**, **repo URL**
if external or bundled, and whether they want a **thumbnail** (§2d; optional,
and it can be added later).

### Validate the slug before anything else

```bash
python3 -c "
import json,glob,os
reg=[a['slug'] for f in ('src/data/apps.json','src/data/bundled-apps.json') if os.path.exists(f) for a in json.load(open(f))]
internal=[os.path.basename(os.path.dirname(p)) for p in glob.glob('src/apps/*/meta.ts')]
print('existing slugs:', sorted(reg+internal))"
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
  "status": "live",
  "thumbnail": "~assets/apps/calculator.png"  // optional, §2d
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
  thumbnail: '~assets/apps/<slug>.png', // optional, §2d — a string, not an import
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

## 2c. Bundled app (D12)

Add one entry to `src/data/bundled-apps.json`. It takes the same fields as
`apps.json`, `thumbnail` included; `repo` is required and must be a public
GitHub repository, because the build clones it anonymously.

In the app's repository:

1. **A `build:portfolio` script** that writes a static site to `dist/` with base
   `/apps/<slug>/`. For Vite: `vite build --base /apps/<slug>/`.
2. **A committed `bun.lock`.** The build runs `bun install --frozen-lockfile`.
3. **No client-side routing.** The site Worker has no SPA fallback, so a deep
   link would 404. An app that needs routing must be external.
4. **No `wrangler.jsonc`**, and no route: the website's Worker serves it.

Do not add a page under `src/pages/apps/`; the bundle script fails the build if
Astro already emitted `dist/apps/<slug>`.

## 2d. Thumbnail (optional, any app type)

The image on the app's `/apps` card, also shown in the home page preview.

**How it renders** (`src/components/content/AppList.astro`): a flush 16:9
banner on top of the card, cropped with `object-fit: cover`, so any shape works
but a 16:9 source crops nothing. A card **without** a thumbnail has no media
slot at all (no placeholder). Apps with a thumbnail sort first within their
status (`src/lib/apps.ts`), so image cards and text cards form their own rows.

**Where the file lives: always in THIS repository**, in `src/assets/apps/`,
even for an external or bundled app. The website optimises it at build time
like every other image, so changing a thumbnail means redeploying the website,
never the app.

**Steps:**

1. **Get an image.** 16:9, at least 800 px wide (the card requests 400 and
   800 px widths); 1280×720 is ideal. A screenshot of the app is the usual
   choice. From the live app, or from a local dev server if it is not deployed
   yet:

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
     --hide-scrollbars --window-size=1280,720 --timeout=15000 \
     --user-data-dir="$(mktemp -d)" --screenshot=/tmp/<slug>.png "<url>"
   ```

   Use `--timeout`, **not** `--virtual-time-budget`: apps that keep working in
   the background (Plotly, MathJax) never go idle, and the budget variant then
   hangs forever. Look at the result before using it; a capture can land before
   everything renders (raw `$…$` LaTeX, an empty chart).
2. **Crop to the part that sells the app** — usually the main chart or canvas,
   not sidebars full of controls — keeping 16:9. With macOS `sips`
   (height width, then y x offset):

   ```bash
   sips -c 517 920 --cropOffset 49 360 /tmp/<slug>.png --out src/assets/apps/<slug>.png
   ```
3. **Pick the format.** PNG for screenshots and UI (kept as PNG, because JPEG
   rings around hard edges); JPG for photos (the site's JPEG default); SVG for
   vector art (passed through). Also accepted: webp, avif.
4. **Reference it** on the registry entry, or in `meta.ts` for an internal app:
   `"thumbnail": "~assets/apps/<slug>.png"`. Always that prefix and folder: the
   registries are JSON and cannot `import`, so `src/lib/apps.ts` resolves the
   string against a glob of `src/assets/apps/` only. Anything else, or a
   missing file, **fails the build** with a message naming the path.
5. **Alt text:** leave `thumbnailAlt` out by default. The image is then
   decorative (`alt=""`), which is correct when the title directly below says
   the same thing. Set it only if the image shows information the title and
   description do not.

**To remove a thumbnail:** delete the `thumbnail` field and the file in
`src/assets/apps/`. The card goes back to text only.

## 3. Verify

```bash
bun run check
bun run build
```

Build-time guards will reject: invalid slug, prefix collision, directory/slug
mismatch, an internal app with no route, and a thumbnail that does not resolve.

```bash
# listed on /apps
grep -o '<h2[^>]*>[^<]*' dist/apps/index.html

# internal only — route built
ls dist/apps/<slug>/index.html

# thumbnail rendered (one "media" block per card with an image)
grep -c 'class="media"' dist/apps/index.html
grep -o 'src="/_astro/<slug>[^"]*"' dist/apps/index.html
```

Then **actually run it** — an internal app is `client:only`, so a runtime error
shows a blank page and leaves no trace in the HTML:

```bash
bunx astro dev --background
# visit /apps and /apps/<slug>
bunx astro dev stop
```

Check the browser console for errors, and **toggle the theme with the app on
screen** — theme-contract violations only show up that way. If a thumbnail was
added, look at `/apps` too: the crop should show what the app does.

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
- the thumbnail: which file, what it shows, and that it goes live with the next
  **website** deploy (whatever the app type); or that the card has none

Do **not** run `bun run deploy` unless asked. It replaces the live site.
