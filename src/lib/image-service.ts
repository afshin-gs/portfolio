import sharpService from 'astro/assets/services/sharp'
import type { LocalImageService } from 'astro'

/**
 * The site's image service: **JPEG by default, not WebP.**
 *
 * WHY A SERVICE AND NOT A PROP ON EACH `<Image>`
 * Astro hardcodes WebP as the default output format — `resolveDefaultOutputFormat`
 * in `assets/utils/inferSourceFormat.js` returns a constant, and there is no
 * `image.format` config to point at. Setting `format="jpeg"` on every call site
 * works until someone adds the next `<Image>` and silently gets WebP back. This
 * makes it a policy the build enforces rather than a convention to remember.
 *
 * WHY IT SETS THE FORMAT *BEFORE* DELEGATING
 * The base service fills `format` in only when it is absent. Assigning first
 * means an explicit `format="png"` (or the `format: 'jpeg'` the social card in
 * `src/lib/seo.ts` already passes) still wins, and we never have to guess after
 * the fact whether "webp" was chosen by the author or by the default.
 *
 * TRADE-OFF, RECORDED SO IT IS NOT REDISCOVERED
 * JPEG is roughly 25–35% larger than WebP at matched quality, and WebP is
 * supported by every browser this site targets. The bytes are the price of
 * universal compatibility outside the browser — scrapers, embeds, and anything
 * that saves an image and opens it elsewhere. mozjpeg below claws back ~10%.
 *
 * `format` is still a per-image prop: a screenshot or a line diagram with hard
 * edges will look better and often compress smaller as `format="png"`, because
 * JPEG's DCT rings around sharp boundaries.
 */

/**
 * SVG is passed through, never rasterised.
 *
 * The base service maps an SVG source to an SVG output, and the sharp service
 * refuses to rasterise one unless `dangerouslyProcessSVG` is set. Forcing JPEG
 * here would turn a crisp, tiny vector into a blurry raster — and would throw
 * outright on the icons this site ships.
 */
function isSvg(src: unknown): boolean {
  if (typeof src === 'string') return src.split('?')[0]!.toLowerCase().endsWith('.svg')
  return (src as { format?: string } | null)?.format === 'svg'
}

const service: LocalImageService = {
  ...sharpService,

  validateOptions(options, imageConfig) {
    if (!options.format && !isSvg(options.src)) {
      options.format = 'jpeg'
    }
    return sharpService.validateOptions!(options, imageConfig)
  },
}

export default service
