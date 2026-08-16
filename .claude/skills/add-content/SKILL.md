---
name: add-content
description: Add a blog post or a project entry to iamafshin.me. Use when the user wants to write, draft, publish, or scaffold a post, article, project entry, case study, or writeup — or asks to add something to /blog or /projects. Covers frontmatter, MDX components, math, charts, images, and verification.
---

# Adding a blog post or project

Blog and projects share one technical substrate (D5) and differ only in schema
and presentation. This skill covers both.

## 1. Ask first — do not guess

**Blog or project?** They are not interchangeable:

- **Blog** — writing. Something you have to *say*. Requires a banner image.
- **Project** — something you *built*. Has `status` and `stack`; the body is
  optional.

Then gather, asking only for what you cannot infer:

| Field | Notes |
|---|---|
| `title` | |
| `excerpt` | ≤ 200 chars, hard limit. Shown on cards and in search |
| `date` | Default to today unless told otherwise |
| `tags` | Check existing tags first (below) and reuse rather than inventing near-duplicates |
| `slug` | Derived from filename. Confirm it — it is the permanent URL |
| **blog:** `banner` + `bannerAlt` | **Required.** Ask for an image; do not invent one. It is also the social-share preview image (cropped to 1200×630), so prefer something ≥1200px wide with the subject near the centre. `bannerAlt` becomes `og:image:alt` — write it for a reader who cannot see the image, not as a filename restatement |
| **project:** `status` | `active` \| `wip` \| `archived` |
| **project:** `stack`, `repo` | Optional |
| **project:** body? | Empty body = list-only card, no detail page. Ask |

Reuse existing tags:

```bash
grep -h '^tags:' src/content/blog/*.mdx src/content/projects/*.mdx | sort -u
```

**If the user has draft text already, ask for it rather than writing filler.**
Never invent biographical claims, project outcomes, technical results, or
metrics. If content is missing, scaffold the structure and leave a clearly
marked `TODO` rather than fabricating.

## 2. Create the file

`src/content/blog/<slug>.mdx` or `src/content/projects/<slug>.mdx`.

```mdx
---
title: Post title
excerpt: One or two sentences, 200 characters maximum.
date: 2026-07-26
tags: [astro, mdx]
draft: true
banner: ~assets/<image>.png         # blog only, required
bannerAlt: Describe the image       # blog only, required
---

Body starts here.
```

Project frontmatter instead uses:

```yaml
status: active          # required
stack: [React, Vite]
repo: https://github.com/…
app: calculator         # optional — slug in src/data/apps.json
```

**Start with `draft: true`.** Drafts are excluded from production builds but
visible in `bun dev`. Remove it to publish.

### Do NOT add these

`slug`, `uri`, `fullUrl`, `readingTime` are derived at build time
(`src/lib/content.ts`). Frontmatter copies drift from the file they describe.

### Visibility

- `draft: true` — not written yet. Hidden in production, visible in dev.
- `isActive: false` — retired. Hidden from lists/RSS/search, but the detail
  route still builds so existing links never 404.

## 3. Write the body

**No import statements.** Components are injected at render time (§8).

Escalate only as far as needed: plain markdown → remark directive → MDX
component. Plain markdown and directives stay valid in Obsidian; MDX components
do not.

Available with no import:

```mdx
<Callout type="note|tip|warning|danger" title="Optional">…</Callout>

<Plot height={340} caption="Describe the chart — canvas is opaque to screen readers."
      option={{ /* ECharts option, no styling — theme is injected */ }} />
```

Plain markdown also routes through overrides: `![alt](src)` → `ZoomableImage`
(build-time AVIF/WebP + srcset), links → `SmartLink`, tables → scroll container.

Math renders at build time, zero JS: `$E = mc^2$` inline, `$$…$$` display.

Code blocks are Shiki dual-theme and follow the theme switch with no JS.

### Two traps

**Stray `{` or `<` in prose breaks the build** (R3). MDX reads them as
JavaScript. Escape as `\{` or wrap in backticks. This fails loudly at build
time — it is never a silent bug.

**Images go in `src/assets/`, not `public/`.** Only `src/` images get optimised
and given a `srcset`. Output is **JPEG** (not WebP) — see `src/lib/image-service.ts`.
For a screenshot, chart, or line diagram, pass `format="png"`: JPEG rings around
hard edges and often ends up larger for flat-colour graphics.

**Reference them with `~assets/`, never a relative path.** `~assets/foo.png` is
`src/assets/foo.png`, and `~assets/diagrams/foo.png` is
`src/assets/diagrams/foo.png` — from any file, at any depth. `../../assets/…`
still resolves, but it encodes where the post happens to sit, so moving or
nesting a post silently breaks every image in it.

Works in frontmatter (`banner:`), in markdown (`![alt](~assets/foo.png)`), and
in `import` statements. A path with a space needs angle brackets in markdown:
`![alt](<~assets/my folder/foo.png>)`.

**Files that are not images go in `public/`,** e.g. `public/files/notes.pdf`
linked as `/files/notes.pdf`. Astro's markdown pipeline only turns *images*
into build assets — a link to `~assets/notes.pdf` would resolve to nothing and
404, so the resolver deliberately leaves link hrefs alone.

**Adding a new chart type** (pie, scatter, …) requires registering it in
`src/lib/echarts-bundle.ts` as a *static named import*. It will silently fail to
render otherwise.

## 4. Verify

```bash
bun run check     # schema + types — MUST pass
bun run build
```

`check` failing with `<field>: Required` means frontmatter is wrong. That is the
schema doing its job — fix the file, never the schema.

Then confirm the output rather than assuming:

```bash
# route exists (projects: only if the body is non-empty)
ls dist/blog/<slug>/index.html

# appears in the search index
python3 -c "import json;print([r['slug'] for r in json.load(open('dist/blog/index.json'))])"

# math actually rendered, if used
grep -c 'katex' dist/blog/<slug>/index.html

# new tags produced facet routes
ls dist/blog/tag/

# social preview — og:image must be an absolute https URL ending .jpeg/.jpg,
# not a relative path and not .webp, or Telegram/WhatsApp/Facebook show a
# text-only card (docs §18)
grep -oE '<meta property="og:[^>]*>' dist/blog/<slug>/index.html
```

Finally `bun dev` and view the page — charts and images need eyes, not grep.

## 5. Report back

Tell the user:

- the URL it will live at
- whether it is still `draft: true` (it will **not** appear in production)
- any new tag facet routes created
- anything left as `TODO`

Do **not** run `bun run deploy` unless explicitly asked. It replaces the live
site.
