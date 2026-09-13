// Place at: src/report/builder/print/chartPresets.js
// Chart presentation-style presets (Designer 2.0 Phase 3). Scoped to the
// display knobs the chart components (BarViz/LineViz/PieViz.jsx) actually
// read today - legend visibility and data-point labels - rather than
// inventing new rendering options no chart honors yet. Stored the same
// per-placement-override way table style already is (el.override.
// chartStyle), never written back to the visual itself.
export const CHART_PRESETS = [
  { id: 'default', label: 'Visual default', display: null },
  { id: 'minimal', label: 'Minimal', display: { legend: false, labels: false } },
  { id: 'presentation', label: 'Presentation', display: { legend: true, labels: false } },
  { id: 'data-dense', label: 'Data-dense', display: { legend: true, labels: true } },
]

export const CHART_PRESETS_BY_ID = Object.fromEntries(CHART_PRESETS.map(p => [p.id, p]))
