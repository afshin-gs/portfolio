import { readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * Keeps `devOnly` apps out of the PRODUCTION OUTPUT, not just out of the list.
 *
 * src/lib/apps.ts already drops them from /apps, but a file under src/pages is
 * a route unconditionally: `output: 'static'` has no per-page opt-out, and
 * nothing in the config can remove a resolved route. So without this the build
 * still emitted /apps/<slug> — unlisted and unlinked, but real, and
 * @astrojs/sitemap duly advertised it to every crawler. That is worse than
 * merely untidy: a fixture kept for developers would have been indexed as part
 * of the site.
 *
 * The slugs come from the SAME meta.ts files src/lib/apps.ts reads, imported
 * rather than pattern-matched, so there is exactly one place `devOnly: true` is
 * written. meta.ts has no runtime imports of its own (the AppMeta import is
 * type-only, and erased), which is what makes importing it from here safe.
 */
export async function devOnlyAppSlugs(appsDir = new URL('../src/apps/', import.meta.url)) {
  const entries = await readdir(fileURLToPath(appsDir), { withFileTypes: true })
  const slugs = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = new URL(`${entry.name}/meta.ts`, appsDir)
    let mod
    try {
      mod = await import(/* @vite-ignore */ metaPath.href)
    } catch (cause) {
      // Loud, not skipped: a meta.ts this cannot read is one whose devOnly flag
      // this cannot honour, and silently shipping the app is the failure mode
      // the whole integration exists to prevent.
      throw new Error(
        `[dev-only-apps] Could not load src/apps/${entry.name}/meta.ts. ` +
          `It must be importable outside Vite, so it may not import anything ` +
          `at runtime (type-only imports are fine).`,
        { cause },
      )
    }
    if (mod.meta?.devOnly) slugs.push(mod.meta.slug)
  }

  return slugs
}

/** True when `page` (an absolute URL string from @astrojs/sitemap) is one of
 *  these apps. Used as the sitemap `filter`. */
export function isDevOnlyAppUrl(page, slugs) {
  const { pathname } = new URL(page)
  return slugs.some((slug) => pathname === `/apps/${slug}` || pathname.startsWith(`/apps/${slug}/`))
}

/**
 * Deletes the emitted pages after the build. Cloudflare's
 * `not_found_handling: "404-page"` then serves a REAL 404 for the URL, which is
 * the behaviour docs §3 asks for — a soft 404 rendered at a 200 would have been
 * the easier fix and the wrong one.
 */
export function devOnlyApps(slugs) {
  return {
    name: 'dev-only-apps',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        for (const slug of slugs) {
          const target = path.join(fileURLToPath(dir), 'apps', slug)
          await rm(target, { recursive: true, force: true })
          logger.info(`removed /apps/${slug} (devOnly)`)
        }
      },
    },
  }
}
