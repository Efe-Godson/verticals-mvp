// Thin Supabase data layer for the Payroll module. Pages call these instead
// of hand-rolling queries so table names, soft-delete filters, the settings
// merge pattern and audit logging all live in one place.
import { supabase } from '../supabaseClient'
import { calculateEmployeePayroll, breakdownToRecordRow, getDailyRate } from './calculatePayroll'

async function currentUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

// --- form + settings -------------------------------------------------------

export async function loadPayrollForm(id) {
  const { data, error } = await supabase.from('forms').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Payroll workspace not found.')
  if (data.settings?.payrollRole !== 'employees') {
    throw new Error('This form is not set up as a Payroll workspace.')
  }
  return data
}

export function payrollSettings(form) {
  return {
    daysMode: 'calendar_days',
    workingDays: 30,
    currency: 'NGN',
    approvalRequired: false,
    enabledEntryTypes: null, // null = all enabled
    showEntryDates: true, // show the date on each entry line in the breakdown
    ...(form?.settings?.payroll || {}),
  }
}

// Read-modify-write the shared settings bag - other pages stash their own keys
// in form.settings, so never replace it outright (see FormSettings.jsx).
export async function savePayrollSettings(form, patch) {
  const nextSettings = {
    ...form.settings,
    payroll: { ...(form.settings?.payroll || {}), ...patch },
  }
  const { data, error } = await supabase
    .from('forms').update({ settings: nextSettings }).eq('id', form.id).select().single()
  if (error) throw error
  return data
}

// --- audit ---------------------------------------------------------------

export async function logAudit(payrollFormId, entityType, entityId, action, oldValue, newValue) {
  try {
    await supabase.from('payroll_audit_logs').insert([{
      payroll_form_id: payrollFormId,
      user_id: await currentUserId(),
      entity_type: entityType,
      entity_id: entityId,
      action,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    }])
  } catch {
    // Audit is best-effort; never block the user action on it.
  }
}

export async function listAuditLogs(payrollFormId, { entityId } = {}) {
  let q = supabase.from('payroll_audit_logs').select('*')
    .eq('payroll_form_id', payrollFormId).order('created_at', { ascending: false }).limit(200)
  if (entityId) q = q.eq('entity_id', entityId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// --- departments -------------------------------------------------------

export async function listDepartments(payrollFormId) {
  const { data, error } = await supabase.from('payroll_departments').select('*')
    .eq('payroll_form_id', payrollFormId).eq('status', 'active').order('name')
  if (error) throw error
  return data || []
}

export async function createDepartment(payrollFormId, name, description = '') {
  const { data, error } = await supabase.from('payroll_departments')
    .insert([{ payroll_form_id: payrollFormId, name: name.trim(), description }]).select().single()
  if (error) throw error
  return data
}

export async function updateDepartment(id, values) {
  const { data, error } = await supabase.from('payroll_departments')
    .update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function archiveDepartment(id) {
  const { error } = await supabase.from('payroll_departments').update({ status: 'archived' }).eq('id', id)
  if (error) throw error
}

// --- locations -------------------------------------------------------

export async function listLocations(payrollFormId) {
  const { data, error } = await supabase.from('payroll_locations').select('*')
    .eq('payroll_form_id', payrollFormId).eq('status', 'active').order('name')
  if (error) throw error
  return data || []
}

export async function createLocation(payrollFormId, values) {
  const payload = typeof values === 'string' ? { name: values.trim() } : { ...values, name: (values.name || '').trim() }
  const { data, error } = await supabase.from('payroll_locations')
    .insert([{ payroll_form_id: payrollFormId, ...payload }]).select().single()
  if (error) throw error
  await logAudit(payrollFormId, 'location', data.id, 'created', null, data)
  return data
}

export async function updateLocation(id, values) {
  const { data, error } = await supabase.from('payroll_locations')
    .update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function archiveLocation(id) {
  const { error } = await supabase.from('payroll_locations').update({ status: 'archived' }).eq('id', id)
  if (error) throw error
}

// --- employees --------------------------------------------------------

export async function listEmployees(payrollFormId, { includeDeleted = false } = {}) {
  let q = supabase.from('payroll_employees').select('*')
    .eq('payroll_form_id', payrollFormId).order('full_name')
  if (!includeDeleted) q = q.is('deleted_at', null)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getEmployee(id) {
  const { data, error } = await supabase.from('payroll_employees').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

const COMP_METHOD = { calendar_days: 'calendar_days', fixed_working_days: 'fixed_working_days' }
const SALARY_TYPES = ['monthly', 'daily', 'hourly', 'shift']

// Real columns on payroll_employees. Callers (esp. the importer) pass bags
// that also carry compensation-only fields like salary_type - drop anything
// that isn't a column so the insert doesn't fail against the schema cache.
const EMPLOYEE_COLUMNS = [
  'employee_number', 'full_name', 'phone', 'email', 'job_title', 'department_id',
  'primary_location_id', 'employment_status', 'start_date', 'end_date',
  'monthly_salary', 'bank_name', 'account_number', 'account_name', 'payment_provider',
]
function employeeColumns(values) {
  return Object.fromEntries(Object.entries(values).filter(([k]) => EMPLOYEE_COLUMNS.includes(k)))
}

async function writeCompensationRow(payrollFormId, employee, settings, salaryType) {
  await supabase.from('payroll_employee_compensation').insert([{
    payroll_form_id: payrollFormId,
    employee_id: employee.id,
    salary_type: SALARY_TYPES.includes(salaryType) ? salaryType : 'monthly',
    base_salary: Number(employee.monthly_salary) || 0,
    currency: settings?.currency || 'NGN',
    daily_rate_method: COMP_METHOD[settings?.daysMode] || 'calendar_days',
    working_days: settings?.daysMode === 'fixed_working_days' ? (settings?.workingDays || 30) : null,
  }])
}

export async function createEmployee(payrollFormId, values, settings) {
  const { data, error } = await supabase.from('payroll_employees')
    .insert([{ ...employeeColumns(values), payroll_form_id: payrollFormId }]).select().single()
  if (error) throw error
  await writeCompensationRow(payrollFormId, data, settings, values.salary_type)
  await logAudit(payrollFormId, 'employee', data.id, 'created', null, data)
  return data
}

export async function updateEmployee(payrollFormId, id, values, settings) {
  const before = await getEmployee(id)
  const { data, error } = await supabase.from('payroll_employees')
    .update(employeeColumns(values)).eq('id', id).select().single()
  if (error) throw error
  if (Number(before.monthly_salary) !== Number(data.monthly_salary)) {
    await supabase.from('payroll_employee_compensation')
      .update({ effective_to: new Date().toISOString().slice(0, 10) })
      .eq('employee_id', id).is('effective_to', null)
    await writeCompensationRow(payrollFormId, data, settings, values.salary_type)
  }
  await logAudit(payrollFormId, 'employee', id, 'updated', before, data)
  return data
}

export async function deleteEmployee(payrollFormId, id) {
  const { error } = await supabase.from('payroll_employees')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  await logAudit(payrollFormId, 'employee', id, 'deleted', null, null)
}

// Bulk insert for spreadsheet import: rows are the bags from importer/parse.js
// (which also carry salary_type - split off to the compensation row).
export async function importEmployees(payrollFormId, rows, settings) {
  const payload = rows.map(r => ({ ...employeeColumns(r), payroll_form_id: payrollFormId }))
  const { data, error } = await supabase.from('payroll_employees').insert(payload).select()
  if (error) throw error
  const created = data || []
  for (let i = 0; i < created.length; i++) {
    await writeCompensationRow(payrollFormId, created[i], settings, rows[i]?.salary_type)
  }
  await logAudit(payrollFormId, 'employee', null, 'imported', null, { count: created.length })
  return created
}

// --- entries ---------------------------------------------------------

export function monthOf(dateStr) {
  return String(dateStr || '').slice(0, 7)
}

// Freeze the amount for day-based entries at creation time (doc section 14).
function resolveEntryAmount(row, employee, settings) {
  if (row.entry_type === 'missed_day' || row.entry_type === 'extra_day') {
    const month = row.payroll_month || monthOf(row.entry_date)
    const rate = getDailyRate(employee?.monthly_salary, month, settings)
    const qty = Number(row.quantity) || 0
    return { amount: qty * rate, unit_amount: rate }
  }
  return { amount: Math.abs(Number(row.amount) || 0), unit_amount: null }
}

export async function listEntries(payrollFormId, filters = {}) {
  let q = supabase.from('payroll_entries').select('*, employee:payroll_employees(id, full_name, department_id, job_title)')
    .eq('payroll_form_id', payrollFormId).is('deleted_at', null)
    .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
  if (filters.month) q = q.eq('payroll_month', filters.month)
  if (filters.employeeId) q = q.eq('employee_id', filters.employeeId)
  if (filters.entryType) q = q.eq('entry_type', filters.entryType)
  if (filters.category) q = q.eq('entry_category', filters.category)
  if (filters.dateFrom) q = q.gte('entry_date', filters.dateFrom)
  if (filters.dateTo) q = q.lte('entry_date', filters.dateTo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// `rows` each: { employee_id, entry_date, entry_category, entry_type, quantity, amount, reason, notes, payroll_month }
export async function createEntries(payrollFormId, rows, employeesById, settings) {
  const createdBy = await currentUserId()
  const payload = rows.map(row => {
    const emp = employeesById[row.employee_id]
    const { amount, unit_amount } = resolveEntryAmount(row, emp, settings)
    const payrollMonth = row.payroll_month || monthOf(row.entry_date)
    return {
      payroll_form_id: payrollFormId,
      employee_id: row.employee_id,
      entry_date: row.entry_date,
      entry_category: row.entry_category,
      entry_type: row.entry_type,
      quantity: row.quantity != null && row.quantity !== '' ? Number(row.quantity) : null,
      unit_amount,
      amount,
      reason: row.reason || null,
      notes: row.notes || null,
      payroll_month: payrollMonth,
      created_by: createdBy,
    }
  })
  const { data, error } = await supabase.from('payroll_entries').insert(payload).select()
  if (error) throw error
  await logAudit(payrollFormId, 'entry', null, 'created', null, { count: data?.length || 0 })
  return data || []
}

// Spreadsheet import: rows already have employee_id / entry_category /
// entry_type resolved by importer/parse.js; createEntries still freezes the
// day-type amounts. Kept separate only so the audit trail says "imported".
export async function importEntries(payrollFormId, rows, employeesById, settings) {
  const created = await createEntries(payrollFormId, rows, employeesById, settings)
  await logAudit(payrollFormId, 'entry', null, 'imported', null, { count: created.length })
  return created
}

export async function updateEntry(payrollFormId, id, values, employee, settings) {
  const { amount, unit_amount } = resolveEntryAmount(values, employee, settings)
  const { data, error } = await supabase.from('payroll_entries')
    .update({
      ...values,
      amount,
      unit_amount,
      quantity: values.quantity != null && values.quantity !== '' ? Number(values.quantity) : null,
    })
    .eq('id', id).select().single()
  if (error) throw error
  await logAudit(payrollFormId, 'entry', id, 'updated', null, data)
  return data
}

export async function deleteEntry(payrollFormId, id) {
  const { error } = await supabase.from('payroll_entries')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  await logAudit(payrollFormId, 'entry', id, 'deleted', null, null)
}

// --- periods ---------------------------------------------------------

export async function getOrCreatePeriod(payrollFormId, month /* 'YYYY-MM' */) {
  const [year, m] = month.split('-').map(Number)
  const { data: existing } = await supabase.from('payroll_periods').select('*')
    .eq('payroll_form_id', payrollFormId).eq('year', year).eq('month', m).maybeSingle()
  if (existing) return existing
  const start = `${month}-01`
  const end = new Date(year, m, 0).toISOString().slice(0, 10)
  const { data, error } = await supabase.from('payroll_periods')
    .insert([{ payroll_form_id: payrollFormId, year, month: m, start_date: start, end_date: end, status: 'open' }])
    .select().single()
  if (error) throw error
  return data
}

export async function setPeriodStatus(id, status) {
  const patch = { status }
  if (status === 'locked') patch.locked_at = new Date().toISOString()
  const { error } = await supabase.from('payroll_periods').update(patch).eq('id', id)
  if (error) throw error
}

// --- records (Run Payroll) -----------------------------------------

export async function loadRecordsForMonth(payrollFormId, month) {
  const { data, error } = await supabase.from('payroll_records').select('*')
    .eq('payroll_form_id', payrollFormId).eq('payroll_month', month)
  if (error) throw error
  return data || []
}

// Compute every active employee's breakdown for `month` and upsert into
// payroll_records. Rows already paid / cancelled are left untouched (doc
// section 36 - paid payroll is locked).
export async function runPayroll(payrollFormId, month, form) {
  const settings = payrollSettings(form)
  const period = await getOrCreatePeriod(payrollFormId, month)
  const [employees, entries, existing] = await Promise.all([
    listEmployees(payrollFormId),
    listEntries(payrollFormId, { month }),
    loadRecordsForMonth(payrollFormId, month),
  ])
  // Paid / cancelled records are locked (doc section 36); everything else is
  // regenerated as a fresh Pending record. (The status column's stored token
  // stays 'draft' - the DB check constraint predates the Pending/Paid model -
  // but it renders as "Pending" everywhere, see ui.jsx's RecordStatusBadge.)
  const locked = new Set(
    existing.filter(r => r.status === 'paid' || r.status === 'cancelled').map(r => r.employee_id)
  )

  const rows = employees
    .filter(e => e.employment_status !== 'terminated' && !locked.has(e.id))
    .map(employee => {
      const empEntries = entries.filter(en => en.employee_id === employee.id && en.status !== 'rejected')
      const breakdown = calculateEmployeePayroll({ employee, entries: empEntries, payrollMonth: month, settings })
      const row = breakdownToRecordRow(breakdown, {
        payrollFormId, payrollMonth: month, payrollPeriodId: period.id,
      })
      row.status = 'draft' // = "Pending"
      return row
    })

  if (rows.length) {
    const { error } = await supabase.from('payroll_records')
      .upsert(rows, { onConflict: 'payroll_form_id,employee_id,payroll_month' })
    if (error) throw error
  }
  await logAudit(payrollFormId, 'payroll_run', null, 'run', null, { month, employees: rows.length })
  return loadRecordsForMonth(payrollFormId, month)
}

// Recompute a single employee's record for a month from its current entries
// and upsert it - used by the payroll modal after an in-place entry change so
// the row updates without re-running the whole month (doc section 25).
export async function recalcEmployeeRecord(payrollFormId, employee, month, form) {
  const settings = payrollSettings(form)
  const period = await getOrCreatePeriod(payrollFormId, month)
  const entries = await listEntries(payrollFormId, { month, employeeId: employee.id })
  const breakdown = calculateEmployeePayroll({
    employee, entries: entries.filter(e => e.status !== 'rejected'), payrollMonth: month, settings,
  })
  const row = breakdownToRecordRow(breakdown, { payrollFormId, payrollMonth: month, payrollPeriodId: period.id })
  const { data, error } = await supabase.from('payroll_records')
    .upsert(row, { onConflict: 'payroll_form_id,employee_id,payroll_month' }).select().single()
  if (error) throw error
  return { record: data, breakdown, entries }
}

export async function setRecordStatus(payrollFormId, record, status, meta = {}) {
  const patch = { status }
  const now = new Date().toISOString()
  if (status === 'approved') {
    patch.approved_by = await currentUserId()
    patch.approved_at = now
    patch.approved_amount = record.final_amount
    patch.hold_reason = null
  }
  if (status === 'on_hold') patch.hold_reason = meta.holdReason || null
  if (status === 'paid') {
    patch.paid_at = now
    patch.payment_method = meta.paymentMethod || null
    patch.payment_reference = meta.paymentReference || null
  }
  // Back to Pending ('draft' token): wipe the payment/approval trail so the
  // record reads as genuinely unpaid again.
  if (status === 'draft' || status === 'pending') {
    patch.status = 'draft'
    patch.paid_at = null
    patch.payment_method = null
    patch.payment_reference = null
    patch.approved_by = null
    patch.approved_at = null
    patch.approved_amount = null
    patch.hold_reason = null
  }
  const { data, error } = await supabase.from('payroll_records')
    .update(patch).eq('id', record.id).select().single()
  if (error) throw error

  if (status === 'paid') {
    await supabase.from('payroll_disbursements').insert([{
      payroll_form_id: payrollFormId,
      employee_id: record.employee_id,
      payroll_record_id: record.id,
      amount: record.final_amount,
      payment_method: meta.paymentMethod || null,
      provider_reference: meta.paymentReference || null,
      status: 'successful',
      initiated_at: now,
      completed_at: now,
    }])
  }
  await logAudit(payrollFormId, 'payroll_record', record.id, `status:${status}`, record, data)
  return data
}

export async function bulkSetRecordStatus(payrollFormId, records, status, meta = {}) {
  const results = []
  for (const r of records) results.push(await setRecordStatus(payrollFormId, r, status, meta))
  return results
}

// --- batches + disbursements -------------------------------------

export async function createPaymentBatch(payrollFormId, month, records) {
  const total = records.reduce((s, r) => s + Number(r.final_amount || 0), 0)
  const { data, error } = await supabase.from('payroll_payment_batches').insert([{
    payroll_form_id: payrollFormId,
    payroll_month: month,
    employee_count: records.length,
    total_amount: total,
    status: 'ready',
    approved_by: await currentUserId(),
    approved_at: new Date().toISOString(),
  }]).select().single()
  if (error) throw error
  await logAudit(payrollFormId, 'payment_batch', data.id, 'created', null, data)
  return data
}

// Clears the generated payroll for one month: the payroll_records and any
// payment batches. Staff, salaries and payroll_entries are untouched - the
// month can be re-generated from them with runPayroll().
export async function resetPayrollMonth(payrollFormId, month) {
  const { error: e1 } = await supabase.from('payroll_records').delete()
    .eq('payroll_form_id', payrollFormId).eq('payroll_month', month)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('payroll_payment_batches').delete()
    .eq('payroll_form_id', payrollFormId).eq('payroll_month', month)
  if (e2) throw e2
  await logAudit(payrollFormId, 'payroll_run', null, 'reset', null, { month })
}

export async function listBatches(payrollFormId, month) {
  let q = supabase.from('payroll_payment_batches').select('*')
    .eq('payroll_form_id', payrollFormId).order('created_at', { ascending: false })
  if (month) q = q.eq('payroll_month', month)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function listDisbursements(payrollFormId) {
  const { data, error } = await supabase.from('payroll_disbursements')
    .select('*, employee:payroll_employees(full_name)')
    .eq('payroll_form_id', payrollFormId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
