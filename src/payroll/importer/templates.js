// Downloadable Excel templates for the payroll importers. Each workbook has a
// data sheet (the table users fill in) and an Instructions sheet listing the
// allowed values - the bundled xlsx build can't write real Excel data-
// validation dropdowns, so the rules live on that sheet and are enforced in
// the import preview instead.
import * as XLSX from 'xlsx'
import { ENTRY_TYPE_LABELS, DEDUCTION_TYPES, ADDITION_TYPES } from '../calculatePayroll'

function save(workbook, filename) {
  XLSX.writeFile(workbook, filename)
}

function instructionSheet(lines) {
  return XLSX.utils.aoa_to_sheet(lines.map(l => [l]))
}

export function downloadEmployeeTemplate(departments = [], locations = []) {
  const headers = ['Employee Name', 'Staff ID', 'Job Title', 'Department', 'Location', 'Monthly Salary', 'Salary Type', 'Start Date', 'Status', 'Phone', 'Email']
  const example = ['Patrick', 'RCH-001', 'Baker', departments[0]?.name || 'Pastry', locations[0]?.name || 'GRA', 90000, 'Monthly', '2026-07-01', 'Active', '08030000000', 'patrick@example.com']

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, example])
  dataSheet['!cols'] = headers.map(() => ({ wch: 20 }))

  const instructions = instructionSheet([
    'VERTICALS — EMPLOYEE IMPORT',
    '',
    'Required columns (every row):',
    '  • Employee Name',
    '  • Job Title',
    '  • Department',
    '  • Location',
    '  • Monthly Salary',
    '',
    'Monthly Salary: numbers only. Enter 90000 — not ₦90,000.',
    'Verticals adds the currency formatting after import.',
    '',
    'Status (one of):  Active | On Leave | Suspended | Inactive | Terminated',
    'Salary Type (one of):  Monthly | Daily | Hourly | Shift',
    'Start Date format:  YYYY-MM-DD  (e.g. 2026-07-01)',
    '',
    'Departments that already exist:',
    ...(departments.length ? departments.map(d => '  • ' + d.name) : ['  (none yet — new names will be offered for creation on import)']),
    '',
    'Locations that already exist:',
    ...(locations.length ? locations.map(l => '  • ' + l.name) : ['  (none yet — new names will be offered for creation on import)']),
    '',
    'Do not rename the column headers on the Employees sheet.',
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Employees')
  XLSX.utils.book_append_sheet(wb, instructions, 'Instructions')
  save(wb, 'payroll-employees-template.xlsx')
}

export function downloadEntryTemplate(employees = []) {
  const headers = ['Date', 'Employee Name', 'Staff ID', 'Entry Type', 'Reason', 'Quantity', 'Amount', 'Payroll Month']
  const e0 = employees[0]
  const e1 = employees[1] || e0
  const rows = [
    ['2026-08-01', e0?.full_name || 'Patrick', e0?.employee_number || 'RCH-001', 'Fine', 'Connected to Wi-Fi', '', 3000, 'August 2026'],
    ['2026-08-01', e1?.full_name || 'Godsave', e1?.employee_number || 'RCH-003', 'Missed Day', 'Missed work', 2, '', 'August 2026'],
    ['2026-08-01', e0?.full_name || 'Gift', e0?.employee_number || 'RCH-023', 'Extra Day', 'Extra shift', 1, '', 'August 2026'],
    ['2026-08-01', e1?.full_name || 'Amara', e1?.employee_number || 'RCH-014', 'Bonus', 'Excellent performance', '', 5000, 'August 2026'],
  ]

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  dataSheet['!cols'] = headers.map(() => ({ wch: 18 }))

  const amountTypes = [...DEDUCTION_TYPES, ...ADDITION_TYPES].filter(t => t !== 'missed_day' && t !== 'extra_day')
  const instructions = instructionSheet([
    'VERTICALS — PAYROLL ENTRY IMPORT',
    '',
    'Match employees by Staff ID first, then by Employee Name.',
    'If a row has both and they disagree, that row is flagged in the preview.',
    '',
    'Entry Type (one of):',
    ...Object.values(ENTRY_TYPE_LABELS).map(l => '  • ' + l),
    '',
    'Amount vs Quantity:',
    '  • Missed Day  → enter Quantity (number of days). Amount is auto-calculated.',
    '  • Extra Day   → enter Quantity (number of days). Amount is auto-calculated.',
    ...amountTypes.map(t => `  • ${ENTRY_TYPE_LABELS[t]}  → enter Amount.`),
    '',
    'Date format:  YYYY-MM-DD',
    'Payroll Month:  "August 2026"  or  "2026-08".  Defaults from Date if blank.',
    '',
    'Do not rename the column headers on the Entries sheet.',
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Entries')
  XLSX.utils.book_append_sheet(wb, instructions, 'Instructions')
  save(wb, 'payroll-entries-template.xlsx')
}
