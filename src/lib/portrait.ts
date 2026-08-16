import type { ImageMetadata } from 'astro'

/**
 * The portrait photograph, or null when there isn't one yet.
 *
 * WHY A GLOB AND NOT A PLAIN IMPORT: `import portrait from '~assets/portrait.jpg'`
 * is a build ERROR when the file is absent, which would mean the site could not
 * build until a photo existed. `import.meta.glob` resolves to an empty object
 * instead, so the two pages that render a portrait simply omit the figure and
 * everything else keeps working.
 *
 * TO ADD ONE: drop a file at `src/assets/portrait.jpg` (or .jpeg/.png/.webp).
 * Nothing else changes; the Hero and /about-me pick it up on the next build.
 * Portrait orientation, ideally 3:4 or taller, at least 840px wide, since both
 * call sites crop to 4:5 and request widths up to 840.
 *
 * The alt text lives in `src/data/profile.ts` next to the rest of the editorial
 * copy, not here.
 *
 * `eager` because there are at most one of these and both call sites need the
 * metadata (width/height) during render, not in a promise.
 */
const matches = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/portrait.{jpg,jpeg,png,webp}',
  { eager: true },
)

const first = Object.values(matches)[0]

export const portrait: ImageMetadata | null = first?.default ?? null
