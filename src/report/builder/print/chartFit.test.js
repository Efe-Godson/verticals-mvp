import { describe, expect, it } from 'vitest'
import { fitChartInBox } from './chartFit'
describe('designer chart containment', () => {
  it('fits a full ten-row chart inside a shallow slide cell', () => {
    const fit = fitChartInBox(580, 210, 640, 520)
    expect(fit.scale * 520).toBeLessThanOrEqual(210)
    expect(fit.scale * 640).toBeLessThanOrEqual(580)
    expect(fit.y).toBe(0)
  })
  it('centers a fixed-size visual without stretching its aspect ratio', () => {
    expect(fitChartInBox(320, 300, 640, 360)).toEqual({ scale: 0.5, x: 0, y: 60 })
  })
  it('does not enlarge already readable content', () => {
    expect(fitChartInBox(800, 600, 640, 360).scale).toBe(1)
  })
  it('waits for valid measurements', () => {
    expect(fitChartInBox(0, 0, 640, 360).scale).toBe(0)
  })
})
