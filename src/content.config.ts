import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
// zod imported directly — the `z` re-export from astro:content is deprecated
import { z } from 'zod'

/**
 * docs/architecture.md §7 — Content model.
 *
 * D5: blog and projects share this base. They are separate collections with
 * separate schemas so they can diverge in metadata without contorting one type,
 * but the technical substrate (renderer, filter island, cards) is shared.
 *
 * Validation runs at build time. A missing or mistyped field FAILS THE BUILD —
 * that is the property that makes this a trustworthy registry rather than a
 * convention that silently drifts.
 */
const base = z.object({
  title: z.string(),
  excerpt: z.string().max(200),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),

  /** Built, but hidden from lists/RSS/search. Detail route still resolves so
   *  existing links never 404. Distinct from `draft`. */
  isActive: z.boolean().default(true),

  /** Not written yet. Excluded from production builds entirely; visible in dev. */
  draft: z.boolean().default(false),

  /** A fixture, demo, or smoke test: something that exercises the site rather
   *  than something anyone should read. Same build behaviour as `draft` —
   *  excluded from production, visible in dev — but a separate flag because
   *  the two mean opposite things about the entry's future. A draft is meant
   *  to ship one day; this is meant never to. Dev builds mark these with a
   *  corner ribbon (DevRibbon.astro) so the difference between what is on the
   *  screen and what is on the live site is visible at a glance. */
  devOnly: z.boolean().default(false),
})

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    base
      .extend({
        /** Optional. Present → the list card shows a thumbnail; absent → the
         *  card is text-only. There is no placeholder image, because a row of
         *  identical grey squares carries no information. */
        banner: image().optional(),
        bannerAlt: z.string().optional(),
      })
      // Alt text is required WITH the image, not on its own — a11y enforced at
      // the schema level rather than left to reviewer discipline.
      .refine((d) => !d.banner || !!d.bannerAlt, {
        message: 'bannerAlt is required when banner is set',
        path: ['bannerAlt'],
      }),
})

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    base.extend({
      banner: image().optional(),
      bannerAlt: z.string().optional(),
      repo: z.string().url().optional(),
      stack: z.array(z.string()).default([]),
      status: z.enum(['active', 'wip', 'archived']),

      /** Slug in src/data/apps.json, when this project ships as a live app.
       *  One-directional and manual — D6. */
      app: z.string().optional(),

      /** Override for the derived hasDetail rule (§7). Set false to keep a long
       *  body from getting its own route. */
      detail: z.boolean().optional(),
    })
      .refine((d) => !d.banner || !!d.bannerAlt, {
        message: 'bannerAlt is required when banner is set',
        path: ['bannerAlt'],
      }),
})

export const collections = { blog, projects }
