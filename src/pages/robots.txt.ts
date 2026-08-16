import type { APIRoute } from 'astro'

/**
 * §4 — `/robots.txt`. A build-time endpoint rather than a file in `public/`
 * so the `Sitemap:` line is derived from `Astro.site` (astro.config.mjs) and
 * cannot drift from the origin the sitemap itself is generated against.
 *
 * Fully open by design: every route on this site is meant to be crawled, and
 * the only pages that should stay out of an index carry `indexable={false}`,
 * which emits `<meta name="robots" content="noindex">`. That is the correct
 * mechanism — a `Disallow` here would BLOCK the crawl and so prevent the
 * noindex from ever being read, which is the classic way a page ends up
 * indexed as a bare URL with no title.
 */
export const GET: APIRoute = ({ site }) => {
  // `site` is Astro.site. Non-null here because astro.config.mjs sets it; the
  // sitemap integration would already have failed the build if it were absent.
  const sitemap = new URL('sitemap-index.xml', site).href

  const body = `# https://iamafshin.me: everything here is public. Crawl all of it.
User-agent: *
Allow: /

Sitemap: ${sitemap}
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
