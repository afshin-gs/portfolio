import Callout from './Callout.astro'
import ScrollableTable from './ScrollableTable.astro'
import SmartLink from './SmartLink.astro'
import ZoomableImage from './ZoomableImage.astro'
import Plot from './Plot.astro'

/**
 * docs/architecture.md §8 — the component override map.
 *
 * Passed to <Content components={mdxComponents} /> at render time, which means
 * posts use these with NO import statement. A .mdx file stays ~95% ordinary
 * markdown that round-trips to Obsidian.
 *
 * Two kinds of entry:
 *
 *   Named    <Callout>, <Plot> — explicit components an author writes.
 *   Element  img/a/table — override how PLAIN MARKDOWN renders, across every
 *            post, past and future. Changing ZoomableImage to add pan/zoom
 *            updates 40 existing posts without touching one of them.
 */
export const mdxComponents = {
  // Named
  Callout,
  Plot,

  // Element overrides
  img: ZoomableImage,
  a: SmartLink,
  table: ScrollableTable,
}

export { Callout, Plot, ScrollableTable, SmartLink, ZoomableImage }
