import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

/**
 * docs/architecture.md D11 — the ECharts bundle, defined with STATIC named
 * imports so the bundler can tree-shake.
 *
 * This module exists purely so plot-client.ts can `await import()` it. Doing
 * `await import('echarts/charts')` directly imports the whole namespace, which
 * defeats tree-shaking entirely — it pulled in geo/GeoJSON parsing and keyframe
 * animation for a line chart. Dynamic import of a statically-imported module
 * gives BOTH lazy loading and tree-shaking.
 *
 * Adding a chart type: add the named import here and register it below. Keep
 * this list minimal — every entry is paid for by every post containing a chart.
 */
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
])

export { echarts }
export type EChartsInstance = ReturnType<typeof echarts.init>
