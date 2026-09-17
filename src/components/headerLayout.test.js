import { describe, expect, it } from 'vitest'
import { getHeaderLayout } from './headerLayout'

describe('header filter overflow', () => {
  it('keeps normal business names and compact controls on one row', () => {
    expect(getHeaderLayout(720, 220, 100, 420, 300)).toEqual({ condensed: false, filterWidth: 368 })
  })
  it('uses full size controls when room is available', () => {
    expect(getHeaderLayout(1000, 220, 100, 420, 300)).toEqual({ condensed: false, filterWidth: 420 })
  })
  it('moves controls into Options when a long name leaves insufficient room', () => {
    expect(getHeaderLayout(720, 480, 100, 420, 300).condensed).toBe(true)
  })
  it('restores inline controls when the bar grows', () => {
    expect(getHeaderLayout(1000, 480, 100, 420, 300).condensed).toBe(false)
  })
})
