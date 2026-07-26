// Place at: src/payroll/calculatePayroll.js
// Pure calculation, no data fetching — takes an employee record, that
// employee's salary events for one pay period, and the payroll settings,
// and returns the breakdown described in the Staff Payment Tracker spec:
//   Monthly Salary − Missed Days − Fines − Advances + Bonuses + Overtime + Extra Days = Final Salary

// Field ids match the Employees/Salary Events forms seeded by the
// Staff Payment Tracker template (supabase/seed_staff_payment_template.sql).
const EMPLOYEE_FIELDS = { name: 'f1', staffId: 'f2', department: 'f3', position: 'f4', monthlySalary: 'f5', status: 'f6' }
const EVENT_FIELDS = { employee: 'f1', date: 'f2', type: 'f3', amount: 'f4', days: 'f5', notes: 'f6' }

export function getDailySalary(monthlySalary, payrollSettings, period) {
  const daysMode = payrollSettings?.daysMode || 'fixed30'
  if (daysMode === 'calendar') {
    const [year, month] = period.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    return monthlySalary / daysInMonth
  }
  const fixedDays = payrollSettings?.fixedDays || 30
  return monthlySalary / fixedDays
}

// One line item per event, signed so callers can just sum `signedAmount`
// for the final total instead of re-implementing the per-type rules.
function eventLineItem(event, dailySalary) {
  const type = event.data[EVENT_FIELDS.type]
  const amount = Number(event.data[EVENT_FIELDS.amount]) || 0
  const days = Number(event.data[EVENT_FIELDS.days]) || 0

  switch (type) {
    case 'Missed Day':
      return { type, category: 'deduction', signedAmount: -(days || 1) * dailySalary }
    case 'Half Day':
      return { type, category: 'deduction', signedAmount: -0.5 * (days || 1) * dailySalary }
    case 'Fine':
      return { type, category: 'deduction', signedAmount: -amount }
    case 'Advance Payment':
      return { type, category: 'deduction', signedAmount: -amount }
    case 'Bonus':
      return { type, category: 'addition', signedAmount: amount }
    case 'Allowance':
      return { type, category: 'addition', signedAmount: amount }
    case 'Overtime':
      return { type, category: 'addition', signedAmount: amount || days * dailySalary }
    case 'Extra Work Day':
      return { type, category: 'addition', signedAmount: (days || 1) * dailySalary }
    default: // "Other Adjustment" — sign comes from whatever amount was entered
      return { type, category: amount >= 0 ? 'addition' : 'deduction', signedAmount: amount }
  }
}

// `employee` and `events` are raw submission rows ({ id, data }). `events`
// should already be filtered to this employee + the target period.
export function calculateEmployeePayroll(employee, events, payrollSettings, period) {
  const monthlySalary = Number(employee.data[EMPLOYEE_FIELDS.monthlySalary]) || 0
  const dailySalary = getDailySalary(monthlySalary, payrollSettings, period)

  const lineItems = events.map(event => eventLineItem(event, dailySalary))
  const deductions = lineItems.filter(i => i.category === 'deduction').reduce((sum, i) => sum - i.signedAmount, 0)
  const additions = lineItems.filter(i => i.category === 'addition').reduce((sum, i) => sum + i.signedAmount, 0)
  const finalSalary = monthlySalary - deductions + additions

  return {
    employeeId: employee.id,
    name: employee.data[EMPLOYEE_FIELDS.name] || 'Unnamed',
    monthlySalary,
    dailySalary,
    lineItems,
    deductions,
    additions,
    finalSalary,
  }
}

export function eventPeriod(event) {
  const date = event.data[EVENT_FIELDS.date]
  return typeof date === 'string' ? date.slice(0, 7) : null
}

export function eventEmployeeId(event) {
  return event.data[EVENT_FIELDS.employee]?.recordId
}

export { EMPLOYEE_FIELDS, EVENT_FIELDS }
