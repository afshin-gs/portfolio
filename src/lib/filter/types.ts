/**
 * docs/architecture.md §10 — search and filtering.
 *
 * THE ARCHITECTURAL RULE: one island owns ALL filter state. Not a search
 * island plus a tag island plus a date island — independent components writing
 * to the same URL desync and fight. Everything below is state owned by a single
 * controller; every control is a presentational child driven by it.
 */

/**
 * The complete filter state. Every field is reproducible from the URL, which is
 * what makes a pasted link restore the exact view (G5).
 *
 * §10's shape also lists `sort`. It is deliberately NOT implemented: there is
 * no sort control in the UI, and state nothing can change is state that rots.
 * `parse()` ignores an incoming `sort` param rather than pretending to honour it.
 */
export interface FilterState {
  q: string
  tags: string[]
  /** Inclusive bound, 'YYYY-MM-DD'. */
  from: string | null
  /** Inclusive bound, 'YYYY-MM-DD'. */
  to: string | null
}

/**
 * One card on the page, paired with the element it came from.
 *
 * `el` is the actual prerendered <li>. Filtering hides and shows these rather
 * than rebuilding the list, so what a filtered page shows can never disagree
 * with what the server rendered.
 */
export interface EntryRecord {
  el: HTMLElement
  slug: string
  title: string
  excerpt: string
  tags: string[]
  /** 'YYYY-MM-DD'. Comparable as a string; no Date, no timezone. */
  date: string
}

export interface TagFacet {
  tag: string
  /** Total entries carrying this tag, independent of the current filter.
   *  Counts do not react to selection because tag matching is OR — "biochem
   *  (5)" means five posts have it, which stays true whatever else is picked. */
  count: number
}
