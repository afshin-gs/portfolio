import externalRaw from '../data/apps.json'
import bundledRaw from '../data/bundled-apps.json'

/**
 * docs/architecture.md §5, §11 — the /apps registry.
 *
 * An app can exist three ways. All appear in one merged, sorted list, and /apps
 * renders whatever this returns — nothing is hand-maintained in the page.
 *
 *   EXTERNAL (primary — D2)
 *     Its own repo, its own Worker, its own route iamafshin.me/apps/<slug>*.
 *     The website has NO build-time access to it, so it cannot be discovered —
 *     it must be declared in src/data/apps.json. That one file is the entire
 *     coupling between the website and every app repo.
 *
 *   INTERNAL (the exception)
 *     Lives in this repo under src/apps/<slug>/. Fully auto-discovered by the
 *     glob below: drop a folder in with a meta.ts and it appears on /apps and
 *     gets a route. No registry edit at all.
 *
 *   BUNDLED (D12)
 *     Its own repo but no Worker. Declared in src/data/bundled-apps.json;
 *     scripts/bundle-apps.sh clones and builds it at the end of `bun run build`
 *     and copies the output to dist/apps/<slug>/, so it ships with the website.
 */

import type { ImageMetadata } from 'astro'

export type AppSource = 'external' | 'internal' | 'bundled'
export type AppStatus = 'live' | 'wip' | 'archived'

export interface AppMeta {
  slug: string
  title: string
  description: string
  tags?: string[]
  repo?: string
  status: AppStatus
  /** Shown on the card so a visitor knows what they are opening. */
  accent?: string
  /** Card image, written `~assets/apps/<file>` for a file in src/assets/apps/.
   *  Optional: a card without one has no media slot at all. A path that does
   *  not resolve fails the build (resolveThumbnail). */
  thumbnail?: string
  /** Only when the image shows something the title does not. Defaults to ""
   *  (decorative), because the card title sits directly below it and a screen
   *  reader would otherwise announce the app twice. */
  thumbnailAlt?: string
}

export interface AppRecord extends AppMeta {
  source: AppSource
  href: string
  /** External apps are separate deployments; the website cannot verify them at
   *  build time. Used to warn rather than to silently link into a 404 (R5). */
  verifiable: boolean
  /** `thumbnail`, resolved. Absent when none is set. */
  image?: ImageMetadata
}

/**
 * Thumbnails come from ONE folder, src/assets/apps/, rather than anywhere in
 * src/assets. The registries are JSON, so they cannot `import` an image; a glob
 * is how the path becomes ImageMetadata. Globbing all of src/assets would pull
 * every image on the site into this module to find a handful of card images.
 *
 * Eager for the same reason as the meta.ts glob below: getApps() stays
 * synchronous for its callers.
 */
const THUMBNAILS = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/apps/*.{png,jpg,jpeg,webp,avif,svg}',
  { eager: true },
)
const THUMBNAIL_PREFIX = '~assets/apps/'

function resolveThumbnail(app: AppMeta): ImageMetadata | undefined {
  if (!app.thumbnail) return undefined
  const file = app.thumbnail.startsWith(THUMBNAIL_PREFIX)
    ? app.thumbnail.slice(THUMBNAIL_PREFIX.length)
    : null
  const match = file ? THUMBNAILS[`../assets/apps/${file}`] : undefined
  if (!match) {
    throw new Error(
      `[apps] "${app.slug}" has thumbnail "${app.thumbnail}", which does not resolve. ` +
        `Put the image in src/assets/apps/ (png, jpg, jpeg, webp, avif or svg) ` +
        `and reference it as "${THUMBNAIL_PREFIX}<file>".`,
    )
  }
  return match.default
}

/** D10: a route pattern of `/apps/<slug>*` also captures `/apps/<slug>anything`.
 *  Two apps where one slug prefixes another would silently route into each
 *  other, so the constraint is enforced here — at build time, loudly. */
function assertNoPrefixCollisions(slugs: string[]) {
  for (const a of slugs) {
    for (const b of slugs) {
      if (a !== b && b.startsWith(a)) {
        throw new Error(
          `[apps] Slug collision: "${a}" is a prefix of "${b}". ` +
            `The Cloudflare route /apps/${a}* would capture /apps/${b}. ` +
            `Rename one (docs/architecture.md D10).`,
        )
      }
    }
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Internal apps are auto-LISTED but cannot be auto-ROUTED — Astro resolves
 * `client:*` at compile time, so each needs a static entrypoint page. That
 * makes "add a folder, forget the page" a real failure mode: the app would
 * appear on /apps linking straight to a 404.
 *
 * This turns that into a build error naming the exact missing file.
 */
function assertRoutesExist(internal: AppRecord[]) {
  // Excluding index.astro avoids a circular reference: index.astro imports
  // this module, so globbing it back produces an INEFFECTIVE_DYNAMIC_IMPORT warning.
  const pages = import.meta.glob(['../pages/apps/*.astro', '!../pages/apps/index.astro'])
  const routed = new Set(
    Object.keys(pages)
      .map((p) => p.split('/').at(-1)!.replace(/\.astro$/, '')),
  )
  for (const app of internal) {
    if (!routed.has(app.slug)) {
      throw new Error(
        `[apps] Internal app "${app.slug}" has no route. ` +
          `Create src/pages/apps/${app.slug}.astro (see AppShell.astro), ` +
          `or it will be listed on /apps linking to a 404.`,
      )
    }
  }
}

export function getApps(): AppRecord[] {
  // Internal: auto-discovered. Eager so this stays synchronous for the index.
  const modules = import.meta.glob<{ meta: AppMeta }>('../apps/*/meta.ts', {
    eager: true,
  })

  const internal: AppRecord[] = Object.entries(modules).map(([path, mod]) => {
    const dir = path.split('/').at(-2)!
    if (mod.meta.slug !== dir) {
      throw new Error(
        `[apps] Directory "src/apps/${dir}" declares slug "${mod.meta.slug}". They must match.`,
      )
    }
    return {
      ...mod.meta,
      source: 'internal' as const,
      href: `/apps/${mod.meta.slug}`,
      verifiable: true,
    }
  })

  const external: AppRecord[] = (externalRaw as AppMeta[]).map((app) => ({
    ...app,
    source: 'external' as const,
    href: `/apps/${app.slug}`,
    verifiable: false,
  }))

  // Bundled apps are built after astro build, so nothing can be checked here;
  // scripts/bundle-apps.sh fails the build instead if one does not produce
  // dist/apps/<slug>/, which is what makes the link safe to call verifiable.
  const bundled: AppRecord[] = (bundledRaw as AppMeta[]).map((app) => ({
    ...app,
    source: 'bundled' as const,
    href: `/apps/${app.slug}`,
    verifiable: true,
  }))

  const all = [...internal, ...external, ...bundled]

  for (const app of all) {
    if (!SLUG_RE.test(app.slug)) {
      throw new Error(`[apps] Invalid slug "${app.slug}" — use lowercase-kebab-case.`)
    }
    app.image = resolveThumbnail(app)
  }
  assertNoPrefixCollisions(all.map((a) => a.slug))
  assertRoutesExist(internal)

  // live first, then wip, then archived. Within each, apps WITH a thumbnail
  // come first: image cards are taller, so grouping them keeps each grid row
  // one height instead of alternating tall and short cards across the page. At
  // most one row ends up mixed. Alphabetical after that.
  const rank: Record<AppStatus, number> = { live: 0, wip: 1, archived: 2 }
  return all.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      Number(!!b.image) - Number(!!a.image) ||
      a.title.localeCompare(b.title),
  )
}
