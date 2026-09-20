import { describe, it, expect } from 'vitest'
import { buildKpis, formatKpiValue } from './buildKpis'

describe('buildKpis sanity', () => {
  it('computes primary + more KPIs from synthetic cart data', () => {
    const form = {
      fields: [
        { id: 'cart1', type: 'cart' },
        { id: 'rep', type: 'dropdown', label: 'Sales Rep' },
        { id: 'age', type: 'number', label: 'Age' },
        { id: 'email', type: 'email', label: 'Email' },
        { id: 'visit_date', type: 'date', label: 'Visit Date' },
      ],
    }
    const submissions = [
      { created_at: '2026-09-01T10:00:00Z', data: { cart1: { items: [{ quantity: 2 }], total: 100, deliveryFee: 10 }, rep: 'Ada', age: 30, email: 'a@x.com', visit_date: '2026-09-01' } },
      { created_at: '2026-09-05T10:00:00Z', data: { cart1: { items: [{ quantity: 1 }], total: 50, deliveryFee: 0 }, rep: 'Bo', age: 40, email: '', visit_date: '2026-09-05' } },
      { created_at: '2026-09-10T10:00:00Z', data: { rep: 'Ada', age: 25 } },
    ]
    const { primaryKpis, moreKpis } = buildKpis({ form, submissions })
    expect(primaryKpis.map(k => k.label)).toEqual(['Revenue', 'Orders', 'Average Order Value'])
    expect(formatKpiValue(primaryKpis[0].raw, primaryKpis[0].kind, 'full')).toBe('₦160')
    expect(moreKpis.map(k => k.label)).toEqual(expect.arrayContaining([
      'Median Order Value', 'Highest Order Value', 'Total Items Sold', 'Average Items per Order',
      'Total Orders', 'Average Age', 'Median Age', 'Highest Age', 'Lowest Age',
      'Top Sales Rep', 'Distinct Sales Rep values', 'Email Provided',
    ]))
  })

  it('handles a form with no cart field at all', () => {
    const form = { fields: [{ id: 'age', type: 'number', label: 'Age' }] }
    const submissions = [{ created_at: '2026-01-01T00:00:00Z', data: { age: 10 } }]
    const { primaryKpis, moreKpis } = buildKpis({ form, submissions })
    expect(primaryKpis).toEqual([])
    expect(moreKpis.some(k => k.label === 'Total Responses')).toBe(true)
  })
})
