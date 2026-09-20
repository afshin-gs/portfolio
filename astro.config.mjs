// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import { unified } from '@astrojs/markdown-remark'

import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeUnwrapImages from 'rehype-unwrap-images'

import { assetsResolver } from './plugins/assets-resolver.mjs'
import {
  devOnlyApps,
  devOnlyAppSlugs,
  isDevOnlyAppUrl,
} from './plugins/dev-only-apps.mjs'

// Resolved once, here, so the sitemap filter and the cleanup hook below are
// answering from the same list. See plugins/dev-only-apps.mjs.
const DEV_ONLY_APPS = await devOnlyAppSlugs()

// docs/architecture.md — D3 (static output), D4 (MDX/remark), §8 (pipeline)
export default defineConfig({
  site: 'https://iamafshin.me',
  output: 'static',

  // §4: pick one and hold it. Apps must match, or /apps/<slug> and
  // /apps/<slug>/ diverge and relative assets break.
  trailingSlash: 'never',

  integrations: [
    mdx(),
    react(),
    sitemap({ filter: (page) => !isDevOnlyAppUrl(page, DEV_ONLY_APPS) }),
    devOnlyApps(DEV_ONLY_APPS),
  ],

  image: {
    // JPEG instead of Astro's hardcoded WebP default — see the reasoning in
    // src/lib/image-service.ts. `config` is handed straight to the sharp
    // service, so these are sharp's own JPEG encoder options.
    service: {
      entrypoint: './src/lib/image-service.ts',
      config: {
        jpeg: {
          // mozjpeg recovers roughly the 10% that switching off WebP costs,
          // at the same visual quality. Slower to encode; this is a static
          // build, so that is paid once.
          mozjpeg: true,
          quality: 82,
          // Interlaced: the image resolves progressively instead of painting
          // top-to-bottom, which matters more for JPEG than it did for WebP
          // because the files are bigger.
          progressive: true,
        },
      },
    },
  },

  vite: {
    // Resolves `~assets/x.png` to `src/assets/x.png` in frontmatter, markdown,
    // and ESM imports alike. A resolver rather than `resolve.alias` — see the
    // header of plugins/assets-resolver.mjs for why the difference matters.
    plugins: [assetsResolver()],
  },

  markdown: {
    // Astro 7: plugins go through unified(), not markdown.remarkPlugins.
    // §8 — remark operates on mdast (markdown concepts), rehype on hast (HTML).
    processor: unified({
      remarkPlugins: [remarkMath, remarkDirective],
      rehypePlugins: [
        rehypeKatex,
        // Markdown wraps a lone image in <p>. A block <figure> inside <p> is
        // invalid HTML and the browser silently auto-closes the paragraph.
        rehypeUnwrapImages,
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          // `className` (hast), not `class`. SmartLink merges it through so the
          // `a` override does not clobber heading anchors.
          { behavior: 'wrap', properties: { className: ['heading-anchor'] } },
        ],
      ],
    }),
    shikiConfig: {
      // Dual themes emit CSS variables, so code blocks follow the
      // theme switch with zero JS. §8, §12.
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
})
