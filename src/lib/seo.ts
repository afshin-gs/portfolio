import { getImage } from 'astro:assets'
import { site } from '../data/site'

/**
 * Social preview (Open Graph / Twitter Card) metadata.
 *
 * WHY THIS FILE EXISTS: Telegram, WhatsApp, Facebook, LinkedIn, Slack, Discord
 * and X all scrape the same handful of `<meta>` tags, but each of them fails
 * differently when a tag is missing or subtly wrong. The rules below are the
 * intersection of what all of them need — encoded once here rather than
 * re-derived per page:
 *
 *   ABSOLUTE URLs. `og:image` MUST be a fully-qualified `https://` URL. Every
 *   scraper runs off-origin with no document base, so a root-relative `/x.jpg`
 *   is silently dropped — the single most common reason a preview shows text
 *   but no picture.
 *
 *   JPEG, NOT WebP/AVIF. Astro's default output format is WebP, which WhatsApp
 *   and several older scrapers refuse. Every social image is re-encoded to
 *   baseline JPEG regardless of the source format.
 *
 *   1200×630. The 1.91:1 box Facebook/LinkedIn/X render at, and the frame the
 *   others crop from. Banners are `cover`-cropped INTO it rather than letterboxed,
 *   so a portrait banner does not arrive as a sliver floating in grey.
 *
 *   DECLARED DIMENSIONS. `og:image:width`/`height` let a scraper lay out the
 *   card on the FIRST fetch. Without them Facebook and Telegram render a
 *   text-only preview once, cache it, and only show the image to whoever shares
 *   the link second.
 *
 * Not covered here: scraper caches. Once Telegram or Facebook has fetched a URL
 * it keeps the result for a long time, so fixing a preview after the fact needs
 * a manual re-scrape — see the runbook in docs/architecture.md §18.
 */

/** The 1.91:1 box every platform renders. */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/**
 * Site-wide fallback card, for pages with no banner of their own. A static
 * 1200×630 JPEG in `public/` — deliberately NOT run through the image pipeline,
 * so its URL is stable across builds and already-cached scrapes stay valid.
 *
 * The alt text describes what is DRAWN on the card. Keep the two in sync if the
 * card is ever redrawn.
 */
const DEFAULT_IMAGE = '/og-default.jpg'
const DEFAULT_IMAGE_ALT = `${site.name}: Chemical Engineering | Biology | Technology`

export interface SocialImage {
  url: string
  width: number
  height: number
  /** MIME type. Some scrapers use it to decide whether to bother fetching. */
  type: string
  alt: string
}

/** `og:type`. `article` unlocks the published/modified/tag fields below. */
export type SocialType = 'website' | 'article'

export interface SocialMeta {
  type: SocialType
  title: string
  description: string
  canonical: string
  image: SocialImage
  publishedTime?: string
  modifiedTime?: string
  tags: string[]
}

export interface SocialInput {
  /** Resolved page title, site suffix already applied. */
  title: string
  description: string
  /** The page's own URL, absolute. */
  canonical: string
  type?: SocialType
  /**
   * A content-collection image (`banner`). A bare string is treated as a path
   * already inside `public/` and used as-is — it is NOT run through the image
   * pipeline, so it must already be a JPEG/PNG at 1200×630.
   */
  image?: ImageMetadata | string
  imageAlt?: string
  date?: Date
  updated?: Date
  tags?: readonly string[]
}

/**
 * Turns a banner into a scraper-safe absolute image URL.
 *
 * `fit: 'cover'` + `position: 'attention'` crops to the OG box around the
 * highest-entropy region rather than the geometric centre, which keeps the
 * subject of a wide photo in frame instead of slicing it in half.
 */
async function resolveImage(
  image: ImageMetadata | string | undefined,
  alt: string | undefined,
  base: URL,
): Promise<SocialImage> {
  if (!image || typeof image === 'string') {
    return {
      url: new URL(image ?? DEFAULT_IMAGE, base).href,
      width: OG_WIDTH,
      height: OG_HEIGHT,
      type: 'image/jpeg',
      alt: alt ?? DEFAULT_IMAGE_ALT,
    }
  }

  const generated = await getImage({
    src: image,
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fit: 'cover',
    position: 'attention',
    format: 'jpeg',
    // 82 keeps a photographic banner comfortably under the ~600 KB ceiling
    // WhatsApp applies before it gives up and shows a text-only preview.
    quality: 82,
  })

  return {
    url: new URL(generated.src, base).href,
    width: OG_WIDTH,
    height: OG_HEIGHT,
    type: 'image/jpeg',
    alt: alt ?? DEFAULT_IMAGE_ALT,
  }
}

export async function buildSocialMeta(
  input: SocialInput,
  base: URL,
): Promise<SocialMeta> {
  return {
    type: input.type ?? 'website',
    title: input.title,
    description: input.description,
    canonical: input.canonical,
    image: await resolveImage(input.image, input.imageAlt, base),
    publishedTime: input.date?.toISOString(),
    modifiedTime: (input.updated ?? input.date)?.toISOString(),
    tags: [...(input.tags ?? [])],
  }
}
