import type { EntryRecord, FilterState, TagFacet } from './types'

/**
 * Pure state logic: URL ⇄ FilterState, and the predicates that turn a state
 * into a visible set. No DOM, no side effects — the controller owns those.
 */

export const EMPTY_STATE: FilterState = { q: '', tags: [], from: null, to: null }

export function isEmpty(state: FilterState): boolean {
  return !state.q && state.tags.length === 0 && !state.from && !state.to
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function readDate(value: string | null): string | null {
  return value && DATE_RE.test(value) ? value : null
}

/** URL → state. Anything malformed is dropped rather than thrown on: a hand-
 *  edited link should degrade to a wider view, never to an error page. */
export function parse(search: string): FilterState {
  const params = new URLSearchParams(search)
  const tags = (params.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  let from = readDate(params.get('from'))
  let to = readDate(params.get('to'))
  // A reversed range would silently match nothing. Swapping is the reading a
  // person clearly intended.
  if (from && to && from > to) [from, to] = [to, from]

  return {
    q: params.get('q') ?? '',
    tags: [...new Set(tags)],
    from,
    to,
  }
}

/**
 * State → query string, preserving any unrelated params already on the URL.
 *
 * Default values are omitted so a shared link stays short and readable, and so
 * that clearing every filter returns the URL to exactly what it was.
 */
export function serialise(state: FilterState, search = ''): string {
  const params = new URLSearchParams(search)
  const set = (key: string, value: string) => {
    if (value) params.set(key, value)
    else params.delete(key)
  }

  set('q', state.q.trim())
  set('tags', state.tags.join(','))
  set('from', state.from ?? '')
  set('to', state.to ?? '')

  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Tag facets over the whole collection, most used first, then alphabetical. */
export function facets(records: readonly EntryRecord[]): TagFacet[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    for (const tag of record.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Successive predicates over one array — not a matrix of special cases. This
 * is what makes the filters compose for free: adding a fifth criterion is one
 * more `if`, not a combination to reason about against the other four.
 *
 * `hits` is the set of slugs the fuzzy pass matched, or null when there is no
 * query. Search runs in the caller because it is index-wide, not per-record.
 */
export function visible(
  records: readonly EntryRecord[],
  state: FilterState,
  hits: ReadonlySet<string> | null,
): EntryRecord[] {
  return records.filter((record) => {
    if (hits && !hits.has(record.slug)) return false

    // OR within tags. AND would mean picking a second tag almost always empties
    // the list, and it would make the counts beside each tag a lie.
    if (state.tags.length > 0 && !state.tags.some((tag) => record.tags.includes(tag))) {
      return false
    }

    // ISO dates compare correctly as strings, so no Date objects and no
    // timezone to get wrong.
    if (state.from && record.date < state.from) return false
    if (state.to && record.date > state.to) return false

    return true
  })
}
