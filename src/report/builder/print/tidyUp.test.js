import { describe, expect, it } from 'vitest'
import { applyGridPatch, snapBoxToGrid } from './tidyUp'

describe('mandatory designer grid', () => {
  it('snaps fractional positions and sizes while keeping the full box on the page', () => {
    expect(snapBoxToGrid({ x: 95.8, y: -2, width: 12.3, height: 0.2 })).toEqual({ x: 88, y: 0, width: 12, height: 1 })
  })
  it('applies the same grid to inspector and drag patches', () => {
    const el = { id: 'a', x: 2, y: 3, width: 20, height: 10 }
    expect(applyGridPatch(el, { x: 8.7 }).x).toBe(9)
    expect(applyGridPatch(el, { width: 120 }).width).toBe(100)
  })
  it('preserves geometry when only content changes', () => {
    const el = { x: 2.3, y: 3, width: 20, height: 10 }
    expect(applyGridPatch(el, { text: 'Updated' })).toEqual({ ...el, text: 'Updated' })
  })
})
