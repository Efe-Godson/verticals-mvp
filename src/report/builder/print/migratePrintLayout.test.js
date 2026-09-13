import { describe, it, expect } from 'vitest'
import { migratePrintLayout } from './migratePrintLayout'
import { CURRENT_SCHEMA_VERSION } from './elementModel'
import { GRID_COLS, ROWS_PER_PAGE } from './printConstants'

// Fixtures mirror replicateDashboard.js's real current output, so a passing
// test means "old documents built by the existing seeder still look the
// same after migration", not just "the function runs without throwing".
const titlePage = {
  kind: 'title',
  elements: [
    { id: 'el1', kind: 'text', text: { variant: 'title', content: 'Report', align: 'center', bold: true }, layout: { x: 1, y: 9, w: 10, h: 5 } },
    { id: 'el2', kind: 'text', text: { variant: 'heading', align: 'center', bold: false, content: 'September 2026' }, layout: { x: 1, y: 14, w: 10, h: 3 } },
  ],
}

const contentPage = {
  kind: 'content',
  elements: [
    { id: 'el3', kind: 'visual', visualId: 'v1', override: null, layout: { x: 0, y: 0, w: GRID_COLS, h: ROWS_PER_PAGE - 3 } },
  ],
}

const multiElementPage = {
  kind: 'content',
  elements: [
    { id: 'a', kind: 'visual', visualId: 'v1', override: null, layout: { x: 0, y: 0, w: 6, h: 10 } },
    { id: 'b', kind: 'tile', tileId: 't1', layout: { x: 6, y: 0, w: 6, h: 10 } },
    { id: 'c', kind: 'text', text: { variant: 'body', content: 'note', align: 'left', bold: false }, layout: { x: 0, y: 10, w: 12, h: 3 } },
  ],
}

describe('migratePrintLayout', () => {
  it('is a no-op for an already-current document', () => {
    const current = { schemaVersion: CURRENT_SCHEMA_VERSION, pages: [] }
    expect(migratePrintLayout(current)).toBe(current)
  })

  it('passes through null/undefined', () => {
    expect(migratePrintLayout(null)).toBe(null)
    expect(migratePrintLayout(undefined)).toBe(undefined)
  })

  it('stamps schemaVersion 2 and converts grid-cell layout to percentages', () => {
    const legacy = { pageSize: 'slide', orientation: 'landscape', pages: [titlePage, contentPage] }
    const migrated = migratePrintLayout(legacy)

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    const [t1, t2] = migrated.pages[0].elements
    expect(t1.x).toBeCloseTo((1 / GRID_COLS) * 100)
    expect(t1.y).toBeCloseTo((9 / ROWS_PER_PAGE) * 100)
    expect(t1.width).toBeCloseTo((10 / GRID_COLS) * 100)
    expect(t1.height).toBeCloseTo((5 / ROWS_PER_PAGE) * 100)
    expect(t2.x).toBeCloseTo((1 / GRID_COLS) * 100)

    const [v1] = migrated.pages[1].elements
    expect(v1.width).toBeCloseTo(100)
    expect(v1.visualId).toBe('v1')
    expect(v1.override).toBe(null)
  })

  it('sets rotation/locked/visible defaults and preserves the legacy layout for rollback', () => {
    const legacy = { pages: [titlePage] }
    const migrated = migratePrintLayout(legacy)
    const el = migrated.pages[0].elements[0]
    expect(el.rotation).toBe(0)
    expect(el.locked).toBe(false)
    expect(el.visible).toBe(true)
    expect(el.legacyLayout).toEqual(titlePage.elements[0].layout)
  })

  it('assigns zIndex from array order, preserving today\'s implicit DOM-order stacking', () => {
    const legacy = { pages: [multiElementPage] }
    const migrated = migratePrintLayout(legacy)
    const [a, b, c] = migrated.pages[0].elements
    expect(a.zIndex).toBe(1)
    expect(b.zIndex).toBe(2)
    expect(c.zIndex).toBe(3)
  })

  it('carries kind-specific fields over verbatim so old content renders unchanged', () => {
    const legacy = { pages: [multiElementPage] }
    const migrated = migratePrintLayout(legacy)
    const [a, b, c] = migrated.pages[0].elements
    expect(a.kind).toBe('visual')
    expect(a.visualId).toBe('v1')
    expect(b.kind).toBe('tile')
    expect(b.tileId).toBe('t1')
    expect(c.kind).toBe('text')
    expect(c.text).toEqual({ variant: 'body', content: 'note', align: 'left', bold: false })
  })

  it('treats a missing schemaVersion the same as version 1', () => {
    const withoutVersion = migratePrintLayout({ pages: [titlePage] })
    const withVersion1 = migratePrintLayout({ schemaVersion: 1, pages: [titlePage] })
    expect(withoutVersion.pages).toEqual(withVersion1.pages)
  })

  it('handles a printLayout with no pages', () => {
    const migrated = migratePrintLayout({ pageSize: 'a4', pages: [] })
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.pages).toEqual([])
  })
})
