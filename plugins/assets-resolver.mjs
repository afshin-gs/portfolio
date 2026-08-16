// @ts-check
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolves `~assets/<path>` to `src/assets/<path>`, from anywhere.
 *
 * WHY THIS EXISTS
 * Content lives at `src/content/<collection>/<slug>.mdx`, so every reference to
 * a shared asset was `../../assets/…`. That depth is a function of where the
 * file happens to sit, which means moving a post — or nesting one in a folder —
 * silently breaks every image in it.
 *
 * WHY A resolveId HOOK AND NOT `vite.resolve.alias`
 * A Vite alias is a PREFIX SUBSTITUTION on a raw id. `'~assets'` would also
 * match `~assetsfoo`, `~assets-old/…`, and anything else that merely starts
 * with those characters — the same silent-capture failure mode that
 * `assertNoPrefixCollisions` in src/lib/apps.ts exists to prevent for app
 * routes. A resolver can require the separator, verify the file, refuse to
 * escape the assets directory, and fail loudly with the importer named.
 *
 * WHERE IT APPLIES — everywhere, which is the point:
 *   - frontmatter `image()` fields, because Astro's `createImage` resolves
 *     through `pluginContext.resolve()`, which runs this hook
 *   - markdown/MDX `![alt](~assets/x.png)`, which Astro turns into an import
 *   - `import x from '~assets/x.png'` in .astro, .ts, and MDX
 *
 * NOT links. `[doc](~assets/notes.pdf)` is left alone on purpose: Astro's
 * markdown pipeline only collects `image` nodes, so an anchor href is never
 * turned into an import and no file would be emitted. Rewriting it here would
 * produce a confident-looking href pointing at nothing. Put downloadable files
 * in `public/` and link them by URL.
 *
 * @param {{ root?: URL }} [options]
 * @returns {import('vite').Plugin}
 */
export function assetsResolver(options = {}) {
  const PREFIX = '~assets'
  // The separator is part of the prefix, so `~assetsfoo` cannot match.
  const MATCH = `${PREFIX}/`

  const assetsRoot = fileURLToPath(options.root ?? new URL('../src/assets/', import.meta.url))

  return {
    name: 'afshin:assets-resolver',
    // Ahead of vite:resolve, which would otherwise try to treat `~assets/…` as
    // a bare module specifier and fail before this ever runs.
    enforce: 'pre',

    async resolveId(source, importer, resolveOptions) {
      if (!source.startsWith(PREFIX)) return null

      const from = importer ? ` (imported from ${importer})` : ''

      if (!source.startsWith(MATCH)) {
        throw new Error(
          `[assets] "${source}" is not a valid asset reference${from}. ` +
            `The prefix is "${MATCH}" — the slash is required, so that a path ` +
            `like "~assets-archive/x.png" is never silently captured.`,
        )
      }

      // Astro appends a query when it turns a markdown image into an import
      // (`?astroContentImageFlag&importer=…`). Split it off before touching the
      // path, and put it back untouched — dropping it would strip the flag that
      // tells the image pipeline this came from content.
      const rest = source.slice(MATCH.length)
      const queryAt = rest.search(/[?#]/)
      const rawPath = queryAt === -1 ? rest : rest.slice(0, queryAt)
      const query = queryAt === -1 ? '' : rest.slice(queryAt)

      if (!rawPath) {
        throw new Error(`[assets] "${source}" names no file${from}.`)
      }

      // Markdown percent-encodes spaces, so "my folder/x.png" arrives as
      // "my%20folder/x.png". Decode before hitting the filesystem — but only if
      // it decodes cleanly, since a literal "%" in a filename is legal.
      let relative = rawPath
      try {
        relative = decodeURIComponent(rawPath)
      } catch {
        /* not valid percent-encoding — take the path as written */
      }

      const target = path.resolve(assetsRoot, relative)

      // `..` must not climb out of src/assets. Compare against the directory
      // WITH its trailing separator, or "src/assets-private" would pass a
      // naive startsWith check on "src/assets".
      if (!target.startsWith(assetsRoot)) {
        throw new Error(
          `[assets] "${source}" resolves outside src/assets${from}. ` +
            `Asset references may not escape the assets directory.`,
        )
      }

      if (!existsSync(target) || !statSync(target).isFile()) {
        throw new Error(
          `[assets] "${source}" does not exist${from}.\n` +
            `  Looked for: ${target}\n` +
            `  Paths are relative to src/assets — "~assets/a/b.png" is "src/assets/a/b.png".`,
        )
      }

      // Hand the real path back through the pipeline rather than returning it
      // as final. Astro's image handling lives in later resolve/load hooks;
      // short-circuiting here would resolve the file but skip the optimisation
      // that makes it a srcset instead of a raw copy.
      const resolved = await this.resolve(target + query, importer, {
        ...resolveOptions,
        skipSelf: true,
      })

      return resolved ?? `${target}${query}`
    },
  }
}
