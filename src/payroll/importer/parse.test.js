import { describe, it, expect } from 'vitest'
import { parseEmployees, parseEntries, toPayrollMonth } from './parse'

const departments = [{ id: 'd1', name: 'Pastry' }, { id: 'd2', name: 'Main Kitchen' }]
const locations = [{ id: 'l1', name: 'GRA' }, { id: 'l2', name: 'Airport Road' }]

describe('parseEmployees', () => {
  it('accepts a clean row and resolves department + location ids', () => {
    const { parsed, readyCount } = parseEmployees([
      { 'Employee Name': 'Patrick', 'Job Title': 'Baker', Department: 'pastry', Location: 'GRA', 'Monthly Salary': 90000 },
    ], { departments, locations })
    expect(readyCount).toBe(1)
    expect(parsed[0].departmentId).toBe('d1')
    expect(parsed[0].locationId).toBe('l1')
    expect(parsed[0].problems).toEqual([])
  })

  it('flags a missing location', () => {
    const { parsed, issueCount } = parseEmployees([
      { 'Employee Name': 'John', 'Job Title': 'Cook', Department: 'Main Kitchen', 'Monthly Salary': 70000 },
    ], { departments, locations })
    expect(issueCount).toBe(1)
    expect(parsed[0].problems.join()).toMatch(/Location is required/)
  })

  it('collects unknown departments for creation', () => {
    const res = parseEmployees([
      { 'Employee Name': 'Ada', 'Job Title': 'Chef', Department: 'Outdoor Catering', Location: 'GRA', 'Monthly Salary': 100000 },
    ], { departments, locations })
    expect(res.newDepartments).toContain('Outdoor Catering')
    expect(res.parsed[0].needsDept).toBe(true)
  })

  it('strips currency characters from salary but notes it', () => {
    const { parsed } = parseEmployees([
      { 'Employee Name': 'Sam', 'Job Title': 'Baker', Department: 'Pastry', Location: 'GRA', 'Monthly Salary': '₦90,000' },
    ], { departments, locations })
    expect(parsed[0].values.monthly_salary).toBe(90000)
    expect(parsed[0].notes.join()).toMatch(/extra characters/)
  })

  it('rejects a zero / non-numeric salary', () => {
    const { parsed } = parseEmployees([
      { 'Employee Name': 'Zed', 'Job Title': 'Baker', Department: 'Pastry', Location: 'GRA', 'Monthly Salary': 'tbd' },
    ], { departments, locations })
    expect(parsed[0].problems.join()).toMatch(/greater than 0/)
  })
})

describe('parseEntries', () => {
  const employees = [
    { id: 'e1', full_name: 'Patrick', employee_number: 'RCH-001' },
    { id: 'e3', full_name: 'Godsave', employee_number: 'RCH-003' },
  ]

  it('matches on Staff ID first', () => {
    const { parsed, readyCount } = parseEntries([
      { Date: '2026-08-01', 'Staff ID': 'RCH-003', 'Entry Type': 'Fine', Amount: 3000, 'Payroll Month': 'August 2026' },
    ], { employees })
    expect(readyCount).toBe(1)
    expect(parsed[0].employee_id).toBe('e3')
    expect(parsed[0].values.entry_category).toBe('deduction')
  })

  it('flags a Staff ID / name mismatch', () => {
    const { parsed } = parseEntries([
      { Date: '2026-08-01', 'Employee Name': 'Patrick', 'Staff ID': 'RCH-003', 'Entry Type': 'Fine', Amount: 3000 },
    ], { employees })
    expect(parsed[0].problems.join()).toMatch(/is Godsave, not "Patrick"/)
  })

  it('requires Quantity for Missed Day and auto-zeroes the amount', () => {
    const { parsed } = parseEntries([
      { Date: '2026-08-01', 'Staff ID': 'RCH-001', 'Entry Type': 'Missed Day', 'Payroll Month': '2026-08' },
      { Date: '2026-08-01', 'Staff ID': 'RCH-001', 'Entry Type': 'Missed Day', Quantity: 2 },
    ], { employees })
    expect(parsed[0].problems.join()).toMatch(/needs a Quantity/)
    expect(parsed[1].problems).toEqual([])
    expect(parsed[1].values.quantity).toBe(2)
    expect(parsed[1].values.amount).toBe(0)
  })

  it('reports an unknown employee', () => {
    const { parsed } = parseEntries([
      { Date: '2026-08-01', 'Employee Name': 'Nobody', 'Entry Type': 'Bonus', Amount: 1000 },
    ], { employees })
    expect(parsed[0].problems.join()).toMatch(/not found/)
  })
})

describe('toPayrollMonth', () => {
  it('handles month-name and ISO forms', () => {
    expect(toPayrollMonth('August 2026')).toBe('2026-08')
    expect(toPayrollMonth('2026-08')).toBe('2026-08')
    expect(toPayrollMonth('', '2026-08-14')).toBe('2026-08')
  })
})
