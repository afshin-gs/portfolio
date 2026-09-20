# AGENTS.md

Guidance for AI agents working in this repository.

**Read `docs/architecture.md` before making structural changes.** It is the
source of truth and records *why* things are the way they are. Decisions are
numbered (D1–D11), risks (R1–R6) — reference them by number rather than
re-deriving or re-arguing them. If you are about to contradict a decision, say
so explicitly and explain why; do not quietly diverge.

## What this is

A static personal site (`iamafshin.me`): portfolio, resume, blog, and a launcher
for interactive web apps. Astro, static output, hosted as a Cloudflare Worker
serving static assets. **No server, no database, no runtime compute.** If a
proposed feature needs any of those, it is out of scope — see §16.

## Commands

```bash
bun dev                        # dev server on :4321
bun run dev:all                # site + checked-out apps on https://iamafshin.localhost (Caddy, §14)
bunx astro dev --background    # ...as a background process
bunx astro dev stop|status|logs
bun run build                  # -> dist/
bun run check                  # types + content schema validation
bun run preview                # serve the built output locally
bun run cv:build               # latexmk in Docker -> cv/output/cv.pdf, then publishes
bun run cv:publish             # copy cv/output/cv.pdf -> public/cv.pdf (no Docker; CI runs this)
bun run cv:image               # rebuild the LaTeX Docker image (after Dockerfile edits)
bun run apps:bundle            # clone + build bundled apps into dist/apps/<slug>/ (end of build)
bun run deploy                 # cv:build && build && wrangler deploy — REPLACES the live site
```

Run `bun run check` before `bun run build` — a content schema violation then
fails fast with a clear message instead of midway through a build.

## Non-obvious constraints

Every one of these has already caused a failure. Each is load-bearing.

**`client:*` directives are resolved at compile time.** A component supplied
through the MDX `components` map, or pulled from `import.meta.glob` and passed
via props, *cannot* carry one — it fails with `NoMatchingImport`. Wrap it in an
`.astro` component that applies the directive statically. This is why
`Plot.astro` wraps the chart island, and why each internal app needs its own
entrypoint page.

**The website must never use SPA fallback.** `wrangler.jsonc` sets
`not_found_handling: "404-page"`. Setting `single-page-application` would turn
every typo into a 200 rendering the homepage — invisible to users and to search
engines. SPA fallback belongs to *apps* only (D10).

**App slugs must not prefix one another.** The Cloudflare route `/apps/<slug>*`
also captures `/apps/<slug>anything`, so `calc` would silently swallow
`calculator`. Enforced at build time in `src/lib/apps.ts`.

**`bun run build` clones and builds the bundled apps (D12).** After
`astro build`, `scripts/bundle-apps.sh` clones every repository in
`src/data/bundled-apps.json`, runs its `build:portfolio` script, and copies the
output into `dist/apps/<slug>/`. So a build needs network access, and those
repositories must be public. `USE_LOCAL_APPS=1 bun run build` builds the sibling
checkouts (`../<repo name>`) instead, which is how to preview an unpushed app
change. `bun dev` does not serve bundled apps. `bun run dev:all` serves them
live from those sibling checkouts (§14); `bun run build && bun run preview`
serves the built output.

**Never put HMR or proxy settings in `astro.config.mjs`.** `bun dev` on
`localhost:4321` must keep working without Caddy. Behind the proxy Vite already
derives the right `wss://` socket from the page URL, and it admits
`*.localhost` hosts by default, so the old `hmr.clientPort: 443` recipe is not
needed — and it would break HMR in plain `bun dev` (§14).

**`devOnly: true` removes something from production in THREE places, and all
three are needed.** `src/lib/content.ts` and `src/lib/apps.ts` drop the entry
from every list; `plugins/dev-only-apps.mjs` deletes the emitted `/apps/<slug>`
page and filters it out of the sitemap. The third exists because a file under
`src/pages` is a route unconditionally — `output: 'static'` has no per-page
opt-out — so before it, a dev-only app still shipped as a real, indexed URL.
The integration imports the same `meta.ts` files `apps.ts` reads, so the flag
has one home; that is also why `meta.ts` must stay free of runtime imports.

**`DevRibbon.astro` styles itself with `is:inline` + `set:html`, not a scoped
`<style>`.** Scoped CSS is collected from the module graph, not from what
actually rendered, so a component that returns nothing in production still
ships its rules — measured inlined into every page's `<head>`. `is:inline`
stays where it is written, so when the markup is gone the CSS is gone too. The
cost is that the rules are global and repeat per ribbon, which is why both
class names are prefixed.

**Never put `slug`, `uri`, `fullUrl`, or `readingTime` in frontmatter.** They
are derived in `src/lib/content.ts`. Stored URLs drift from their own files.

**Social preview images must be absolute-URL JPEGs.** `src/lib/seo.ts` re-encodes
every `og:image` to a 1200×630 JPEG and resolves it against `Astro.site`. Astro's
default WebP output is rejected by WhatsApp, and a root-relative path is dropped
by every scraper — both fail silently, showing a preview with text but no image.

**Charts must not use React.** ECharts is imperative; a React host measured
59 KB gz of pure overhead. The island is vanilla — `src/lib/plot-client.ts`.

**Never `await import('echarts/…')` directly.** Importing a namespace defeats
tree-shaking — it dragged GeoJSON parsing into a line chart. Add chart types to
`src/lib/echarts-bundle.ts` (static named imports), which is *then* dynamically
imported.

**Images are emitted as JPEG, not WebP.** Astro hardcodes WebP as its default
output format, so `src/lib/image-service.ts` wraps the sharp service and sets
`format` before delegating. Deliberate, and it costs real bytes — measured at
+91% (+187 KB) across this site's images versus WebP. The reason is
compatibility outside the browser: scrapers, embeds, and anything that saves an
image and opens it elsewhere. `format` is still a per-image prop — a hard-edged
diagram or screenshot usually wants `format="png"`, since JPEG rings around
sharp boundaries. SVG is passed through untouched.

**Assets are referenced as `~assets/<path>`, resolved by
`plugins/assets-resolver.mjs`.** `~assets/a/b.png` is `src/assets/a/b.png` from
any file — frontmatter, markdown, or an `import`. It is a Vite `resolveId` hook
rather than `resolve.alias` on purpose: an alias is a prefix substitution, so
`'~assets'` would also capture `~assets-archive/…`. The resolver requires the
separator, refuses to escape `src/assets`, and fails the build naming the
importer. `tsconfig.json`'s `paths` mirrors it for `astro check` ONLY — the
build never reads it, so the two must be kept in agreement.

**Only images become build assets.** Astro's markdown pipeline collects `image`
nodes, not link hrefs, so `[doc](~assets/x.pdf)` would emit no file and 404.
The resolver leaves hrefs alone; non-image downloads belong in `public/`.

**Keep `tsconfig.json`'s `mdx.plugins` in sync with `astro.config.mjs`'s
`remarkPlugins`.** Two separate parsers, two configs, nothing enforcing
agreement. Out of sync, the editor reports phantom acorn errors on valid LaTeX.

## Conventions

- **Astro components for anything static.** Reach for a framework island only
  when there is genuine interactivity, and use the lightest directive that
  works: `client:visible` > `client:idle` > `client:load`.
- **Only theme-contract CSS custom properties** — `--bg`, `--fg`, `--muted`,
  `--border`, `--surface`, `--accent`, `--chart-1..6`. Never hardcode a colour;
  it will not survive a theme switch (§12).
- **Compose from the design system, do not restyle.** `src/components/ui/` owns
  every shared visual decision. A page or feature component should reach for
  `Container`, `Section`, `Card`, `Button`, `Tag`, `Badge`, `Grid` — not invent
  its own padding, radius, or hover treatment. Variants live in
  `src/components/ui/types.ts`; adding one is a line there plus a rule in that
  component's scoped `<style>`. If a change needs more than that, it is a new
  component, not a new flag.
- **Never write a raw number in CSS.** Space, radius, type size, duration, and
  container width all come from the scale tokens in `src/styles/tokens.css`.
  That scale is what makes a global adjustment one edit instead of a grep.
- **Pages use `PageLayout`, not `Base`.** `Base` is the bare document shell;
  reaching for it directly opts the page out of the site navigation, which only
  an embedded app has a reason to do (`AppShell`).
- **Copy lives in `src/data/`, not in markup.** `site.ts` (identity, nav,
  socials), `profile.ts` (hero, about, skills), `resume.ts`. A page that
  hardcodes a name or a nav label has put a second source of truth in the
  codebase.
- **No animation.** Deliberate — the Molecular design's WebGL particle field,
  scroll reveals, and hover lifts were all removed. The only transitions
  permitted are short colour/border state feedback on hover and focus. Nothing
  moves, so nothing shifts under a reader. See the motion policy in
  `src/styles/base.css`.
- **Mobile first.** Author the small-screen layout as the base and add
  `min-width` media queries. Prefer intrinsic responsiveness (`Grid`'s
  `auto-fit`, `clamp()` type, a fluid `--gutter`) over breakpoints — it is what
  makes rotation and window-drag continuous rather than stepped.
- **Blog and projects share one substrate** (D5). A change to one usually
  belongs in the shared layer (`src/lib/content.ts`, `EntryList.astro`), not
  duplicated into both.
- **Prefer failing the build over rendering something wrong.** Several
  build-time guards exist for exactly this. Add more rather than fewer.

## Skills

Repo-specific workflows live in `.claude/skills/`:

- **`add-content`** — adding a blog post or a project
- **`add-app`** — adding an app, internal or external

## Layout

```
src/
├── apps/<slug>/        internal apps (meta.ts + App.tsx) — auto-listed
├── components/
│   ├── ui/             the design system: Container, Section, Card, Button,
│   │                   Tag, Badge, Grid, Timeline, PageHeader, StatGrid,
│   │                   SkillList, Eyebrow + types.ts (variant vocabulary)
│   ├── chrome/         SiteHeader, SiteFooter, ThemeToggle
│   ├── content/        EntryCard, AppList, TagFacets
│   ├── mdx/            the MDX override map (§8)
│   └── EntryList.astro shared list for blog + projects (D5)
├── content/            blog/ and projects/ .mdx
├── data/               site.ts, profile.ts, resume.ts, apps.json — ALL copy
├── layouts/            Base (document shell) → PageLayout (site chrome)
│                       → Post; AppShell for embedded apps
├── lib/                content.ts, apps.ts, theme.ts, seo.ts, mobile-nav.ts,
│                       plot-client.ts
├── pages/              routes
└── styles/             tokens.css (contract + scale), base.css (elements),
                        prose.css (MDX output), fonts.css (self-hosted)
public/fonts/           Inter + JetBrains Mono, variable, latin subsets
cv/output/cv.pdf        COMMITTED build artefact (CI has no Docker step)
public/cv.pdf           derived from it by cv/publish.sh; git-ignored
src/assets/portrait.jpg optional; src/lib/portrait.ts resolves it via
                        import.meta.glob so the site builds without one
cv/                     LaTeX resume — see cv/README.md. No TeX on the host;
                        latexmk runs in the afshin-cv-latex image.
plugins/                build-time Vite plugins (assets-resolver.mjs)
docs/architecture.md    ← source of truth
```

## Warnings that are not bugs

- `bun run build` warns a chunk exceeds 500 kB. That is `echarts-bundle`,
  lazily loaded on scroll. Expected.
- The build emits a React client chunk even when no page references it, because
  `@astrojs/react` is installed. It is an orphan and is never served.
- `wrangler deploy` warns `workers_dev` will be disabled. Desired — it prevents
  a duplicate copy of the site appearing at `*.workers.dev`.

## Reference

Astro docs: https://docs.astro.build — [routing](https://docs.astro.build/en/guides/routing/),
[content collections](https://docs.astro.build/en/guides/content-collections/),
[framework components](https://docs.astro.build/en/guides/framework-components/).
