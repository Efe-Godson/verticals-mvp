// Place at: src/report/builder/print/migratePrintLayout.js
// Backward-compatible upgrade from the legacy grid-cell layout (schemaVersion
// missing/1 - integer x/y/w/h in GRID_COLS x ROWS_PER_PAGE cells, react-grid-
// layout's own coordinate system) to the freeform percentage-based element
// model (schemaVersion 2 - see elementModel.js). Runs once, lazily, in
// memory, the first time a document loads after this shipped; the upgraded
// shape is only written back to the database on the document's next save
// (manual or autosave), so a document nobody reopens is simply left in its
// original shape indefinitely - harmless, since nothing outside this
// feature's own files reads printLayout.
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'
import { CURRENT_SCHEMA_VERSION } from './elementModel'

// zIndex is assigned from each element's position in the array - that array
// order is exactly what today's renderer uses as implicit stacking (later
// elements painted on top), so this preserves current visual stacking
// exactly rather than reshuffling anything.
function migrateElement(el, index) {
  const layout = el.layout || {}
  const { layout: _legacy, ...rest } = el
  return {
    ...rest,
    x: ((layout.x ?? 0) / GRID_COLS) * 100,
    y: ((layout.y ?? 0) / ROWS_PER_PAGE) * 100,
    width: ((layout.w ?? GRID_COLS) / GRID_COLS) * 100,
    height: ((layout.h ?? 4) / ROWS_PER_PAGE) * 100,
    rotation: 0,
    zIndex: index + 1,
    locked: false,
    visible: true,
    // Kept for one release as a rollback safety net - if a Phase 1 canvas
    // bug requires falling back to the exact original numbers, they're
    // still here rather than lossily reconstructed from percentages.
    legacyLayout: layout,
  }
}

export function migratePrintLayout(printLayout) {
  if (!printLayout) return printLayout
  if ((printLayout.schemaVersion || 1) >= CURRENT_SCHEMA_VERSION) return printLayout
  const pages = (printLayout.pages || []).map(page => ({
    ...page,
    elements: (page.elements || []).map(migrateElement),
  }))
  return { ...printLayout, schemaVersion: CURRENT_SCHEMA_VERSION, pages }
}
