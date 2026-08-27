// Pure parsing + validation for the payroll Excel importers. No Supabase, no
// React - takes the raw rows from readWorkbookRows() and returns a preview
// model the ImportModal renders. Nothing is written until the user confirms.
import { ENTRY_TYPE_LABELS, DEDUCTION_TYPES, ADDITION_TYPES } from '../calculatePayroll'

const EMP_STATUSES = ['active', 'on_leave', 'suspended', 'inactive', 'terminated']
const SALARY_TYPES = ['monthly', 'daily', 'hourly', 'shift']

// Case/space-insensitive header lookup: real spreadsheets have "Staff ID ",
// "staff id", etc.
function pick(row, ...names) {
  const want = names.map(n => n.toLowerCase().replace(/\s+/g, ''))
  for (const key of Object.keys(row)) {
    if (want.includes(key.toLowerCase().replace(/\s+/g, ''))) {
      const v = row[key]
      return v == null ? '' : v
    }
  }
  return ''
}

function str(v) {
  return String(v ?? '').trim()
}

function toISODate(v) {
  if (!v && v !== 0) return null
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  const s = str(v)
  if (!s) return null
  // dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = new Date(s)
  return isNaN(parsed) ? null : parsed.toISOString().slice(0, 10)
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

// -> 'YYYY-MM' or null
export function toPayrollMonth(v, fallbackDate) {
  const s = str(v)
  if (/^\d{4}-\d{2}$/.test(s)) return s
  if (s) {
    const m = s.toLowerCase().match(/([a-z]+)\s+(\d{4})/)
    if (m && MONTHS.includes(m[1])) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}`
    const d = new Date(s)
    if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const iso = toISODate(fallbackDate)
  return iso ? iso.slice(0, 7) : null
}

function coerceAmount(v) {
  const cleaned = str(v).replace(/[^0-9.-]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

function findByName(list, name) {
  const n = str(name).toLowerCase()
  return list.find(x => (x.name || '').toLowerCase() === n) || null
}

// --- Employees ------------------------------------------------------------

export function parseEmployees(rows, { departments = [], locations = [] } = {}) {
  const newDepartments = new Set()
  const newLocations = new Set()

  const parsed = rows.map((row, i) => {
    const problems = []
    const notes = []

    const full_name = str(pick(row, 'Employee Name', 'Name', 'Full Name', 'Employee'))
    const employee_number = str(pick(row, 'Staff ID', 'Staff Number', 'Employee Number', 'ID'))
    const job_title = str(pick(row, 'Job Title', 'Role', 'Title', 'Position'))
    const deptName = str(pick(row, 'Department', 'Dept'))
    const locName = str(pick(row, 'Location', 'Branch', 'Site'))
    const salaryRaw = pick(row, 'Monthly Salary', 'Salary', 'Pay')
    const salaryTypeRaw = str(pick(row, 'Salary Type', 'Pay Type')).toLowerCase().replace(/\s+/g, '_')
    const start_date = toISODate(pick(row, 'Start Date', 'Started', 'Hire Date'))
    const statusRaw = str(pick(row, 'Status', 'Employment Status')).toLowerCase().replace(/\s+/g, '_')
    const phone = str(pick(row, 'Phone', 'Phone Number', 'Mobile'))
    const email = str(pick(row, 'Email', 'Email Address'))

    if (!full_name) problems.push('Employee Name is required')
    if (!job_title) problems.push('Job Title is required')

    const monthly_salary = coerceAmount(salaryRaw)
    if (monthly_salary == null || monthly_salary <= 0) problems.push('Monthly Salary must be a number greater than 0')
    else if (/[^0-9.\s]/.test(str(salaryRaw))) notes.push('Salary had extra characters — read as ' + monthly_salary)

    let needsDept = false
    let department = null
    if (!deptName) problems.push('Department is required')
    else {
      department = findByName(departments, deptName)
      if (!department) { needsDept = true; newDepartments.add(deptName) }
    }

    let needsLoc = false
    let location = null
    if (!locName) problems.push('Location is required')
    else {
      location = findByName(locations, locName)
      if (!location) { needsLoc = true; newLocations.add(locName) }
    }

    const employment_status = EMP_STATUSES.includes(statusRaw) ? statusRaw : 'active'
    if (statusRaw && !EMP_STATUSES.includes(statusRaw)) notes.push(`Status "${statusRaw}" not recognised — set to Active`)
    const salary_type = SALARY_TYPES.includes(salaryTypeRaw) ? salaryTypeRaw : 'monthly'

    return {
      rowNum: i + 2, // header is row 1
      values: {
        full_name, employee_number: employee_number || null, job_title: job_title || null,
        monthly_salary: monthly_salary || 0, salary_type, start_date,
        employment_status, phone: phone || null, email: email || null,
      },
      deptName, locName,
      departmentId: department?.id || null,
      locationId: location?.id || null,
      needsDept, needsLoc,
      problems, notes,
    }
  })

  const readyCount = parsed.filter(p => p.problems.length === 0 && !p.needsDept && !p.needsLoc).length
  return {
    parsed,
    newDepartments: [...newDepartments],
    newLocations: [...newLocations],
    totalRows: parsed.length,
    readyCount,
    issueCount: parsed.length - readyCount,
  }
}

// --- Entries -----------------------------------------------------------

const LABEL_TO_TYPE = Object.fromEntries(
  Object.entries(ENTRY_TYPE_LABELS).map(([k, v]) => [v.toLowerCase(), k])
)
const DAY_TYPES = ['missed_day', 'extra_day']

function resolveEntryType(raw) {
  const s = str(raw).toLowerCase()
  if (LABEL_TO_TYPE[s]) return LABEL_TO_TYPE[s]
  const key = s.replace(/[\s/]+/g, '_')
  if (ENTRY_TYPE_LABELS[key]) return key
  return null
}

export function parseEntries(rows, { employees = [] } = {}) {
  const byStaffId = new Map()
  const byName = new Map()
  employees.forEach(e => {
    if (e.employee_number) byStaffId.set(String(e.employee_number).toLowerCase(), e)
    const n = (e.full_name || '').toLowerCase()
    if (byName.has(n)) byName.set(n, null) // ambiguous
    else byName.set(n, e)
  })

  const parsed = rows.map((row, i) => {
    const problems = []
    const dateRaw = pick(row, 'Date', 'Entry Date')
    const nameRaw = str(pick(row, 'Employee Name', 'Name', 'Employee'))
    const staffIdRaw = str(pick(row, 'Staff ID', 'Employee Number', 'ID'))
    const typeRaw = pick(row, 'Entry Type', 'Type')
    const reason = str(pick(row, 'Reason', 'Note', 'Description'))
    const qtyRaw = pick(row, 'Quantity', 'Days', 'Qty')
    const amountRaw = pick(row, 'Amount', 'Value')
    const monthRaw = pick(row, 'Payroll Month', 'Month')

    // Employee resolution: Staff ID first, then name.
    let employee = null
    if (staffIdRaw) {
      employee = byStaffId.get(staffIdRaw.toLowerCase()) || null
      if (!employee) problems.push(`No employee with Staff ID "${staffIdRaw}"`)
      else if (nameRaw && (employee.full_name || '').toLowerCase() !== nameRaw.toLowerCase()) {
        problems.push(`Staff ID "${staffIdRaw}" is ${employee.full_name}, not "${nameRaw}"`)
      }
    } else if (nameRaw) {
      const hit = byName.get(nameRaw.toLowerCase())
      if (hit === null) problems.push(`More than one employee named "${nameRaw}" — add a Staff ID`)
      else if (!hit) problems.push(`Employee "${nameRaw}" not found`)
      else employee = hit
    } else {
      problems.push('Employee Name or Staff ID is required')
    }

    const entry_type = resolveEntryType(typeRaw)
    if (!entry_type) problems.push(`Entry Type "${str(typeRaw)}" is not recognised`)

    const isDayType = entry_type && DAY_TYPES.includes(entry_type)
    const quantity = coerceAmount(qtyRaw)
    const amount = coerceAmount(amountRaw)
    if (entry_type) {
      if (isDayType && (quantity == null || quantity <= 0)) problems.push(`${ENTRY_TYPE_LABELS[entry_type]} needs a Quantity (number of days)`)
      if (!isDayType && (amount == null || amount <= 0)) problems.push(`${ENTRY_TYPE_LABELS[entry_type]} needs an Amount`)
    }

    const entry_date = toISODate(dateRaw) || new Date().toISOString().slice(0, 10)
    const payroll_month = toPayrollMonth(monthRaw, dateRaw) || entry_date.slice(0, 7)
    const entry_category = entry_type
      ? (DEDUCTION_TYPES.includes(entry_type) ? 'deduction' : ADDITION_TYPES.includes(entry_type) ? 'addition' : null)
      : null

    return {
      rowNum: i + 2,
      employee_id: employee?.id || null,
      employeeName: employee?.full_name || nameRaw,
      values: {
        employee_id: employee?.id || null,
        entry_date,
        entry_category,
        entry_type,
        quantity: isDayType ? quantity : null,
        amount: isDayType ? 0 : (amount || 0),
        reason: reason || null,
        payroll_month,
      },
      typeLabel: entry_type ? ENTRY_TYPE_LABELS[entry_type] : str(typeRaw),
      problems,
    }
  })

  const readyCount = parsed.filter(p => p.problems.length === 0).length
  return { parsed, totalRows: parsed.length, readyCount, issueCount: parsed.length - readyCount }
}
