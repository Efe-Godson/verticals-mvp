// Place at: src/report/builder/catalogue.js
// The visualisation catalogue (brief §4) as data, plus a factory for a
// fresh VisualDef. Adding a future visual = one entry here + a branch in
// VisualRenderer, no other wiring.

export const CATALOGUE = [
  {
    group: 'KPI & Summary',
    items: [
      { type: 'number', label: 'Number Card', kind: 'scalar', minW: 2, minH: 2, defaultSize: [3, 3] },
      { type: 'kpi', label: 'KPI Card', kind: 'scalar', minW: 2, minH: 2, defaultSize: [3, 3] },
      { type: 'comparison', label: 'Comparison Card', kind: 'scalar', minW: 3, minH: 3, defaultSize: [3, 3] },
      { type: 'progress', label: 'Progress Card', kind: 'scalar', minW: 3, minH: 3, defaultSize: [3, 3] },
    ],
  },
  {
    group: 'Comparison',
    items: [
      { type: 'bar', label: 'Vertical Bar', kind: 'series', minW: 3, minH: 4, defaultSize: [6, 5] },
      { type: 'hbar', label: 'Horizontal Bar', kind: 'series', minW: 3, minH: 4, defaultSize: [6, 5] },
      { type: 'groupedBar', label: 'Grouped Bar', kind: 'matrix', minW: 4, minH: 4, defaultSize: [6, 5], needsSecondary: true },
      { type: 'stackedBar', label: 'Stacked Bar', kind: 'matrix', minW: 4, minH: 4, defaultSize: [6, 5], needsSecondary: true },
      { type: 'stackedBar100', label: '100% Stacked Bar', kind: 'matrix', minW: 4, minH: 4, defaultSize: [6, 5], needsSecondary: true },
    ],
  },
  {
    group: 'Trends',
    items: [
      { type: 'line', label: 'Line', kind: 'series', dateDim: true, minW: 4, minH: 4, defaultSize: [6, 5] },
      { type: 'multiLine', label: 'Multi-Line', kind: 'matrix', dateDim: true, needsSecondary: true, minW: 4, minH: 4, defaultSize: [6, 5] },
      { type: 'area', label: 'Area', kind: 'series', dateDim: true, minW: 4, minH: 4, defaultSize: [6, 5] },
      { type: 'stackedArea', label: 'Stacked Area', kind: 'matrix', dateDim: true, needsSecondary: true, minW: 4, minH: 4, defaultSize: [6, 5] },
    ],
  },
  {
    group: 'Composition',
    items: [
      { type: 'pie', label: 'Pie', kind: 'series', minW: 3, minH: 4, defaultSize: [5, 5] },
      { type: 'donut', label: 'Donut', kind: 'series', minW: 3, minH: 4, defaultSize: [5, 5] },
    ],
  },
  {
    group: 'Relationships',
    items: [
      { type: 'scatter', label: 'Scatter Plot', kind: 'scatter', minW: 4, minH: 4, defaultSize: [6, 5] },
    ],
  },
  {
    group: 'Tables',
    items: [
      { type: 'table', label: 'Data Table', kind: 'records', minW: 4, minH: 4, defaultSize: [8, 5] },
      { type: 'summaryTable', label: 'Summary Table', kind: 'series', minW: 4, minH: 4, defaultSize: [7, 5] },
      { type: 'pivot', label: 'Pivot Table', kind: 'pivot', minW: 4, minH: 4, defaultSize: [8, 6] },
    ],
  },
]

export const CATALOGUE_BY_TYPE = Object.fromEntries(
  CATALOGUE.flatMap(g => g.items.map(it => [it.type, it])),
)

let seq = 0
export function newVisualId() {
  seq += 1
  return `v_${Date.now().toString(36)}_${seq}`
}

// Build a blank VisualDef for a catalogue type, pre-seeding a sensible
// query + a layout slot the caller will place on the grid.
export function makeVisual(type, layout) {
  const spec = CATALOGUE_BY_TYPE[type] || {}
  const query = {
    metric: null,
    aggregation: 'count',
    cartMode: 'revenue',
    dimension: null,
    secondaryDimension: null,
    dateGranularity: 'month',
    sort: 'metric-desc',
    topN: null,
    filters: [],
  }
  if (spec.kind === 'pivot') {
    query.kind = 'pivot'
    query.rows = []
    query.cols = []
    query.percentMode = null
  }
  if (spec.kind === 'scatter') { query.kind = 'scatter'; query.scatterX = null; query.scatterY = null }
  if (spec.kind === 'records') query.kind = 'records'

  return {
    id: newVisualId(),
    type,
    title: spec.label || 'Visual',
    query,
    filters: [],
    layout: layout || { x: 0, y: 0, w: (spec.defaultSize || [6, 5])[0], h: (spec.defaultSize || [6, 5])[1] },
    display: { legend: true, labels: false },
    reportVisibility: false,
    reportLayout: null,
    selectedDatapoint: null,
    promotedAt: null,
    createdAt: new Date().toISOString(),
  }
}
