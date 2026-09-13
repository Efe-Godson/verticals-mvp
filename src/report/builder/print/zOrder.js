// Place at: src/report/builder/print/zOrder.js
// Pure z-index arithmetic for the Layers "Arrange" commands (Designer 2.0
// Phase 1, step 5) - kept separate from useReportBuilder.js's state
// plumbing so the stacking math is unit-testable without mounting the hook.

export function nextZIndex(elements, mode) {
  const zs = elements.map(e => e.zIndex || 0)
  if (mode === 'front') return Math.max(0, ...zs) + 1
  if (mode === 'back') return Math.min(0, ...zs) - 1
  return null
}

// "Forward"/"backward" swap zIndex with whichever element is next in the
// page's current stacking order, so repeated presses walk one step at a
// time instead of jumping straight to front/back. Returns the two
// {id, zIndex} patches to apply, or null if elementId is already at that
// end of the stack (or not found).
export function stepSwap(elements, elementId, direction) {
  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  const idx = sorted.findIndex(e => e.id === elementId)
  const swapIdx = idx + direction
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return null
  const a = sorted[idx], b = sorted[swapIdx]
  return [{ id: a.id, zIndex: b.zIndex || 0 }, { id: b.id, zIndex: a.zIndex || 0 }]
}
