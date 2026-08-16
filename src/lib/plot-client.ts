import { resolvedTheme, readTokens } from './theme'

/**
 * docs/architecture.md D11 — ECharts island, vanilla.
 *
 * WHY NOT REACT: ECharts is imperative and framework-agnostic. A React island
 * shipped a 56 KB gz runtime whose only job was calling echarts.init() on a
 * <div>. This does the same work with none of it.
 *
 * ECharts is loaded through a DYNAMIC import inside the IntersectionObserver,
 * so it is not part of the page's initial module graph at all — it is fetched
 * only when a chart actually scrolls into view. Pages with no chart pay zero.
 */

import type { EChartsInstance } from './echarts-bundle'

let loader: Promise<typeof import('./echarts-bundle')> | null = null

/** Loaded once per page, shared by every chart on it. */
function loadECharts() {
  loader ??= import('./echarts-bundle')
  return loader
}

/** D11: canvas cannot read CSS custom properties — inject concrete values. */
function themed(option: Record<string, unknown>) {
  const t = readTokens()
  const axis = {
    axisLine: { lineStyle: { color: t.border } },
    axisLabel: { color: t.muted },
    splitLine: { lineStyle: { color: t.border, opacity: 0.4 } },
  }
  return {
    color: t.series,
    backgroundColor: 'transparent',
    textStyle: { color: t.fg },
    title: { textStyle: { color: t.fg } },
    legend: { textStyle: { color: t.muted } },
    tooltip: { backgroundColor: t.surface, borderColor: t.border, textStyle: { color: t.fg } },
    xAxis: axis,
    yAxis: axis,
    ...option,
  }
}

async function mount(el: HTMLElement) {
  const raw = el.dataset.option
  if (!raw) return

  let option: Record<string, unknown>
  try {
    option = JSON.parse(raw)
  } catch {
    console.error('[plot] invalid option JSON', el)
    return
  }

  const { echarts } = await loadECharts()
  const chart: EChartsInstance = echarts.init(el, undefined, { renderer: 'canvas' })
  chart.setOption(themed(option))

  // A chart that keeps light-mode axes after a theme switch is the D11
  // failure mode this subscription exists to prevent.
  resolvedTheme.subscribe(() => chart.setOption(themed(option), { notMerge: true }))

  new ResizeObserver(() => chart.resize()).observe(el)
}

export function initPlots(root: ParentNode = document) {
  const targets = root.querySelectorAll<HTMLElement>('[data-plot]:not([data-plot-ready])')
  if (targets.length === 0) return

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        io.unobserve(el)
        el.dataset.plotReady = 'true'
        void mount(el)
      }
    },
    { rootMargin: '200px' }, // start fetching just before it is needed
  )

  targets.forEach((el) => io.observe(el))
}
