import { describe, it, expect } from 'vitest'
import {
  createHistoryState, recordHistory, undoHistory, redoHistory,
  beginHistoryBatch, commitHistoryBatch,
} from './history'

describe('createHistoryState', () => {
  it('starts with an empty past/future, no open batch, and the given present', () => {
    expect(createHistoryState('A')).toEqual({ past: [], present: 'A', future: [], batchDepth: 0, batchStart: undefined })
  })
})

describe('recordHistory', () => {
  it('pushes the current present onto past and installs the next value', () => {
    const h = recordHistory(createHistoryState('A'), 'B')
    expect(h.past).toEqual(['A'])
    expect(h.present).toBe('B')
    expect(h.future).toEqual([])
  })

  it('clears future - a new edit invalidates redo', () => {
    const h = { ...createHistoryState('B'), past: ['A'], future: ['C'] }
    expect(recordHistory(h, 'D').future).toEqual([])
  })

  it('is a no-op when the next value is reference-equal to present', () => {
    const h = createHistoryState('A')
    expect(recordHistory(h, 'A')).toBe(h)
  })

  it('caps past at maxSize by dropping the oldest entry', () => {
    let h = createHistoryState('0')
    for (let i = 1; i <= 5; i++) h = recordHistory(h, String(i), { maxSize: 3 })
    expect(h.past).toEqual(['2', '3', '4'])
    expect(h.present).toBe('5')
  })
})

describe('undoHistory / redoHistory', () => {
  it('undo moves present back one step and pushes it onto future', () => {
    const h = { ...createHistoryState('B'), past: ['A'] }
    expect(undoHistory(h)).toMatchObject({ past: [], present: 'A', future: ['B'] })
  })

  it('undo is a no-op when past is empty', () => {
    const h = createHistoryState('A')
    expect(undoHistory(h)).toBe(h)
  })

  it('redo is a no-op when future is empty', () => {
    const h = createHistoryState('A')
    expect(redoHistory(h)).toBe(h)
  })

  it('round-trips: undo then redo returns to the same state', () => {
    let h = createHistoryState('A')
    h = recordHistory(h, 'B')
    h = recordHistory(h, 'C')
    const afterRedo = redoHistory(undoHistory(h))
    expect(afterRedo).toEqual(h)
  })
})

// This is the part the Designer 2.0 plan calls out as one of the two
// highest-risk items in the whole project: a gesture (drag, resize, a
// Format Inspector field held focused across several edits) must collapse
// to exactly one undo step, and must never leave the stack in a state that
// loses the gesture's final value.
describe('beginHistoryBatch / commitHistoryBatch', () => {
  it('collapses several record() calls inside one batch into a single past entry', () => {
    let h = createHistoryState('A')
    h = beginHistoryBatch(h)
    h = recordHistory(h, 'A1')
    h = recordHistory(h, 'A2')
    h = recordHistory(h, 'A3')
    h = commitHistoryBatch(h)
    expect(h.past).toEqual(['A'])
    expect(h.present).toBe('A3')
    expect(h.future).toEqual([])
  })

  it('a single undo after a batch returns to the pre-batch value, not an intermediate one', () => {
    let h = createHistoryState('A')
    h = beginHistoryBatch(h)
    h = recordHistory(h, 'A1')
    h = recordHistory(h, 'A2')
    h = commitHistoryBatch(h)
    expect(undoHistory(h).present).toBe('A')
  })

  it('records nothing when the batch ends with no net change', () => {
    let h = createHistoryState('A')
    h = beginHistoryBatch(h)
    h = recordHistory(h, 'A1')
    h = recordHistory(h, 'A') // back to the starting value
    h = commitHistoryBatch(h)
    expect(h).toEqual(createHistoryState('A'))
  })

  it('commitBatch with no matching beginBatch is a no-op', () => {
    const h = createHistoryState('A')
    expect(commitHistoryBatch(h)).toEqual({ ...h, batchDepth: 0, batchStart: undefined })
  })

  it('nested begin/commit pairs only commit on the outermost pair', () => {
    let h = createHistoryState('A')
    h = beginHistoryBatch(h)
    h = beginHistoryBatch(h) // nested - e.g. a re-entrant call
    h = recordHistory(h, 'A1')
    h = commitHistoryBatch(h) // inner commit: depth 2 -> 1, must not push yet
    expect(h.past).toEqual([])
    expect(h.present).toBe('A1')
    h = recordHistory(h, 'A2')
    h = commitHistoryBatch(h) // outer commit: depth 1 -> 0, pushes now
    expect(h.past).toEqual(['A'])
    expect(h.present).toBe('A2')
  })

  it('a record() outside any batch behaves exactly like the unbatched case', () => {
    let h = createHistoryState('A')
    h = recordHistory(h, 'B')
    expect(h.past).toEqual(['A'])
    expect(h.present).toBe('B')
  })

  it('a batch that never calls record() commits nothing', () => {
    let h = createHistoryState('A')
    h = beginHistoryBatch(h)
    h = commitHistoryBatch(h)
    expect(h).toEqual(createHistoryState('A'))
  })

  it('undo/redo still work correctly on a history that mixes batched and unbatched edits', () => {
    let h = createHistoryState('A')
    h = recordHistory(h, 'B') // unbatched edit
    h = beginHistoryBatch(h)
    h = recordHistory(h, 'B1')
    h = recordHistory(h, 'B2')
    h = commitHistoryBatch(h) // one batched edit, B -> B2
    h = recordHistory(h, 'C') // unbatched edit
    expect(h.past).toEqual(['A', 'B', 'B2'])
    expect(h.present).toBe('C')
    h = undoHistory(h)
    expect(h.present).toBe('B2')
    h = undoHistory(h)
    expect(h.present).toBe('B')
    h = undoHistory(h)
    expect(h.present).toBe('A')
  })
})
