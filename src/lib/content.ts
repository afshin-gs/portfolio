import { getCollection, type CollectionEntry } from 'astro:content'

export type ContentCollection = 'blog' | 'projects'
export type Entry = CollectionEntry<'blog'> | CollectionEntry<'projects'>

/**
 * docs/architecture.md §7 — "Derived, not stored".
 *
 * slug / uri / fullUrl / readingTime / hasDetail are computed here and are
 * deliberately NOT frontmatter fields. Storing them invites drift between a
 * file and its own metadata.
 */
const SITE = 'https://iamafshin.me'
const WORDS_PER_MINUTE = 220

export interface Derived {
  slug: string
  uri: string
  fullUrl: string
  readingTime: number
  hasDetail: boolean
}

export function derive(entry: Entry, collection: ContentCollection): Derived {
  const slug = entry.id
  const uri = `/${collection}/${slug}`
  const body = entry.body ?? ''
  const words = body.trim().split(/\s+/).filter(Boolean).length

  // A project with an empty body is a list-only card. Write a body and it
  // gains a detail page automatically — presence of content IS the signal.
  // `detail: false` in frontmatter overrides.
  const explicit = 'detail' in entry.data ? entry.data.detail : undefined
  const hasDetail = explicit ?? body.trim().length > 0

  return {
    slug,
    uri,
    fullUrl: `${SITE}${uri}`,
    readingTime: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    hasDetail,
  }
}

export type Item<C extends ContentCollection> = {
  entry: C extends 'blog' ? CollectionEntry<'blog'> : CollectionEntry<'projects'>
} & Derived

/**
 * The single read path for both collections.
 *
 * - `draft` entries are excluded from production builds, visible in dev.
 * - `isActive: false` entries are excluded from LISTS (and RSS/search) but must
 *   still build their detail route, so previously-shared links never 404.
 *   Pass `includeInactive` when generating routes.
 */
export async function getItems<C extends ContentCollection>(
  collection: C,
  opts: { includeInactive?: boolean } = {},
): Promise<Item<C>[]> {
  const entries = await getCollection(collection, ({ data }) => {
    if (data.draft && import.meta.env.PROD) return false
    if (!opts.includeInactive && !data.isActive) return false
    return true
  })

  return entries
    .map((entry) => ({ entry, ...derive(entry as Entry, collection) }) as Item<C>)
    .sort((a, b) => b.entry.data.date.valueOf() - a.entry.data.date.valueOf())
}

/** Tag facets for prerendered /blog/tag/<tag> and /projects/tag/<tag> routes (§10). */
export async function getTags(collection: ContentCollection) {
  const items = await getItems(collection)
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.entry.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Shape shipped to the client for the filter/search island (§10). */
export interface IndexRecord {
  slug: string
  /** null when the entry has no detail route (§7 hasDetail). The filter island
   *  must render these as unlinked cards — linking them would 404. */
  uri: string | null
  title: string
  excerpt: string
  tags: string[]
  date: string
  readingTime: number
}

export async function buildSearchIndex(
  collection: ContentCollection,
): Promise<IndexRecord[]> {
  const items = await getItems(collection)
  return items.map(({ entry, slug, uri, readingTime, hasDetail }) => ({
    slug,
    uri: hasDetail ? uri : null,
    title: entry.data.title,
    excerpt: entry.data.excerpt,
    tags: entry.data.tags,
    date: entry.data.date.toISOString(),
    readingTime,
  }))
}
