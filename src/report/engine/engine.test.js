import { describe, it, expect } from 'vitest'
import { runQuery } from './runQuery'
import { bucketDate } from './dateBuckets'
import { aggregateValues } from './aggregate'
import { listFields, fieldRole } from './fieldMeta'

const form = {
  id: 'form1',
  fields: [
    { id: 'staff', type: 'dropdown', label: 'Staff', options: ['Amara', 'Amos', 'David'] },
    { id: 'cat', type: 'dropdown', label: 'Category', options: ['Food', 'Drinks'] },
    { id: 'rating', type: 'rating', label: 'Rating', maxStars: 5 },
    { id: 'when', type: 'date', label: 'Date' },
    { id: 'order', type: 'cart', label: 'Order' },
    { id: 'note', type: 'section', label: 'Section' },
  ],
}

const subs = [
  { id: 's1', created_at: '2026-01-05T10:00:00Z', data: { staff: 'Amara', cat: 'Food', rating: 5, when: '2026-01-05', order: { items: [{ id: 'p', name: 'Rice', price: 1000, quantity: 2, category: 'Food' }], total: 2000, deliveryFee: 200 } } },
  { id: 's2', created_at: '2026-02-11T10:00:00Z', data: { staff: 'Amara', cat: 'Drinks', rating: 3, when: '2026-02-11', order: { items: [{ id: 'd', name: 'Cola', price: 500, quantity: 1, category: 'Drinks' }], total: 500, deliveryFee: 0 } } },
  { id: 's3', created_at: '2026-02-20T10:00:00Z', data: { staff: 'Amos', cat: 'Food', rating: 4, when: '2026-02-20', order: { items: [{ id: 'p', name: 'Rice', price: 1000, quantity: 3, category: 'Food' }], total: 3000, deliveryFee: 100 } } },
  { id: 's4', created_at: '2026-03-01T10:00:00Z', data: { staff: 'David', cat: 'Food', rating: 1, when: '2026-03-01', order: { items: [], total: 0 } } },
]

describe('fieldMeta', () => {
  it('classifies roles and drops sections/opaque', () => {
    expect(fieldRole(form.fields[0])).toBe('dimension')
    expect(fieldRole(form.fields[2])).toBe('measure')
    expect(fieldRole(form.fields[3])).toBe('date')
    expect(fieldRole(form.fields[4])).toBe('cart')
    expect(listFields(form).map(f => f.id)).toEqual(['staff', 'cat', 'rating', 'when', 'order'])
  })
})

describe('bucketDate', () => {
  it('buckets by granularity with chronologically-sortable keys', () => {
    expect(bucketDate('2026-02-11', 'year').key).toBe('2026')
    expect(bucketDate('2026-02-11', 'quarter').key).toBe('2026-Q1')
    expect(bucketDate('2026-05-11', 'quarter').key).toBe('2026-Q2')
    expect(bucketDate('2026-02-11', 'month').key).toBe('2026-02')
    expect(bucketDate('2026-02-11', 'day').key).toBe('2026-02-11')
    expect(bucketDate('', 'day')).toBeNull()
    expect(bucketDate('not-a-date', 'day')).toBeNull()
  })
})

describe('aggregateValues', () => {
  it('covers every aggregation', () => {
    expect(aggregateValues('sum', [1, 2, 3])).toBe(6)
    expect(aggregateValues('avg', [2, 4])).toBe(3)
    expect(aggregateValues('count', [1, 1, 1])).toBe(3)
    expect(aggregateValues('min', [5, 2, 9])).toBe(2)
    expect(aggregateValues('max', [5, 2, 9])).toBe(9)
    expect(aggregateValues('median', [1, 2, 3, 4])).toBe(2.5)
    expect(aggregateValues('distinct', [], ['a', 'a', 'b'])).toBe(2)
  })
})

describe('runQuery — series', () => {
  it('sum of cart revenue by staff, with population stats + rank + %', () => {
    const r = runQuery(
      { metric: 'order', cartMode: 'revenue', aggregation: 'sum', dimension: 'staff', sort: 'metric-desc' },
      { form, submissions: subs },
    )
    expect(r.kind).toBe('series')
    // Amara 2200+500=2700, Amos 3100, David empty cart -> dropped
    const byLabel = Object.fromEntries(r.rows.map(x => [x.label, x.value]))
    expect(byLabel).toEqual({ Amos: 3100, Amara: 2700 })
    expect(r.total).toBe(5800)
    expect(r.rows[0].label).toBe('Amos') // metric-desc
    const amos = r.perRow.find(x => x.label === 'Amos')
    expect(amos.rank).toBe(1)
    expect(Math.round(amos.percentOfTotal)).toBe(53)
    expect(r.sourceSubmissionIds.sort()).toEqual(['s1', 's2', 's3'])
  })

  it('count by category', () => {
    const r = runQuery({ metric: null, dimension: 'cat' }, { form, submissions: subs })
    expect(Object.fromEntries(r.rows.map(x => [x.label, x.value]))).toEqual({ Food: 3, Drinks: 1 })
  })

  it('average rating drops unanswered, not zero-fills', () => {
    const r = runQuery({ metric: 'rating', aggregation: 'avg', dimension: 'staff' }, { form, submissions: subs })
    const byLabel = Object.fromEntries(r.rows.map(x => [x.label, x.value]))
    expect(byLabel.Amara).toBe(4) // (5+3)/2
    expect(byLabel.Amos).toBe(4)
    expect(byLabel.David).toBe(1)
  })

  it('date dimension sorts chronologically by month', () => {
    const r = runQuery(
      { metric: null, dimension: 'when', dateGranularity: 'month' },
      { form, submissions: subs },
    )
    expect(r.rows.map(x => x.label)).toEqual(['Jan 2026', 'Feb 2026', 'Mar 2026'])
    expect(r.rows.map(x => x.value)).toEqual([1, 2, 1])
  })

  it('topN + sort', () => {
    const r = runQuery(
      { metric: null, dimension: 'staff', sort: 'metric-desc', topN: 1 },
      { form, submissions: subs },
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].label).toBe('Amara') // 2 responses
  })
})

describe('runQuery — matrix', () => {
  it('staff x category revenue with row/col/grand totals', () => {
    const r = runQuery(
      { kind: 'pivot', rows: ['staff'], cols: ['cat'], metric: 'order', cartMode: 'revenue', aggregation: 'sum' },
      { form, submissions: subs },
    )
    expect(r.kind).toBe('matrix')
    expect(r.matrix.grandTotal).toBe(5800)
    expect(r.matrix.cells.Amara.Food).toBe(2200)
    expect(r.matrix.cells.Amara.Drinks).toBe(500)
    expect(r.matrix.rowTotals.Amos).toBe(3100)
    expect(r.matrix.colTotals.Food).toBe(5300) // s1 2200 + s3 3100 (s4 cart empty -> dropped)
  })

  it('percent of grand total', () => {
    const r = runQuery(
      { kind: 'pivot', rows: ['staff'], cols: ['cat'], metric: 'order', cartMode: 'revenue', aggregation: 'sum', percentMode: 'grand' },
      { form, submissions: subs },
    )
    expect(Math.round(r.matrix.cells.Amos.Food)).toBe(53) // 3100/5800
  })

  it('secondary dimension emits grouped series', () => {
    const r = runQuery(
      { metric: null, dimension: 'staff', secondaryDimension: 'cat' },
      { form, submissions: subs },
    )
    expect(r.seriesLabels.sort()).toEqual(['Drinks', 'Food'])
    const amara = r.rows.find(x => x.label === 'Amara')
    expect(amara.bySeries.Food).toBe(1)
    expect(amara.bySeries.Drinks).toBe(1)
  })
})

describe('runQuery — scalar & scatter', () => {
  it('scalar KPI with previous-period comparison', () => {
    const r = runQuery(
      { metric: 'order', cartMode: 'revenue', aggregation: 'sum' },
      { form, submissions: subs, previousSubmissions: [subs[0]] },
    )
    expect(r.kind).toBe('scalar')
    expect(r.scalar.value).toBe(5800)
    expect(r.scalar.comparison.previous).toBe(2200)
    expect(r.scalar.comparison.direction).toBe('up')
  })

  it('scatter pairs two numeric fields per submission', () => {
    const r = runQuery(
      { kind: 'scatter', scatterX: 'rating', scatterY: 'rating', dimension: 'staff' },
      { form, submissions: subs },
    )
    expect(r.kind).toBe('scatter')
    expect(r.points).toHaveLength(4)
    expect(r.points[0]).toMatchObject({ x: 5, y: 5, label: 'Amara' })
  })
})
