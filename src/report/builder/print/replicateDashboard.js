// Place at: src/report/builder/print/replicateDashboard.js
// Auto-fills the Designer with a paginated replica of the main Report.jsx
// dashboard - a title page, then every chart tile (report/analysis/
// buildDashboardTiles.js) and every visual promoted to Reports, one per
// page - so Designer opens already looking like a finished deck instead of
// a blank page the user has to rebuild by hand.
import { buildChartTiles } from '../../analysis/buildDashboardTiles'
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'

// Rows reserved at the bottom of every content page as a deliberately empty
// footer band (the date/page-number overlays already live there - see
// PrintPage.jsx - this just keeps the visual itself from crowding them).
const FOOTER_ROWS = 3
const CONTENT_H = ROWS_PER_PAGE - FOOTER_ROWS

function buildTitlePage(form) {
  return {
    kind: 'title',
    elements: [
      {
        kind: 'text',
        text: { variant: 'title', content: form?.name || 'Report', align: 'center', bold: true },
        layout: { x: 1, y: 9, w: 10, h: 5 },
      },
      {
        kind: 'text',
        text: {
          variant: 'heading', align: 'center', bold: false,
          content: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        },
        layout: { x: 1, y: 14, w: 10, h: 3 },
      },
    ],
  }
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

  // One visual per page, full width, filling the page (minus the footer
  // band) - not the dashboard's own cramped two-per-row grid. Its own inline
  // header (see PrintVisualElement/PrintTileElement) already serves as the
  // page's title section, so this needs no separate title text element.
  const contentPages = items.map(item => ({
    kind: 'content',
    elements: [{ ...item, layout: { x: 0, y: 0, w: GRID_COLS, h: CONTENT_H } }],
  }))

  return [buildTitlePage(form), ...contentPages]
}
