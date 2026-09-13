// Place at: src/report/builder/print/history.js
// Pure undo/redo stack (Designer 2.0 Phase 1, step 11) - deliberately
// framework-free like snapping.js/zOrder.js, so the whole state machine
// (including gesture batching, the highest-risk part) is unit-testable
// without mounting a component. useHistory.js wraps this in a React hook
// that just holds one of these in a ref and forces a re-render after each
// change - all the actual logic lives here.
//
// A history is { past: T[], present: T, future: T[], batchDepth, batchStart }.
// record() pushes the current present onto past and installs a new present,
// clearing future (the standard "new edit invalidates redo" rule).
// undo()/redo() just move the pointer - they never drop or rewrite
// past/future entries.
//
// beginBatch()/commitBatch() collapse a gesture that spans multiple
// record() calls into one undo step: while batchDepth > 0, record() updates
// `present` directly without pushing, and commitBatch() (once depth returns
// to 0) pushes exactly one past->present transition covering the whole
// span. Depth-counted so nested begin/commit pairs collapse into the
// outermost span instead of committing early.

export function createHistoryState(initial) {
  return { past: [], present: initial, future: [], batchDepth: 0, batchStart: undefined }
}

export function recordHistory(hist, next, { maxSize = 100 } = {}) {
  if (hist.batchDepth > 0) {
    if (next === hist.present) return hist
    return { ...hist, present: next }
  }
  if (next === hist.present) return hist
  const past = hist.past.length >= maxSize ? [...hist.past.slice(1), hist.present] : [...hist.past, hist.present]
  return { ...hist, past, present: next, future: [] }
}

export function beginHistoryBatch(hist) {
  return {
    ...hist,
    batchDepth: hist.batchDepth + 1,
    batchStart: hist.batchDepth === 0 ? hist.present : hist.batchStart,
  }
}

export function commitHistoryBatch(hist, { maxSize = 100 } = {}) {
  const batchDepth = Math.max(0, hist.batchDepth - 1)
  if (batchDepth > 0) return { ...hist, batchDepth }
  const start = hist.batchStart
  const finalValue = hist.present
  if (start === undefined || finalValue === start) return { ...hist, batchDepth, batchStart: undefined }
  const pushed = recordHistory({ ...hist, present: start, batchDepth: 0 }, finalValue, { maxSize })
  return { ...pushed, batchDepth: 0, batchStart: undefined }
}

export function undoHistory(hist) {
  if (hist.past.length === 0) return hist
  const present = hist.past[hist.past.length - 1]
  return { ...hist, past: hist.past.slice(0, -1), present, future: [hist.present, ...hist.future] }
}

export function redoHistory(hist) {
  if (hist.future.length === 0) return hist
  const present = hist.future[0]
  return { ...hist, past: [...hist.past, hist.present], present, future: hist.future.slice(1) }
}
