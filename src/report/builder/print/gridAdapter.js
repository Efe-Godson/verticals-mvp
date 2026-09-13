// Place at: src/report/builder/print/gridAdapter.js
// The react-grid-layout renderer this originally bridged to was removed at
// Designer 2.0 Phase 1 cutover (plan step 13) - what's left is a small
// units adapter: some element-creation inputs (printConstants.js's
// defaultElementSize, replicateDashboard.js's output) still describe a
// default size in grid-cell terms, and this converts that into the
// canonical percentage-of-page fields (elementModel.js) everything else
// uses. See useReportBuilder.js's addPrintElement/seedPrintPages.
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'

export function fromGridCells({ x = 0, y = 0, w = GRID_COLS, h = 4 } = {}) {
  return {
    x: (x / GRID_COLS) * 100,
    y: (y / ROWS_PER_PAGE) * 100,
    width: (w / GRID_COLS) * 100,
    height: (h / ROWS_PER_PAGE) * 100,
  }
}

// Resolves a candidate new element's width/height in percentage terms:
// prefers explicit width/height (already in percent - e.g. from
// elementModel.js's makeShapeElement/makeImageElement factories) and falls
// back to a legacy grid-cell layout.{w,h} otherwise (the sidebar's existing
// visual/tile/text "add" handlers in PrintWorkspace.jsx).
export function resolveElementSize(element) {
  if (Number.isFinite(element.width) && Number.isFinite(element.height)) {
    return { width: element.width, height: element.height }
  }
  const { width, height } = fromGridCells({ w: element.layout?.w ?? GRID_COLS, h: element.layout?.h ?? 4 })
  return { width, height }
}
