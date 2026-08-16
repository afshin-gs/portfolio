/**
 * The date-range calendar.
 *
 * Interaction is the flight-booking one: click a day to set the start, click a
 * second to close the range. Clicking the SAME day twice — an ordinary double
 * click — sets start and end to that day, which selects exactly one date. That
 * falls out of the state machine rather than needing a `dblclick` handler, so
 * there is no double-click timing threshold to tune and no conflict with the
 * single clicks it is made of.
 *
 * Dates are 'YYYY-MM-DD' strings throughout. Every Date object here is built
 * from local components and formatted by hand — `toISOString()` would shift
 * the day backwards for anyone west of UTC, which is the classic way a date
 * picker ends up one day off for half its users.
 */

export interface CalendarRange {
  from: string | null
  to: string | null
}

export interface CalendarBounds {
  /** Earliest month the calendar will navigate to, 'YYYY-MM-DD'. */
  min: string
  /** Latest month the calendar will navigate to. */
  max: string
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

export function toKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/**
 * Apply a click to the current range.
 *
 * Pure, so the whole interaction is testable without a DOM and the rules live
 * in one readable place rather than spread across event handlers.
 */
export function selectDay(range: CalendarRange, day: string): CalendarRange {
  // A complete range, or none at all: start a new one.
  if (!range.from || (range.from && range.to)) return { from: day, to: null }
  // Clicking before the open start moves the start rather than producing an
  // inverted range — the same forgiveness a booking widget gives.
  if (day < range.from) return { from: day, to: null }
  return { from: range.from, to: day }
}

/** Human-readable summary for the control's label. */
export function formatRange(range: CalendarRange): string {
  const fmt = (key: string) =>
    fromKey(key).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  if (range.from && range.to) {
    return range.from === range.to ? fmt(range.from) : `${fmt(range.from)} – ${fmt(range.to)}`
  }
  if (range.from) return `From ${fmt(range.from)}`
  if (range.to) return `Until ${fmt(range.to)}`
  return 'Any date'
}

/**
 * Render one month into `root`.
 *
 * Rebuilds rather than patching: a month grid is ~42 nodes, and the cost of
 * being certain the DOM matches the state is far lower than the cost of a
 * diffing bug that leaves a stale highlight behind.
 */
export function renderMonth(
  root: HTMLElement,
  month: Date,
  range: CalendarRange,
  bounds: CalendarBounds,
): void {
  root.textContent = ''

  const minMonth = fromKey(bounds.min)
  const maxMonth = fromKey(bounds.max)
  const atMin = month <= new Date(minMonth.getFullYear(), minMonth.getMonth(), 1)
  const atMax = month >= new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1)

  const head = document.createElement('div')
  head.className = 'cal-head'

  const prev = navButton('prev', '‹', 'Previous month', atMin)
  const next = navButton('next', '›', 'Next month', atMax)

  const title = document.createElement('strong')
  title.className = 'cal-title'
  title.textContent = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  // The heading is what changes when the arrows are pressed, so it is what a
  // screen reader should announce.
  title.setAttribute('aria-live', 'polite')

  head.append(prev, title, next)

  const grid = document.createElement('div')
  grid.className = 'cal-grid'

  for (const label of WEEKDAYS) {
    const cell = document.createElement('span')
    cell.className = 'cal-weekday'
    cell.setAttribute('aria-hidden', 'true')
    cell.textContent = label
    grid.append(cell)
  }

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  // getDay() is Sunday-first; the grid is Monday-first to match en-GB.
  const lead = (first.getDay() + 6) % 7
  for (let i = 0; i < lead; i++) {
    const blank = document.createElement('span')
    blank.className = 'cal-blank'
    grid.append(blank)
  }

  const today = toKey(new Date())
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  for (let day = 1; day <= days; day++) {
    const date = new Date(month.getFullYear(), month.getMonth(), day)
    const key = toKey(date)

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cal-day'
    button.dataset.day = key
    button.textContent = String(day)

    const isStart = key === range.from
    const isEnd = key === range.to
    const inside = !!range.from && !!range.to && key > range.from && key < range.to

    if (isStart) button.classList.add('is-start')
    if (isEnd) button.classList.add('is-end')
    if (inside) button.classList.add('is-inside')
    if (key === today) button.classList.add('is-today')
    if (isStart || isEnd) button.setAttribute('aria-pressed', 'true')

    // The visible label is a bare number, which is meaningless out of context.
    button.setAttribute(
      'aria-label',
      date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    )

    grid.append(button)
  }

  root.append(head, grid)
}

function navButton(
  action: 'prev' | 'next',
  glyph: string,
  label: string,
  disabled: boolean,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'cal-nav'
  button.dataset.month = action
  button.textContent = glyph
  button.setAttribute('aria-label', label)
  button.disabled = disabled
  return button
}

/** The month a freshly-opened calendar should show. */
export function initialMonth(range: CalendarRange, bounds: CalendarBounds): Date {
  const anchor = range.from ?? range.to ?? bounds.max
  const date = fromKey(anchor)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export { sameMonth }
