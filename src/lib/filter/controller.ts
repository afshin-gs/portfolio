import Fuse from 'fuse.js'
import type { EntryRecord, FilterState, TagFacet } from './types'
import { EMPTY_STATE, facets, isEmpty, parse, serialise, visible } from './state'
import {
  addMonths,
  formatRange,
  initialMonth,
  renderMonth,
  selectDay,
  type CalendarBounds,
} from './calendar'

/**
 * The single filter island (docs §10).
 *
 * It owns the entire filter state. Every control below is presentational: it
 * reports an intent, the controller updates state, and one render pass brings
 * the DOM in line. Nothing writes to the URL or to the list except `render`
 * and `pushUrl`.
 *
 * Progressive enhancement: the page arrives with EVERY entry prerendered and
 * fully usable. This hides non-matching cards in place. With JS unavailable the
 * bar is never shown (`html.js` gates it in CSS) and the reader gets the
 * complete list plus the crawlable tag links in the <noscript> fallback.
 */

/** §10: filter immediately, but write the URL on a debounce — otherwise every
 *  keystroke thrashes history. */
const URL_DEBOUNCE_MS = 200
const MOBILE_QUERY = '(max-width: 40rem)'

interface Refs {
  root: HTMLElement
  list: HTMLElement
  status: HTMLElement
  empty: HTMLElement
  query: HTMLInputElement
  clear: HTMLButtonElement
  tags: HTMLDetailsElement
  tagSummary: HTMLElement
  tagSearch: HTMLInputElement
  tagList: HTMLElement
  tagClear: HTMLButtonElement
  dates: HTMLDetailsElement
  dateSummary: HTMLElement
  dateHint: HTMLElement
  dateBody: HTMLElement
  dateClear: HTMLButtonElement
  backdrop: HTMLElement
}

/**
 * Guards only. The work is in `mount`, which takes a non-null `Refs`.
 *
 * Splitting them is not stylistic: TypeScript will not carry a null-narrowing
 * into hoisted function declarations, so with everything inline every one of
 * the ~30 uses of `el` below reads as possibly-null. Passing it as a parameter
 * makes the guarantee structural instead of asking each call site to re-assert it.
 */
export function initFilter(): void {
  const root = document.querySelector<HTMLElement>('[data-filter]')
  const list = document.querySelector<HTMLElement>('[data-entry-list]')
  if (!root || !list) return

  const el = collect(root, list)
  if (!el) return

  const records = readRecords(list)
  if (records.length === 0) return

  mount(el, records)
}

function mount(el: Refs, records: EntryRecord[]): void {
  const allFacets = facets(records)
  const bounds = dateBounds(records)

  // Weighted so a title match outranks an excerpt match, and location-agnostic
  // so a word late in an excerpt scores the same as one at the start.
  const fuse = new Fuse(records, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'excerpt', weight: 0.3 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })

  let state: FilterState = parse(location.search)
  let month = initialMonth(state, bounds)
  let urlTimer: number | undefined

  /* ------------------------------------------------------------- rendering */

  function render(): void {
    const hits = state.q.trim()
      ? new Set(fuse.search(state.q.trim()).map((r) => r.item.slug))
      : null
    const shown = new Set(visible(records, state, hits).map((r) => r.slug))

    for (const record of records) record.el.hidden = !shown.has(record.slug)

    el.empty.hidden = shown.size > 0

    // Disabled, never hidden. Removing the button would reflow the row the
    // moment a filter is applied, so the control keeps its box and only changes
    // colour — the label text is constant, so the width never moves either.
    el.clear.disabled = isEmpty(state)

    // §10 — as-you-type filtering is otherwise completely invisible to a
    // screen reader. Silent when nothing is filtered, so it does not announce
    // the full list on page load.
    el.status.textContent = isEmpty(state)
      ? ''
      : `${shown.size} of ${records.length} shown`

    renderTagSummary()
    renderTagList()
    el.dateSummary.textContent = formatRange(state)
    renderDateHint()
    el.dates.classList.toggle('is-active', !!state.from || !!state.to)
    el.tags.classList.toggle('is-active', state.tags.length > 0)
    if (el.dates.open) renderCalendar()
  }

  function renderTagSummary(): void {
    el.tagSummary.textContent = state.tags.length > 0 ? `Tags (${state.tags.length})` : 'Tags'
  }

  function renderTagList(): void {
    const needle = el.tagSearch.value.trim().toLowerCase()
    const matching = needle
      ? allFacets.filter((f) => f.tag.toLowerCase().includes(needle))
      : allFacets

    el.tagList.textContent = ''

    if (matching.length === 0) {
      const none = document.createElement('li')
      none.className = 'tag-none'
      none.textContent = 'No matching tags'
      el.tagList.append(none)
      return
    }

    for (const facet of matching) el.tagList.append(tagOption(facet))
  }

  function tagOption(facet: TagFacet): HTMLLIElement {
    const item = document.createElement('li')

    // A real checkbox, not a styled div: multi-select IS a set of checkboxes,
    // and using the native control means keyboard, screen-reader semantics and
    // the "checked" state all come for free.
    const label = document.createElement('label')
    label.className = 'tag-option'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.value = facet.tag
    input.checked = state.tags.includes(facet.tag)

    const name = document.createElement('span')
    name.className = 'tag-name'
    name.textContent = facet.tag

    const count = document.createElement('span')
    count.className = 'tag-count'
    count.textContent = `(${facet.count})`

    label.append(input, name, count)
    item.append(label)
    return item
  }

  function renderCalendar(): void {
    renderMonth(el.dateBody, month, state, bounds)
  }

  /**
   * Says which half of the range the picker is waiting for. Without it, a first
   * click looks like it did nothing and the second is a guess.
   *
   * TWO WORDS DIFFERENT, ON PURPOSE. A longer, more explanatory hint wrapped to
   * a second line, which grew the panel and pushed "Clear dates" out of the
   * bottom. Both strings are short enough to hold one line at the panel's
   * width, so the layout is identical in either state.
   */
  function renderDateHint(): void {
    const awaitingEnd = !!state.from && !state.to
    el.dateHint.textContent = awaitingEnd ? 'Pick an end date' : 'Pick a start date'
    el.dateHint.classList.toggle('is-active', awaitingEnd)
  }

  /* ------------------------------------------------------------------- URL */

  function pushUrl(): void {
    clearTimeout(urlTimer)
    urlTimer = window.setTimeout(() => {
      // replaceState, never pushState: with pushState every keystroke becomes
      // a history entry and the Back button stops being usable.
      history.replaceState(null, '', `${location.pathname}${serialise(state, location.search)}`)
    }, URL_DEBOUNCE_MS)
  }

  function update(next: Partial<FilterState>): void {
    state = { ...state, ...next }
    render()
    pushUrl()
  }

  /* -------------------------------------------------------------- controls */

  el.query.addEventListener('input', () => update({ q: el.query.value }))

  // §10 — Escape clears the query. Only when it is non-empty, so Escape still
  // reaches the browser (and any open panel) otherwise.
  el.query.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && el.query.value) {
      event.stopPropagation()
      el.query.value = ''
      update({ q: '' })
    }
  })

  el.tagSearch.addEventListener('input', renderTagList)

  el.tagList.addEventListener('change', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const tags = input.checked
      ? [...state.tags, input.value]
      : state.tags.filter((t) => t !== input.value)
    update({ tags })
  })

  el.tagClear.addEventListener('click', () => {
    el.tagSearch.value = ''
    update({ tags: [] })
  })

  el.dateBody.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const nav = target.closest<HTMLElement>('[data-month]')
    if (nav) {
      month = addMonths(month, nav.dataset.month === 'prev' ? -1 : 1)
      renderCalendar()
      return
    }

    const day = target.closest<HTMLElement>('[data-day]')?.dataset.day
    if (day) update(selectDay(state, day))
  })

  el.dateClear.addEventListener('click', () => update({ from: null, to: null }))

  el.clear.addEventListener('click', () => {
    el.query.value = ''
    el.tagSearch.value = ''
    update(EMPTY_STATE)
    el.query.focus()
  })

  /* ------------------------------------------------------- panel behaviour */

  const panels: HTMLDetailsElement[] = [el.tags, el.dates]
  const mobile = matchMedia(MOBILE_QUERY)

  function syncBackdrop(): void {
    const open = panels.some((p) => p.open)
    el.backdrop.hidden = !open
    // The backdrop is a mobile affordance; on desktop these are dropdowns and
    // the page behind stays live. Scroll-locking there would be hostile.
    document.documentElement.classList.toggle('filter-locked', open && mobile.matches)
  }

  function closePanels(except?: HTMLDetailsElement): void {
    for (const panel of panels) if (panel !== except) panel.open = false
    syncBackdrop()
  }

  for (const panel of panels) {
    panel.addEventListener('toggle', () => {
      if (panel.open) closePanels(panel)
      else syncBackdrop()

      if (panel === el.dates && panel.open) {
        month = initialMonth(state, bounds)
        renderCalendar()
      }
      // Opening a panel to find a tag is the whole point of the tag search, so
      // put the caret there — but not on touch, where it would raise the
      // keyboard over the list the reader just opened.
      if (panel === el.tags && panel.open && !mobile.matches) el.tagSearch.focus()
    })

    panel.querySelector('[data-panel-close]')?.addEventListener('click', () => {
      panel.open = false
      syncBackdrop()
    })
  }

  el.backdrop.addEventListener('click', () => closePanels())

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panels.some((p) => p.open)) closePanels()
  })

  document.addEventListener('click', (event) => {
    // composedPath(), NOT contains(). Clicking a day re-renders the calendar,
    // which detaches the very button that was clicked BEFORE this handler runs
    // — so `panel.contains(event.target)` is false for a click that happened
    // inside the panel, and the picker slammed shut on the first date. The
    // path is captured at dispatch and still holds the real ancestors.
    const path = event.composedPath()
    if (panels.some((p) => p.open && !path.includes(p))) closePanels()
  })

  // Crossing into or out of the mobile layout changes what "open" means, so
  // the safest thing is to close and let the reader reopen in the new form.
  mobile.addEventListener('change', () => closePanels())

  /* ----------------------------------------------------------------- mount */

  // §10 — the URL is the source of truth, parsed BEFORE first render so a
  // pasted link reproduces the view exactly rather than flashing the full list.
  el.query.value = state.q

  addEventListener('popstate', () => {
    state = parse(location.search)
    el.query.value = state.q
    month = initialMonth(state, bounds)
    render()
  })

  render()
}

/* ------------------------------------------------------------------ helpers */

function collect(root: HTMLElement, list: HTMLElement): Refs | null {
  const pick = <T extends HTMLElement>(selector: string): T | null =>
    root.querySelector<T>(selector)

  const refs = {
    root,
    list,
    status: pick('[data-filter-status]'),
    empty: document.querySelector<HTMLElement>('[data-filter-empty]'),
    query: pick<HTMLInputElement>('[data-filter-q]'),
    clear: pick<HTMLButtonElement>('[data-filter-clear]'),
    tags: pick<HTMLDetailsElement>('[data-filter-tags]'),
    tagSummary: pick('[data-tag-summary]'),
    tagSearch: pick<HTMLInputElement>('[data-tag-search]'),
    tagList: pick('[data-tag-list]'),
    tagClear: pick<HTMLButtonElement>('[data-tag-clear]'),
    dates: pick<HTMLDetailsElement>('[data-filter-dates]'),
    dateSummary: pick('[data-date-summary]'),
    dateHint: pick('[data-date-hint]'),
    dateBody: pick('[data-date-body]'),
    dateClear: pick<HTMLButtonElement>('[data-date-clear]'),
    backdrop: document.querySelector<HTMLElement>('[data-filter-backdrop]'),
  }

  // All or nothing. A half-wired controller would fail later, at a click, with
  // a stack trace pointing at the symptom rather than the missing element.
  return Object.values(refs).every(Boolean) ? (refs as Refs) : null
}

function readRecords(list: HTMLElement): EntryRecord[] {
  return [...list.querySelectorAll<HTMLElement>('[data-entry]')].map((el) => ({
    el,
    slug: el.dataset.entry ?? '',
    // Read from the rendered card rather than duplicated into data attributes:
    // the text is already in the DOM, and one copy cannot disagree with itself.
    title: el.querySelector('.title')?.textContent?.trim() ?? '',
    excerpt: el.querySelector('.excerpt')?.textContent?.trim() ?? '',
    tags: (el.dataset.tags ?? '').split(',').filter(Boolean),
    date: el.dataset.date ?? '',
  }))
}

function dateBounds(records: readonly EntryRecord[]): CalendarBounds {
  const dates = records.map((r) => r.date).filter(Boolean).sort()
  const today = new Date()
  const fallback = `${today.getFullYear()}-01-01`
  return {
    min: dates[0] ?? fallback,
    max: dates[dates.length - 1] ?? fallback,
  }
}
