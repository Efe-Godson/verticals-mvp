// Place at: src/report/builder/print/useHistory.js
// Thin React wrapper around history.js's pure state machine (Designer 2.0
// Phase 1, step 11) - all actual logic (including batching) lives there and
// is unit-tested there; this just holds one in a ref and forces a
// re-render after each change so canUndo/canRedo-driven UI stays in sync.
//
// Kept in a ref, not state: undo/redo has to stay correct across however
// many synchronous record() calls happen before a component re-renders, and
// a ref read/write isn't subject to React's setState batching order the
// way a state-derived value would be. See useReportBuilder.js's
// mutatePrint for why record() is always called as a plain side effect in
// the caller's code, never from inside another hook's setState updater
// (StrictMode double-invokes updater functions to catch impurities, which
// would double-record every edit).
import { useCallback, useRef, useState } from 'react'
import { createHistoryState, recordHistory, undoHistory, redoHistory, beginHistoryBatch, commitHistoryBatch } from './history'

export function useHistory(initialValue, { maxSize = 100 } = {}) {
  const ref = useRef(createHistoryState(initialValue))
  const [, setTick] = useState(0)
  const bump = useCallback(() => setTick(t => t + 1), [])

  const reset = useCallback((value) => { ref.current = createHistoryState(value); bump() }, [bump])

  const record = useCallback((value) => {
    const next = recordHistory(ref.current, value, { maxSize })
    if (next !== ref.current) { ref.current = next; bump() }
  }, [bump, maxSize])

  const beginBatch = useCallback(() => { ref.current = beginHistoryBatch(ref.current) }, [])

  const commitBatch = useCallback(() => {
    const next = commitHistoryBatch(ref.current, { maxSize })
    if (next !== ref.current) { ref.current = next; bump() }
  }, [bump, maxSize])

  const undo = useCallback(() => {
    if (ref.current.past.length === 0) return undefined
    ref.current = undoHistory(ref.current)
    bump()
    return ref.current.present
  }, [bump])

  const redo = useCallback(() => {
    if (ref.current.future.length === 0) return undefined
    ref.current = redoHistory(ref.current)
    bump()
    return ref.current.present
  }, [bump])

  return {
    record, beginBatch, commitBatch, undo, redo, reset,
    canUndo: ref.current.past.length > 0,
    canRedo: ref.current.future.length > 0,
  }
}
