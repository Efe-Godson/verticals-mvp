import { describe, it, expect } from 'vitest'
import { fromGridCells, resolveElementSize } from './gridAdapter'
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'

describe('fromGridCells', () => {
  it('converts grid cells to percentages', () => {
    expect(fromGridCells({ x: 0, y: 0, w: GRID_COLS, h: ROWS_PER_PAGE })).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    expect(fromGridCells({ x: 6, y: 13, w: 6, h: 13 })).toEqual({
      x: (6 / GRID_COLS) * 100, y: (13 / ROWS_PER_PAGE) * 100,
      width: (6 / GRID_COLS) * 100, height: (13 / ROWS_PER_PAGE) * 100,
    })
  })

  it('applies sensible defaults when fields are missing', () => {
    expect(fromGridCells()).toEqual({ x: 0, y: 0, width: 100, height: (4 / ROWS_PER_PAGE) * 100 })
  })
})

describe('resolveElementSize', () => {
  it('prefers explicit percentage width/height when present', () => {
    expect(resolveElementSize({ width: 20, height: 15, layout: { w: 12, h: 26 } })).toEqual({ width: 20, height: 15 })
  })

  it('falls back to converting a legacy grid-cell layout when width/height are absent', () => {
    expect(resolveElementSize({ layout: { w: 6, h: 13 } })).toEqual({ width: (6 / GRID_COLS) * 100, height: (13 / ROWS_PER_PAGE) * 100 })
  })

  it('falls back to full-width/default-height defaults with neither present', () => {
    expect(resolveElementSize({})).toEqual({ width: 100, height: (4 / ROWS_PER_PAGE) * 100 })
  })

  it('does not mistake a zero width/height for "absent"', () => {
    expect(resolveElementSize({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 })
  })
})
