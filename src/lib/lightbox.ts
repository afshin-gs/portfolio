/**
 * Click/tap-to-zoom for images inside post content.
 *
 * Built on the native <dialog> element rather than a hand-rolled overlay, which
 * buys four things that are easy to get wrong by hand: the top layer (so no
 * z-index fight with the sticky header), a real focus trap, Escape-to-close,
 * and focus returning to the trigger on close.
 *
 * ONE dialog per page, created lazily on first open and reused. A dialog per
 * image would duplicate markup and make the browser consider preloading images
 * the reader may never open.
 *
 *
 * WHY THE GESTURES ARE IMPLEMENTED HERE RATHER THAN LEFT TO THE BROWSER
 *
 * There is no element-level pinch-zoom on the web. A pinch is handled by the
 * browser as a VISUAL VIEWPORT zoom of the whole page — so pinching an open
 * lightbox scaled the entire site, overlay and all, instead of the photo. CSS
 * alone cannot redirect that: `touch-action: pinch-zoom` permits the page
 * gesture, it does not scope it to a box.
 *
 * The only way to scope it is to take the gesture off the browser
 * (`touch-action: none` on the viewport, plus preventDefault on Safari's
 * non-standard `gesture*` events) and drive a transform from raw pointer
 * events. That is what this file does.
 *
 * The page keeps its own pinch-zoom everywhere else: `touch-action: none` is
 * scoped to the lightbox viewport, and the meta viewport deliberately does NOT
 * set `user-scalable=no` — suppressing page zoom globally to fix a modal would
 * be an accessibility regression far worse than the bug.
 *
 *
 * ONE MODEL FOR BOTH INPUTS
 *
 * State is `{ scale, x, y }` applied as a single transform. Touch drives it by
 * pinch and drag, a mouse by click, wheel, and drag, a keyboard by arrows and
 * +/-. An earlier version panned via native `overflow: auto` scrolling, which
 * cannot coexist with `touch-action: none` — the two models had to be unified,
 * not layered.
 */

interface Refs {
  dialog: HTMLDialogElement
  viewport: HTMLDivElement
  image: HTMLImageElement
  caption: HTMLParagraphElement
}

/** Scale is relative to the fitted size, so 1 always means "whole image". */
interface View {
  scale: number
  x: number
  y: number
}

interface Point {
  x: number
  y: number
}

let refs: Refs | null = null
let initialised = false

let view: View = { scale: 1, x: 0, y: 0 }
/** Rendered size at scale 1. The basis for every clamp. */
let base = { width: 0, height: 0 }
let maxScale = 1
/** Where a double-tap or click zooms to. */
let stepScale = 2

const pointers = new Map<number, Point>()
let pinch: { dist: number; mid: Point; view: View } | null = null
let pan: { from: Point; view: View } | null = null
/** A gesture happened, so the trailing click must not be read as a tap. */
let gestured = false
let lastTap = 0

const DOUBLE_TAP_MS = 300
const TAP_SLOP_PX = 8
const KEY_PAN_PX = 60

function build(): Refs {
  const dialog = document.createElement('dialog')
  dialog.className = 'lightbox'

  const viewport = document.createElement('div')
  viewport.className = 'lightbox-viewport'

  const image = document.createElement('img')
  image.className = 'lightbox-image'
  image.decoding = 'async'
  image.draggable = false
  // The lightbox is full-viewport, so the browser should pick the LARGEST
  // candidate from the srcset it inherits — not the one sized for a 68ch column.
  image.sizes = '100vw'

  const close = document.createElement('button')
  close.className = 'lightbox-close'
  close.type = 'button'
  close.setAttribute('aria-label', 'Close image')
  close.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'

  const caption = document.createElement('p')
  caption.className = 'lightbox-caption'

  viewport.append(image)
  dialog.append(close, viewport, caption)
  document.body.append(dialog)

  const el: Refs = { dialog, viewport, image, caption }
  bindGestures(el)
  return el
}

function ensure(): Refs {
  if (!refs) refs = build()
  return refs
}

/* ---------------------------------------------------------------- transform */

function clamp(el: Refs): void {
  const vw = el.viewport.clientWidth
  const vh = el.viewport.clientHeight
  // Half the overhang: how far the image may travel before its edge would
  // pull inside the frame and leave a gap.
  const maxX = Math.max(0, (base.width * view.scale - vw) / 2)
  const maxY = Math.max(0, (base.height * view.scale - vh) / 2)
  view.x = Math.min(maxX, Math.max(-maxX, view.x))
  view.y = Math.min(maxY, Math.max(-maxY, view.y))
}

function apply(el: Refs): void {
  clamp(el)
  el.image.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
  el.dialog.dataset.zoomed = String(view.scale > 1.01)
}

/**
 * Zoom to `next`, keeping the point under (mx, my) pinned.
 *
 * The anchor is what makes pinching feel native: without it the image zooms
 * about its centre and slides out from under the fingers holding it.
 *
 * With `transform: translate(x,y) scale(s)` about the centre C, a screen point
 * m maps to image-local u = (m - C - t) / s. Holding u fixed across a scale
 * change gives t' = (m - C) - (s'/s)(m - C - t).
 */
function zoomTo(el: Refs, next: number, mx: number, my: number): void {
  const target = Math.min(maxScale, Math.max(1, next))
  const rect = el.viewport.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const ratio = target / view.scale

  view.x = mx - cx - ratio * (mx - cx - view.x)
  view.y = my - cy - ratio * (my - cy - view.y)
  view.scale = target

  // Fully zoomed out is always dead centre; drifting off-centre at scale 1
  // would leave the image sitting crooked in the frame.
  if (target <= 1.001) {
    view.x = 0
    view.y = 0
  }
  apply(el)
}

function toggleZoom(el: Refs, mx: number, my: number): void {
  zoomTo(el, view.scale > 1.01 ? 1 : stepScale, mx, my)
}

/**
 * Recompute the fitted size and the zoom ceiling. Must run with the transform
 * cleared, or it would measure the zoomed box and compound on every call.
 */
function measure(el: Refs): void {
  view = { scale: 1, x: 0, y: 0 }
  el.image.style.transform = ''

  const rect = el.image.getBoundingClientRect()
  base = { width: rect.width, height: rect.height }

  // How far past "fit" the pixels actually go. An image displayed smaller than
  // its natural size can be zoomed at least that far before it degrades.
  const toNatural = rect.width > 0 ? el.image.naturalWidth / rect.width : 1
  maxScale = Math.min(8, Math.max(2, toNatural * 2))
  stepScale = Math.min(maxScale, Math.max(2, toNatural))

  el.dialog.dataset.canZoom = String(maxScale > 1.01)
  apply(el)
}

/* ----------------------------------------------------------------- gestures */

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function bindGestures(el: Refs): void {
  const vp = el.viewport

  vp.addEventListener('pointerdown', (event) => {
    // Capture so a finger that slides off the image keeps feeding this element.
    vp.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Point, Point]
      pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: midpoint(a, b),
        view: { ...view },
      }
      pan = null
    } else if (pointers.size === 1) {
      pan = { from: { x: event.clientX, y: event.clientY }, view: { ...view } }
    }
  })

  vp.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [Point, Point]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.dist === 0) return
      const mid = midpoint(a, b)

      // Recompute from the gesture's STARTING view every frame rather than
      // accumulating deltas — accumulation drifts, and a pinch that ends where
      // it began must land exactly where it began.
      view = { ...pinch.view }
      zoomTo(el, pinch.view.scale * (dist / pinch.dist), pinch.mid.x, pinch.mid.y)

      // Two fingers also drag: follow the midpoint, so pinch and pan are one
      // continuous gesture instead of two modes.
      view.x += mid.x - pinch.mid.x
      view.y += mid.y - pinch.mid.y
      apply(el)
      gestured = true
      return
    }

    if (pan && pointers.size === 1) {
      const dx = event.clientX - pan.from.x
      const dy = event.clientY - pan.from.y
      if (!gestured && Math.hypot(dx, dy) < TAP_SLOP_PX) return
      // Below scale 1 there is nothing to pan to; let the movement be a tap
      // that missed rather than nudging a centred image.
      if (view.scale <= 1.01) return
      gestured = true
      view.x = pan.view.x + dx
      view.y = pan.view.y + dy
      apply(el)
    }
  })

  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinch = null
    if (pointers.size === 0) {
      const wasGesture = gestured
      pan = null
      if (!wasGesture) tap(el, event)
      // Cleared on the next frame so the synthetic click that follows a
      // gesture still sees it and does not dismiss the dialog.
      setTimeout(() => {
        gestured = false
      }, 0)
    }
  }

  vp.addEventListener('pointerup', release)
  vp.addEventListener('pointercancel', release)

  // Trackpad and wheel zoom, anchored at the cursor. Continuous, so no step.
  vp.addEventListener(
    'wheel',
    (event) => {
      if (!el.dialog.open) return
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * 0.0015)
      zoomTo(el, view.scale * factor, event.clientX, event.clientY)
    },
    { passive: false },
  )

  // Safari's non-standard pinch events. touch-action alone does not reliably
  // stop iOS from zooming the page, and these are the documented way to say so.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    el.dialog.addEventListener(type, (event) => event.preventDefault())
  }
}

/** A pointer sequence that neither moved nor pinched. */
function tap(el: Refs, event: PointerEvent): void {
  const onImage = event.target === el.image
  const now = event.timeStamp || Date.now()

  if (event.pointerType === 'mouse') {
    if (onImage) toggleZoom(el, event.clientX, event.clientY)
    else if (event.target === el.viewport) el.dialog.close()
    return
  }

  // Touch and pen. A single tap on the image must NOT zoom — it is the most
  // common accidental contact while panning, and it would fight double-tap.
  if (!onImage) {
    el.dialog.close()
    return
  }
  if (now - lastTap < DOUBLE_TAP_MS) {
    toggleZoom(el, event.clientX, event.clientY)
    lastTap = 0
  } else {
    lastTap = now
  }
}

/* --------------------------------------------------------------------- open */

function open(trigger: HTMLElement, source: HTMLImageElement): void {
  const el = ensure()

  el.image.src = source.currentSrc || source.src
  el.image.srcset = source.srcset
  el.image.alt = source.alt

  const caption = trigger.dataset.caption ?? ''
  el.caption.textContent = caption
  el.caption.hidden = caption === ''

  pointers.clear()
  pinch = null
  pan = null
  gestured = false
  delete el.dialog.dataset.canZoom

  // showModal() does not stop the page behind from scrolling, but the lock is
  // done in CSS (`html:has(.lightbox[open])`) rather than here. Setting
  // body.style.overflow on open means something has to unset it on close, and
  // the only signal for a native Escape dismissal is the `close` event — which
  // leaves a permanently unscrollable page on any path where that listener does
  // not run. Deriving the lock from the open state cannot get out of sync.
  el.dialog.showModal()

  // The fitted size is only meaningful once the candidate the browser picked
  // from the srcset has loaded.
  //
  // NOT decode(): assigning src and then srcset makes the browser re-run
  // candidate selection, and the promise from the superseded decode can be left
  // pending forever — observed as an image that had visibly loaded while the
  // zoom affordance never appeared. `complete` plus a `load` listener has no
  // such edge, and it also works in a backgrounded tab.
  if (el.image.complete && el.image.naturalWidth > 0) measure(el)
  else el.image.addEventListener('load', () => measure(el), { once: true })
}

export function initLightbox(): void {
  if (initialised) return
  initialised = true

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement

    // NOTE: `[data-zoomable]` is the TRIGGER in the post body. The dialog's own
    // affordance flag is deliberately `data-can-zoom` — naming both the same
    // made closest() from the enlarged image match the dialog itself, so
    // clicking to zoom re-entered open() and reset the view instead.
    const trigger = target.closest<HTMLElement>('[data-zoomable]')
    if (trigger) {
      const source = trigger.querySelector('img')
      if (source) open(trigger, source)
      return
    }

    const el = refs
    if (!el?.dialog.open) return

    if (target.closest('.lightbox-close')) {
      el.dialog.close()
      return
    }

    // Everything else inside the viewport is decided by the pointer handlers,
    // which can tell a tap from the end of a drag. Acting on `click` too would
    // dismiss the dialog whenever a pan finished over empty space.
    if (gestured) return
    if (target === el.dialog) el.dialog.close()
  })

  document.addEventListener('keydown', (event) => {
    const el = refs
    if (!el?.dialog.open) return

    // Escape is native to <dialog>. The rest gives the keyboard the same reach
    // as a pointer, which matters more now that panning is not native scrolling.
    const rect = el.viewport.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        toggleZoom(el, cx, cy)
        break
      case '+':
      case '=':
        event.preventDefault()
        zoomTo(el, view.scale * 1.3, cx, cy)
        break
      case '-':
        event.preventDefault()
        zoomTo(el, view.scale / 1.3, cx, cy)
        break
      case '0':
        event.preventDefault()
        zoomTo(el, 1, cx, cy)
        break
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (view.scale <= 1.01) return
        event.preventDefault()
        if (event.key === 'ArrowLeft') view.x += KEY_PAN_PX
        if (event.key === 'ArrowRight') view.x -= KEY_PAN_PX
        if (event.key === 'ArrowUp') view.y += KEY_PAN_PX
        if (event.key === 'ArrowDown') view.y -= KEY_PAN_PX
        apply(el)
        break
      }
    }
  })

  // A rotation changes the fitted size, so every clamp bound changes with it.
  // Re-measuring resets to fit, which is the only state guaranteed to be valid
  // at the new size.
  addEventListener('resize', () => {
    const el = refs
    if (el?.dialog.open) measure(el)
  })
}
