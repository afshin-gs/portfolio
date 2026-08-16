import { atom } from 'nanostores'

/**
 * docs/architecture.md §12 — Cross-property theme contract.
 *
 * This file is the WEBSITE's implementation of a contract that every app repo
 * also implements (copied, not packaged — D7). If you change anything here,
 * you are changing the contract:
 *
 *   key    localStorage['afshin:theme']
 *   values 'light' | 'dark'   (default 'light')
 *   DOM    <html data-theme="light|dark">
 *
 * Because apps live at SUBPATHS (D1) they share this origin, so localStorage is
 * shared automatically — no postMessage bridge, no cookie tricks.
 *
 * CONTRACT CHANGE: 'system' was removed. The theme is now an explicit binary
 * choice, so the stored preference and what is painted are always the same
 * value and there is nothing to "resolve". Two consequences worth knowing:
 *
 *   - The OS colour-scheme preference is no longer consulted at all. A visitor
 *     whose device is in dark mode still gets light on a first visit.
 *   - App repos copy this file. Any app still storing 'system' would write a
 *     value this reader rejects — readTheme() falls back to the default rather
 *     than throwing, so the failure mode is a wrong theme, not a broken page.
 */
export const THEME_KEY = 'afshin:theme'

export type ThemePref = 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/**
 * What a visitor with NO stored preference gets.
 *
 * CONTRACT NOTE: app repos copy this file. If an app uses a different fallback,
 * a first visit to the website and a first visit to that app would disagree.
 * Keep this value identical across properties.
 */
export const THEME_DEFAULT: ThemePref = 'light'

/** Preference as stored. */
export const themePref = atom<ThemePref>(THEME_DEFAULT)
/** What is actually painted. Islands (e.g. ECharts) subscribe to THIS. */
export const resolvedTheme = atom<ResolvedTheme>('light')

/**
 * Kept as a function, and kept exported, even though it is now the identity.
 *
 * The preference/resolved split is the part of the contract that islands
 * depend on (D11 charts subscribe to `resolvedTheme`, never to `themePref`).
 * Collapsing the two would make every consumer care about which one it holds,
 * and would have to be undone the moment a third mode is ever reintroduced.
 */
export function resolve(pref: ThemePref): ResolvedTheme {
  return pref
}

function apply(pref: ThemePref) {
  const r = resolve(pref)
  document.documentElement.dataset.theme = r
  document.documentElement.style.colorScheme = r

  // Keep the browser chrome on the same theme as the page. Read from the
  // computed --bg rather than a hardcoded pair, so retuning the palette in
  // tokens.css cannot leave this behind.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (bg) meta.setAttribute('content', bg)
  }

  themePref.set(pref)
  resolvedTheme.set(r)
}

export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    /* private mode — still apply for this page */
  }
  apply(pref)
}

export function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY)
    // 'system' is rejected here on purpose: a visitor who chose it before the
    // mode was removed falls back to the default rather than to a value the
    // rest of the code no longer understands.
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return THEME_DEFAULT
}

/** Flip between the two themes and persist the result. */
export function toggleTheme(): ThemePref {
  const next: ThemePref = themePref.get() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

/** Call once per page. The inline head script has already set data-theme to
 *  prevent FOUC; this only wires up the live listeners. */
export function initTheme() {
  apply(readTheme())

  // Cross-TAB sync. Fires in OTHER tabs, not the one that wrote (§12).
  addEventListener('storage', (e) => {
    if (e.key === THEME_KEY) apply(readTheme())
  })

  // No prefers-color-scheme listener any more: with 'system' gone there is no
  // state in which an OS change should move the site out from under a reader.
}

/**
 * D11: canvas cannot read CSS custom properties. ECharts needs concrete colour
 * values, so islands read the resolved tokens here and rebuild on theme change.
 * A chart that silently keeps light-mode colours after a switch is the failure
 * mode this exists to prevent.
 */
export function readTokens(el: Element = document.documentElement) {
  const cs = getComputedStyle(el)
  const get = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback
  return {
    bg: get('--bg', '#ffffff'),
    fg: get('--fg', '#1a1a1a'),
    muted: get('--muted', '#666666'),
    border: get('--border', '#e0e0e0'),
    surface: get('--surface', '#f6f6f6'),
    accent: get('--accent', '#2563eb'),
    series: [
      get('--chart-1', '#2563eb'),
      get('--chart-2', '#c9a227'),
      get('--chart-3', '#4a7c59'),
      get('--chart-4', '#c53030'),
      get('--chart-5', '#7c3aed'),
      get('--chart-6', '#0891b2'),
    ],
  }
}
