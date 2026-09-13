// Place at: src/report/builder/print/gridAdapter.js
// Bridges the canonical percentage-based element model (elementModel.js) to
// the grid-cell coordinate system react-grid-layout's GridLayout still
// expects, for the Phase 1 transition window before DesignerCanvas replaces
// it (see the Designer 2.0 plan). Once GridLayout is gone this file goes
// with it - it exists purely so the existing renderer and its callers keep
// working unmodified while useReportBuilder's state moves to percentages.
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'

export function toGridCells({ x = 0, y = 0, width = 100, height = 10 } = {}) {
  return {
    x: Math.round((x / 100) * GRID_COLS),
    y: Math.round((y / 100) * ROWS_PER_PAGE),
    w: Math.max(1, Math.round((width / 100) * GRID_COLS)),
    h: Math.max(1, Math.round((height / 100) * ROWS_PER_PAGE)),
  }
}

export function fromGridCells({ x = 0, y = 0, w = GRID_COLS, h = 4 } = {}) {
  return {
    x: (x / GRID_COLS) * 100,
    y: (y / ROWS_PER_PAGE) * 100,
    width: (w / GRID_COLS) * 100,
    height: (h / ROWS_PER_PAGE) * 100,
  }
}

// Attaches a `layout: {x,y,w,h}` grid-cell object derived from an element's
// canonical x/y/width/height, matching the shape PrintPage.jsx's <GridLayout>
// still reads today - lets PrintPage.jsx stay completely unmodified.
export function withGridLayout(element) {
  return { ...element, layout: toGridCells(element) }
}
