import { describe, it, expect } from 'vitest'
import { nextZIndex, stepSwap, reindexFromOrder } from './zOrder'

const elements = [
  { id: 'a', zIndex: 1 },
  { id: 'b', zIndex: 2 },
  { id: 'c', zIndex: 3 },
]

describe('nextZIndex', () => {
  it('front returns one above the current max', () => {
    expect(nextZIndex(elements, 'front')).toBe(4)
  })

  it('back returns one below the current min', () => {
    expect(nextZIndex(elements, 'back')).toBe(-1)
  })

  it('never goes above 0 for front on an empty/all-negative page', () => {
    expect(nextZIndex([], 'front')).toBe(1)
  })

  it('returns null for an unrecognized mode', () => {
    expect(nextZIndex(elements, 'sideways')).toBe(null)
  })
})

describe('stepSwap', () => {
  it('forward swaps zIndex with the next element up the stack', () => {
    const [p1, p2] = stepSwap(elements, 'a', 1)
    expect(p1).toEqual({ id: 'a', zIndex: 2 })
    expect(p2).toEqual({ id: 'b', zIndex: 1 })
  })

  it('backward swaps zIndex with the next element down the stack', () => {
    const [p1, p2] = stepSwap(elements, 'c', -1)
    expect(p1).toEqual({ id: 'c', zIndex: 2 })
    expect(p2).toEqual({ id: 'b', zIndex: 3 })
  })

  it('returns null when already at the front and moving forward', () => {
    expect(stepSwap(elements, 'c', 1)).toBe(null)
  })

  it('returns null when already at the back and moving backward', () => {
    expect(stepSwap(elements, 'a', -1)).toBe(null)
  })

  it('returns null for an element that is not on the page', () => {
    expect(stepSwap(elements, 'missing', 1)).toBe(null)
  })

  it('treats a missing zIndex as 0 when sorting and swapping', () => {
    const withMissing = [{ id: 'x' }, { id: 'y', zIndex: 1 }]
    const [p1, p2] = stepSwap(withMissing, 'x', 1)
    expect(p1).toEqual({ id: 'x', zIndex: 1 })
    expect(p2).toEqual({ id: 'y', zIndex: 0 })
  })
})

describe('reindexFromOrder', () => {
  it('assigns the highest zIndex to the front-most id', () => {
    expect(reindexFromOrder(['a', 'b', 'c'])).toEqual({ a: 3, b: 2, c: 1 })
  })

  it('handles a single element', () => {
    expect(reindexFromOrder(['only'])).toEqual({ only: 1 })
  })

  it('handles an empty list', () => {
    expect(reindexFromOrder([])).toEqual({})
  })
})
