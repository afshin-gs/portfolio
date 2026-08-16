/**
 * Controller for the mobile navigation overlay.
 *
 * Lives in a .ts module rather than inline in SiteHeader.astro so it is
 * type-checked by `bun run check` and testable in isolation. The component
 * owns the markup; this owns the behaviour.
 *
 * This is the ONLY interactive chrome on the site. It is a menu, not an
 * animation: opening it is an instant state change.
 */

/** Breakpoint at which the desktop nav takes over. Must match SiteHeader.astro. */
const DESKTOP_QUERY = '(min-width: 56rem)'

interface Refs {
  panel: HTMLElement
  open: HTMLButtonElement
  close: HTMLButtonElement
}

function refs(): Refs | null {
  const panel = document.querySelector<HTMLElement>('[data-nav-panel]')
  const open = document.querySelector<HTMLButtonElement>('[data-nav-open]')
  const close = document.querySelector<HTMLButtonElement>('[data-nav-close]')
  return panel && open && close ? { panel, open, close } : null
}

export function initMobileNav(): void {
  const el = refs()
  if (!el) return

  let isOpen = false

  const setOpen = (next: boolean): void => {
    if (next === isOpen) return
    isOpen = next

    el.panel.hidden = !next
    el.open.setAttribute('aria-expanded', String(next))

    // Locking <body> rather than <html> keeps the scroll position intact on
    // iOS, which resets it if the scrolling element itself is hidden.
    document.body.style.overflow = next ? 'hidden' : ''

    // Move focus INTO the overlay on open and back to the trigger on close, or
    // a keyboard user is left focused on an element that is no longer visible.
    if (next) el.close.focus()
    else el.open.focus()
  }

  el.open.addEventListener('click', () => setOpen(true))
  el.close.addEventListener('click', () => setOpen(false))

  // Any navigation closes it. Astro does a full page load, so this only
  // matters for in-page anchors — where the overlay would otherwise stay up
  // covering the section the visitor just asked to see.
  el.panel.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) setOpen(false)
  })

  // Rotating a phone to landscape can cross the desktop breakpoint. Without
  // this the overlay stays open over a layout that already shows the full nav,
  // and <body> stays scroll-locked.
  const desktop = matchMedia(DESKTOP_QUERY)
  desktop.addEventListener('change', (event) => {
    if (event.matches) setOpen(false)
  })
}
