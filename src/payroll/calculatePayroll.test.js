import { describe, it, expect } from 'vitest'
import { daysInPeriod, getDailyRate, signedAmount, calculateEmployeePayroll } from './calculatePayroll'

const entry = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  entry_category: 'deduction',
  entry_type: 'fine',
  quantity: null,
  amount: 0,
  reason: '',
  ...over,
})

describe('daysInPeriod', () => {
  it('uses calendar days by default', () => {
    expect(daysInPeriod('2026-07')).toBe(31)
    expect(daysInPeriod('2026-02')).toBe(28)
    expect(daysInPeriod('2024-02')).toBe(29)
  })

  it('uses fixed working days when configured', () => {
    expect(daysInPeriod('2026-07', 'fixed_working_days', 26)).toBe(26)
    expect(daysInPeriod('2026-07', 'fixed_working_days')).toBe(30)
  })
})

describe('getDailyRate', () => {
  it('divides monthly salary by calendar days without pre-rounding (doc section 38)', () => {
    const rate = getDailyRate(100000, '2026-07', {})
    expect(rate).toBeCloseTo(3225.806451, 5)
    // must NOT be the rounded 3226
    expect(Number.isInteger(rate)).toBe(false)
  })
})

describe('signedAmount', () => {
  it('negates deductions and keeps additions positive', () => {
    expect(signedAmount({ entry_category: 'deduction', amount: 3000 })).toBe(-3000)
    expect(signedAmount({ entry_category: 'addition', amount: 5000 })).toBe(5000)
  })
})

describe('calculateEmployeePayroll', () => {
  const settings = { daysMode: 'calendar_days' }

  it('computes a missed-day deduction from quantity x daily rate (doc section 14)', () => {
    const b = calculateEmployeePayroll({
      employee: { id: 'e1', full_name: 'X', monthly_salary: 100000 },
      entries: [entry({ entry_type: 'missed_day', quantity: 2, amount: null })],
      payrollMonth: '2026-07',
      settings,
    })
    expect(b.missedDays).toBe(2)
    expect(b.missedDayDeduction).toBeCloseTo(6451.6129, 3)
    expect(b.finalAmount).toBeCloseTo(93548.387, 2)
  })

  it('computes extra-day pay from quantity x daily rate (doc section 14)', () => {
    const b = calculateEmployeePayroll({
      employee: { id: 'e1', full_name: 'X', monthly_salary: 75000 },
      entries: [entry({ entry_category: 'addition', entry_type: 'extra_day', quantity: 1, amount: null })],
      payrollMonth: '2026-07',
      settings,
    })
    expect(b.extraDayPay).toBeCloseTo(2419.3548, 3)
    expect(b.finalAmount).toBeCloseTo(77419.3548, 2)
  })

  it('sums fines and subtracts them from base salary (doc section 23 - Patrick)', () => {
    const b = calculateEmployeePayroll({
      employee: { id: 'p', full_name: 'Patrick', monthly_salary: 90000 },
      entries: [
        entry({ entry_type: 'fine', amount: 10000, reason: 'Damaged pizza' }),
        entry({ entry_type: 'fine', amount: 2000, reason: 'Stolen tomato' }),
        entry({ entry_type: 'fine', amount: 3000, reason: 'Wi-Fi' }),
      ],
      payrollMonth: '2026-07',
      settings,
    })
    expect(b.totalFines).toBe(15000)
    expect(b.totalAdditions).toBe(0)
    expect(b.totalDeductions).toBe(15000)
    expect(b.finalAmount).toBe(75000)
    expect(b.lineItems).toHaveLength(3)
  })

  it('buckets additions and other deductions correctly', () => {
    const b = calculateEmployeePayroll({
      employee: { id: 'e1', full_name: 'X', monthly_salary: 120000 },
      entries: [
        entry({ entry_category: 'addition', entry_type: 'bonus', amount: 5000 }),
        entry({ entry_category: 'deduction', entry_type: 'salary_advance', amount: 8000 }),
        entry({ entry_category: 'deduction', entry_type: 'other_deduction', amount: 1000 }),
      ],
      payrollMonth: '2026-07',
      settings,
    })
    expect(b.totalAdditions).toBe(5000)
    expect(b.totalOtherDeductions).toBe(9000)
    expect(b.totalFines).toBe(0)
    expect(b.totalDeductions).toBe(9000)
    expect(b.finalAmount).toBe(120000 + 5000 - 9000)
  })

  it('returns a clean zero breakdown with no entries', () => {
    const b = calculateEmployeePayroll({
      employee: { id: 'e1', full_name: 'X', monthly_salary: 90000 },
      entries: [],
      payrollMonth: '2026-07',
      settings,
    })
    expect(b.finalAmount).toBe(90000)
    expect(b.totalDeductions).toBe(0)
    expect(b.totalAdditions).toBe(0)
    expect(b.lineItems).toEqual([])
  })
})
