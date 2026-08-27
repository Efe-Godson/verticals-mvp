// Pure payroll math - no data fetching. Takes a typed payroll_employees row,
// that employee's payroll_entries rows for one month, and the form's payroll
// settings, and returns the breakdown described in the Staff Payments design
// doc section 37:
//
//   daily_salary          = monthly_salary / days_in_period
//   missed_day_deduction  = daily_salary * missed_days
//   extra_day_pay         = daily_salary * extra_days
//   total_deductions      = missed_day_deduction + fines + advances + other deductions
//   total_additions       = extra_day_pay + bonuses + allowances + ... + other additions
//   final_amount          = monthly_salary + total_additions - total_deductions
//
// The daily rate is kept at full precision and never pre-rounded (doc section
// 38) - rounding only happens at display time.

export const DEDUCTION_TYPES = ['fine', 'missed_day', 'salary_advance', 'loan_repayment', 'damage', 'other_deduction']
export const ADDITION_TYPES = ['extra_day', 'bonus', 'allowance', 'reimbursement', 'commission', 'other_addition']

export const ENTRY_TYPE_LABELS = {
  fine: 'Fine',
  missed_day: 'Missed Day',
  extra_day: 'Extra Day',
  bonus: 'Bonus',
  salary_advance: 'Salary Advance',
  loan_repayment: 'Loan Repayment',
  allowance: 'Allowance',
  reimbursement: 'Reimbursement',
  commission: 'Commission',
  damage: 'Damage / Loss',
  other_deduction: 'Other Deduction',
  other_addition: 'Other Addition',
}

// 'YYYY-MM' -> number of days used to divide the monthly salary.
export function daysInPeriod(payrollMonth, method = 'calendar_days', workingDays = 30) {
  if (method === 'fixed_working_days') return Number(workingDays) || 30
  const [year, month] = String(payrollMonth).split('-').map(Number)
  if (!year || !month) return 30
  return new Date(year, month, 0).getDate() // day 0 of next month = last day of this one
}

export function getDailyRate(monthlySalary, payrollMonth, settings) {
  const days = daysInPeriod(payrollMonth, settings?.daysMode, settings?.workingDays)
  return (Number(monthlySalary) || 0) / days
}

// Sign an entry the way it is displayed and summed everywhere: the stored
// entry_category is the single source of truth, `amount` is always positive.
export function signedAmount(entry) {
  const amount = Number(entry.amount) || 0
  return entry.entry_category === 'deduction' ? -amount : amount
}

// For missed_day / extra_day the amount is normally computed and frozen at
// entry time; fall back to quantity * dailyRate when it is missing.
function entryAmount(entry, dailyRate) {
  if (entry.amount != null && entry.amount !== '') return Number(entry.amount) || 0
  if (entry.entry_type === 'missed_day' || entry.entry_type === 'extra_day') {
    return (Number(entry.quantity) || 0) * dailyRate
  }
  return 0
}

// `employee` is a payroll_employees row. `entries` should already be filtered
// to this employee + the target month and exclude soft-deleted / rejected.
export function calculateEmployeePayroll({ employee, entries = [], payrollMonth, settings }) {
  const baseSalary = Number(employee.monthly_salary) || 0
  const periodDays = daysInPeriod(payrollMonth, settings?.daysMode, settings?.workingDays)
  const dailyRate = baseSalary / periodDays

  const lineItems = entries.map(entry => {
    const amount = entryAmount(entry, dailyRate)
    return {
      id: entry.id,
      type: entry.entry_type,
      label: ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type,
      category: entry.entry_category,
      quantity: entry.quantity != null ? Number(entry.quantity) : null,
      reason: entry.reason || '',
      amount,
      signedAmount: entry.entry_category === 'deduction' ? -amount : amount,
    }
  })

  const sumType = type => lineItems.filter(i => i.type === type).reduce((s, i) => s + i.amount, 0)
  const sumQty = type => lineItems.filter(i => i.type === type).reduce((s, i) => s + (i.quantity || 0), 0)

  const missedDays = sumQty('missed_day')
  const missedDayDeduction = sumType('missed_day')
  const extraDays = sumQty('extra_day')
  const extraDayPay = sumType('extra_day')
  const totalFines = sumType('fine')

  const totalOtherDeductions = lineItems
    .filter(i => i.category === 'deduction' && i.type !== 'missed_day' && i.type !== 'fine')
    .reduce((s, i) => s + i.amount, 0)

  const totalDeductions = lineItems
    .filter(i => i.category === 'deduction')
    .reduce((s, i) => s + i.amount, 0)

  const totalAdditions = lineItems
    .filter(i => i.category === 'addition')
    .reduce((s, i) => s + i.amount, 0)

  const grossAdjustedPay = baseSalary + totalAdditions
  const finalAmount = grossAdjustedPay - totalDeductions

  return {
    employeeId: employee.id,
    name: employee.full_name || 'Unnamed',
    baseSalary,
    daysInPeriod: periodDays,
    dailyRate,
    missedDays,
    missedDayDeduction,
    extraDays,
    extraDayPay,
    totalFines,
    totalOtherDeductions,
    totalAdditions,
    grossAdjustedPay,
    totalDeductions,
    finalAmount,
    lineItems,
  }
}

// Shape a breakdown for an upsert into payroll_records.
export function breakdownToRecordRow(breakdown, { payrollFormId, payrollMonth, payrollPeriodId = null }) {
  return {
    payroll_form_id: payrollFormId,
    employee_id: breakdown.employeeId,
    payroll_period_id: payrollPeriodId,
    payroll_month: payrollMonth,
    base_salary: breakdown.baseSalary,
    days_in_period: breakdown.daysInPeriod,
    daily_rate: breakdown.dailyRate,
    missed_days: breakdown.missedDays,
    missed_day_deduction: breakdown.missedDayDeduction,
    extra_days: breakdown.extraDays,
    extra_day_pay: breakdown.extraDayPay,
    total_fines: breakdown.totalFines,
    total_other_deductions: breakdown.totalOtherDeductions,
    total_additions: breakdown.totalAdditions,
    gross_adjusted_pay: breakdown.grossAdjustedPay,
    total_deductions: breakdown.totalDeductions,
    final_amount: breakdown.finalAmount,
  }
}
