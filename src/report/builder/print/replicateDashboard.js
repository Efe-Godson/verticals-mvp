// Place at: src/report/builder/print/replicateDashboard.js
// Auto-fills the Print/PDF workspace with a paginated replica of the main
// Report.jsx dashboard - every chart tile (report/analysis/buildDashboardTiles.js)
// plus every visual promoted to Reports - so Print View opens already looking
// like the report, instead of a blank page the user has to rebuild by hand.
import { buildChartTiles } from '../../analysis/buildDashboardTiles'
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'

const ELEMENT_W = GRID_COLS / 2 // two per row, matching the dashboard's own two-column tile grid
const ELEMENT_H = 10

// Places same-size elements two per row, top to bottom; starts a new page
// only at a row boundary (never splits a row across pages).
function packIntoPages(items) {
  const pages = []
  let current = []
  let x = 0
  let y = 0
  for (const item of items) {
    if (x === 0 && y + ELEMENT_H > ROWS_PER_PAGE && current.length > 0) {
      pages.push(current)
      current = []
      y = 0
    }
    current.push({ ...item, layout: { x, y, w: ELEMENT_W, h: ELEMENT_H } })
    if (x === 0) { x = ELEMENT_W } else { x = 0; y += ELEMENT_H }
  }
  if (current.length > 0) pages.push(current)
  return pages
}

// Returns page content ready for useReportBuilder's seedPrintPages - no ids
// yet, those are assigned there so every call produces fresh, unique ones.
export function buildDashboardReplicaPages(form, submissions, visuals) {
  const dashboardTiles = form ? buildChartTiles(form, submissions).tiles : []
  const promotedVisuals = (visuals || []).filter(v => v.reportVisibility)

  const items = [
    ...dashboardTiles.map(t => ({ kind: 'tile', tileId: t.id })),
    ...promotedVisuals.map(v => ({ kind: 'visual', visualId: v.id, override: null })),
  ]
  if (items.length === 0) return []

  const packed = packIntoPages(items)
  return packed.map(elements => ({ elements }))
}
