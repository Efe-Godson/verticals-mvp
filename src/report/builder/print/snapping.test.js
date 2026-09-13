import { describe, it, expect } from 'vitest'
import { snapOneAxis, snapEqualSpacing, computeSnap } from './snapping'

const page = { width: 1000, height: 500 }

describe('snapOneAxis', () => {
  it('snaps the start edge to a candidate line within tolerance', () => {
    const result = snapOneAxis(103, 200, [{ value: 100, source: 'page-edge' }], 6)
    expect(result.start).toBe(100)
    expect(result.refKind).toBe('start')
  })

  it('snaps the center to a candidate line within tolerance', () => {
    // box start=190, width=20 -> center=200; candidate at 202 is within tolerance of the center
    const result = snapOneAxis(190, 20, [{ value: 202, source: 'page-center' }], 6)
    expect(result.refKind).toBe('center')
    expect(result.start).toBe(192) // shifts start by +2 so center lands on 202
  })

  it('snaps the end edge to a candidate line within tolerance', () => {
    // box start=100, width=50 -> end=150; candidate at 148 within tolerance
    const result = snapOneAxis(100, 50, [{ value: 148, source: 'element', elementId: 'x' }], 6)
    expect(result.refKind).toBe('end')
    expect(result.start).toBe(98)
  })

  it('returns null when nothing is within tolerance', () => {
    expect(snapOneAxis(100, 50, [{ value: 500, source: 'page-edge' }], 6)).toBe(null)
  })

  it('picks the closest match when multiple candidates are within tolerance', () => {
    const result = snapOneAxis(100, 50, [
      { value: 104, source: 'a' },
      { value: 101, source: 'b' },
    ], 6)
    expect(result.source).toBe('b')
  })
})

describe('snapEqualSpacing', () => {
  it('snaps to equalize two already-close gaps', () => {
    // left neighbor ends at 100, right neighbor starts at 250, box width 40
    // dragged near start=118 -> gapLeft=18, gapRight=250-158=92 -> not close enough
    // try a box positioned so gaps are already close: start=145 -> end=185, gapLeft=45, gapRight=65 -> diff 20, still not close with tol 6
    // use a case with a small diff within tolerance
    const others = [{ id: 'left', x: 0, width: 100 }, { id: 'right', x: 250, width: 50 }]
    // gap target: total space between neighbors = 250-100=150, box width 40 -> equal gap = 55 each
    // start = 100+55 = 155, end=195, gapRight = 250-195=55 - exactly equal, diff 0
    const result = snapEqualSpacing(155, 40, others, 'x', 6)
    expect(result).not.toBe(null)
    expect(result.gap).toBe(55)
    expect(result.leftId).toBe('left')
    expect(result.rightId).toBe('right')
  })

  it('returns null when gaps are far from equal', () => {
    const others = [{ id: 'left', x: 0, width: 100 }, { id: 'right', x: 250, width: 50 }]
    const result = snapEqualSpacing(110, 40, others, 'x', 6) // gapLeft=10, gapRight=100
    expect(result).toBe(null)
  })

  it('returns null with fewer than two other elements', () => {
    expect(snapEqualSpacing(50, 20, [{ id: 'only', x: 0, width: 10 }], 'x')).toBe(null)
  })

  it('returns null when there is no neighbor on one side', () => {
    const others = [{ id: 'left', x: 0, width: 100 }, { id: 'also-left', x: 20, width: 30 }]
    expect(snapEqualSpacing(500, 40, others, 'x', 6)).toBe(null)
  })

  it('works on the y axis using height', () => {
    const others = [{ id: 'top', y: 0, height: 100 }, { id: 'bottom', y: 250, height: 50 }]
    const result = snapEqualSpacing(155, 40, others, 'y', 6)
    expect(result.gap).toBe(55)
  })
})

describe('computeSnap', () => {
  it('snaps to the page center on both axes when close enough', () => {
    const box = { x: 502, y: 248, width: 100, height: 50 }
    // box center = (552, 273); page center = (500, 250) - not aligned by center-to-page-center directly
    // use a box already centered on the page for a clean center-snap check
    const centered = { x: 448, y: 223, width: 100, height: 50 } // center = (498, 248), near page center (500, 250)
    const result = computeSnap(centered, page, [])
    expect(result.guideX).toEqual({ type: 'align', line: 500, source: 'page-center', elementId: undefined })
    expect(result.guideY).toEqual({ type: 'align', line: 250, source: 'page-center', elementId: undefined })
    expect(result.x).toBe(450)
    expect(result.y).toBe(225)
  })

  it('prefers align-snap over equal-spacing when both could apply', () => {
    const others = [{ id: 'a', x: 0, y: 0, width: 100, height: 50 }]
    // box left edge (98) is close to element a's right edge (100)
    const box = { x: 98, y: 300, width: 40, height: 20 }
    const result = computeSnap(box, page, others)
    expect(result.guideX.type).toBe('align')
  })

  it('falls back to equal-spacing when no align candidate matches', () => {
    const others = [{ id: 'left', x: 0, y: 0, width: 100, height: 20 }, { id: 'right', x: 250, y: 0, width: 50, height: 20 }]
    const box = { x: 155, y: 300, width: 40, height: 20 }
    const result = computeSnap(box, page, others)
    expect(result.guideX.type).toBe('equal-spacing')
  })

  it('returns the original position unsnapped when nothing matches', () => {
    const box = { x: 33, y: 77, width: 10, height: 10 }
    const result = computeSnap(box, page, [])
    expect(result.x).toBe(33)
    expect(result.y).toBe(77)
    expect(result.guideX).toBe(null)
    expect(result.guideY).toBe(null)
  })
})
