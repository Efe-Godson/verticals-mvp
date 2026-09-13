import { describe, it, expect } from 'vitest'
import { toGridCells, fromGridCells, withGridLayout } from './gridAdapter'
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'

describe('gridAdapter', () => {
  it('converts percentages to grid cells', () => {
    expect(toGridCells({ x: 0, y: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 0, w: GRID_COLS, h: ROWS_PER_PAGE })
    expect(toGridCells({ x: 50, y: 50, width: 50, height: 50 })).toEqual({
      x: Math.round(0.5 * GRID_COLS), y: Math.round(0.5 * ROWS_PER_PAGE),
      w: Math.round(0.5 * GRID_COLS), h: Math.round(0.5 * ROWS_PER_PAGE),
    })
  })

  it('never produces a zero-size grid cell (GridLayout requires a positive w/h)', () => {
    expect(toGridCells({ x: 0, y: 0, width: 1, height: 1 }).w).toBeGreaterThanOrEqual(1)
    expect(toGridCells({ x: 0, y: 0, width: 1, height: 1 }).h).toBeGreaterThanOrEqual(1)
  })

  it('converts grid cells back to percentages', () => {
    expect(fromGridCells({ x: 0, y: 0, w: GRID_COLS, h: ROWS_PER_PAGE })).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    expect(fromGridCells({ x: 6, y: 13, w: 6, h: 13 })).toEqual({
      x: (6 / GRID_COLS) * 100, y: (13 / ROWS_PER_PAGE) * 100,
      width: (6 / GRID_COLS) * 100, height: (13 / ROWS_PER_PAGE) * 100,
    })
  })

  it('round-trips grid-cell integers exactly through percentages and back', () => {
    const original = { x: 3, y: 7, w: 5, h: 10 }
    const pct = fromGridCells(original)
    expect(toGridCells(pct)).toEqual(original)
  })

  it('withGridLayout attaches a layout object without dropping other fields', () => {
    const el = { id: 'a', kind: 'text', x: 0, y: 0, width: 100, height: 12, text: { content: 'hi' } }
    const withLayout = withGridLayout(el)
    expect(withLayout.text).toEqual({ content: 'hi' })
    expect(withLayout.layout).toEqual(toGridCells(el))
  })

  it('applies sensible defaults when fields are missing', () => {
    expect(toGridCells()).toEqual({ x: 0, y: 0, w: GRID_COLS, h: Math.round(0.1 * ROWS_PER_PAGE) })
    expect(fromGridCells()).toEqual({ x: 0, y: 0, width: 100, height: (4 / ROWS_PER_PAGE) * 100 })
  })
})
