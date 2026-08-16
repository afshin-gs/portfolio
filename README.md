# iamafshin.me

Personal site — portfolio, resume, blog, and a launcher for small interactive
web apps. Static output, hosted on Cloudflare Workers. No server, no database,
no runtime cost.

**Live:** https://iamafshin.me · **Design reference:** [`docs/architecture.md`](docs/architecture.md)

## Stack

| | |
|---|---|
| Framework | Astro 7, `output: 'static'` |
| Content | MDX + content collections, Zod-validated frontmatter |
| Markdown | remark/rehype — KaTeX math, Shiki dual-theme code, callouts, autolinked headings |
| Charts | Apache ECharts, vanilla island, lazy-loaded on scroll |
| Apps | Internal (React, in this repo) or external (own repo, own Worker) |
| Hosting | Cloudflare Workers static assets, one Worker per property |
| Runtime cost | $0 |

## Quick start

```bash
bun install
bun dev            # http://localhost:4321
```

| Command | |
|---|---|
| `bun dev` | Dev server on :4321 |
| `bunx astro dev --background` | Same, detached (`stop` / `status` / `logs`) |
| `bun run build` | Build to `dist/` |
| `bun run check` | Types + content schema validation |
| `bun run preview` | Serve the built output locally |
| `bun run deploy` | Build and deploy — **replaces the live site** |

## Layout

```
src/
├── apps/<slug>/           internal apps: meta.ts + App.tsx (auto-listed on /apps)
├── assets/                images processed at build time
├── components/
│   ├── mdx/               the MDX override map — Callout, Plot, ZoomableImage, …
│   └── EntryList.astro    shared card list for blog + projects
├── content/
│   ├── blog/              *.mdx
│   └── projects/          *.mdx
├── content.config.ts      collection schemas
├── data/apps.json         external app registry
├── layouts/               Base, Post, AppShell
├── lib/
│   ├── content.ts         collection queries + derived values
│   ├── apps.ts            app registry + build-time guards
│   ├── theme.ts           theme contract
│   ├── plot-client.ts     ECharts island
│   └── echarts-bundle.ts  tree-shaken ECharts (add chart types here)
├── pages/                 routes
└── styles/tokens.css      CSS custom properties — the theme contract
docs/architecture.md       source of truth
```

## Routes

| Route | |
|---|---|
| `/` | Landing |
| `/blog`, `/blog/<slug>`, `/blog/tag/<tag>` | Blog + prerendered tag facets |
| `/projects`, `/projects/<slug>`, `/projects/tag/<tag>` | Projects (same substrate, different presentation) |
| `/apps`, `/apps/<slug>` | App launcher and internal apps |
| `/blog/index.json`, `/projects/index.json` | Build-time search indexes |
| `/404`, `/sitemap-index.xml` | |

## Content

Posts and projects are `.mdx` files with Zod-validated frontmatter. **A missing
or mistyped field fails the build** — that is what makes the collections a
trustworthy registry rather than a convention that drifts.

Posts are ~95% ordinary markdown and round-trip to Obsidian. Components are
injected at render time, so **no import statements are needed in a post**:

```mdx
<Callout type="warning">Never imported — supplied by the override map.</Callout>

<Plot height={340} caption="…" option={{ /* ECharts option */ }} />
```

Element overrides mean plain markdown routes through custom components too —
every `![alt](src)` renders via `ZoomableImage`, so adding a lightbox later
updates every existing post without editing one.

Two visibility flags, deliberately distinct:

- `draft: true` — not written yet. Excluded from production, visible in `bun dev`.
- `isActive: false` — retired. Excluded from lists, RSS, and search, but the
  detail route still builds so shared links never 404.

A project with an **empty body** renders as a list-only card with no detail
route. Write a body and it gains one automatically.

## Apps

Two ways to exist, both listed together on `/apps`:

- **External** *(primary)* — own repo, own Worker, own route `iamafshin.me/apps/<slug>*`.
  Declared in `src/data/apps.json`; that file is the entire coupling between
  this repo and every app repo.
- **Internal** — lives in `src/apps/<slug>/`, auto-discovered. Needs a
  ~6-line entrypoint at `src/pages/apps/<slug>.astro`, because Astro resolves
  hydration directives at compile time.

Build-time guards reject invalid slugs, slug prefix collisions, directory/slug
mismatches, and internal apps missing their route.

## Deploying

```bash
bun run deploy
```

Deploys as the Cloudflare Worker `iamafshin`, which already holds the apex
custom domain — so there is no DNS change and no downtime window, but the
deploy **replaces what is currently live**. Roll back with `bunx wrangler rollback`.

`.github/workflows/deploy.yml` is ready for push-to-deploy and needs a git
remote plus two repo secrets: `CLOUDFLARE_API_TOKEN` (scoped to *Workers
Scripts: Edit*) and `CLOUDFLARE_ACCOUNT_ID`.

## For agents

See [`AGENTS.md`](AGENTS.md) and the skills in `.claude/skills/`
(`add-content`, `add-app`).

## Status

Built: content pipeline, blog and projects with tag facets, search-index
endpoints, ECharts island, theme contract, `/apps` with one internal app.

Not yet built: the filter/search island, theme toggle UI, RSS, `/about-me`,
`/resume`.

## License

Source is public. Content (posts, images, resume) is not licensed for reuse.
