// Add / edit an employee (doc sections 5-8). Personal + employment + salary,
// with an inline "create department" shortcut and a collapsed bank-details
// block (optional, for future API payouts).
import { useState } from 'react'
import { useToast } from '../Toast'
import { PayrollModal, Field, TextInput, Select } from './ui'
import { createEmployee, updateEmployee, createDepartment } from './payrollApi'

const STATUSES = ['active', 'on_leave', 'suspended', 'inactive', 'terminated']
const STATUS_LABEL = { active: 'Active', on_leave: 'On Leave', suspended: 'Suspended', inactive: 'Inactive', terminated: 'Terminated' }

export default function EmployeeFormModal({ formId, settings, employee, departments, onClose, onSaved }) {
  const { showToast } = useToast()
  const editing = !!employee
  const [v, setV] = useState({
    full_name: employee?.full_name || '',
    employee_number: employee?.employee_number || '',
    phone: employee?.phone || '',
    email: employee?.email || '',
    job_title: employee?.job_title || '',
    department_id: employee?.department_id || '',
    employment_status: employee?.employment_status || 'active',
    start_date: employee?.start_date || '',
    monthly_salary: employee?.monthly_salary ?? '',
    bank_name: employee?.bank_name || '',
    account_number: employee?.account_number || '',
    account_name: employee?.account_name || '',
    payment_provider: employee?.payment_provider || '',
  })
  const [depts, setDepts] = useState(departments)
  const [newDept, setNewDept] = useState('')
  const [showBank, setShowBank] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setV(cur => ({ ...cur, [k]: e.target.value }))

  async function addDepartment() {
    if (!newDept.trim()) return
    try {
      const d = await createDepartment(formId, newDept)
      setDepts(cur => [...cur, d].sort((a, b) => a.name.localeCompare(b.name)))
      setV(cur => ({ ...cur, department_id: d.id }))
      setNewDept('')
    } catch (err) {
      showToast('Could not add department: ' + err.message, 'error')
    }
  }

  async function save() {
    if (!v.full_name.trim()) { showToast('Employee name is required.', 'error'); return }
    if (v.monthly_salary === '' || Number(v.monthly_salary) < 0) { showToast('Enter a monthly salary.', 'error'); return }
    setSaving(true)
    try {
      const values = {
        full_name: v.full_name.trim(),
        employee_number: v.employee_number.trim() || null,
        phone: v.phone.trim() || null,
        email: v.email.trim() || null,
        job_title: v.job_title.trim() || null,
        department_id: v.department_id || null,
        employment_status: v.employment_status,
        start_date: v.start_date || null,
        monthly_salary: Number(v.monthly_salary),
        bank_name: v.bank_name.trim() || null,
        account_number: v.account_number.trim() || null,
        account_name: v.account_name.trim() || null,
        payment_provider: v.payment_provider.trim() || null,
      }
      if (editing) await updateEmployee(formId, employee.id, values, settings)
      else await createEmployee(formId, values, settings)
      showToast(editing ? 'Employee updated.' : 'Employee added.', 'success')
      onSaved?.()
      onClose()
    } catch (err) {
      showToast('Could not save: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PayrollModal
      title={editing ? 'Edit Employee' : 'Add Employee'}
      onClose={onClose}
      wide
      footer={<>
        <button className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Employee'}</button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.9rem' }}>
        <Field label="Employee Name"><TextInput value={v.full_name} onChange={set('full_name')} /></Field>
        <Field label="Staff ID" hint="Optional — e.g. RCH-001"><TextInput value={v.employee_number} onChange={set('employee_number')} /></Field>
        <Field label="Phone"><TextInput value={v.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><TextInput type="email" value={v.email} onChange={set('email')} /></Field>
        <Field label="Job Title"><TextInput value={v.job_title} onChange={set('job_title')} placeholder="e.g. Cook / Chef" /></Field>
        <Field label="Department">
          <Select value={v.department_id} onChange={set('department_id')}>
            <option value="">— None —</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.9rem' }}>
        <div style={{ flex: 1 }}>
          <Field label="Create department"><TextInput value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department name" /></Field>
        </div>
        <button className="secondary" type="button" onClick={addDepartment} style={{ marginBottom: '0.9rem' }}>+ Add</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.9rem' }}>
        <Field label="Start Date"><TextInput type="date" value={v.start_date} onChange={set('start_date')} /></Field>
        <Field label="Employment Status">
          <Select value={v.employment_status} onChange={set('employment_status')}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field label="Monthly Salary (₦)"><TextInput type="number" min="0" step="0.01" value={v.monthly_salary} onChange={set('monthly_salary')} /></Field>
      </div>

      <button
        type="button"
        className="secondary"
        onClick={() => setShowBank(s => !s)}
        style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem', marginBottom: showBank ? '0.9rem' : 0 }}
      >
        {showBank ? '− Hide' : '+ Add'} bank / payment details
      </button>

      {showBank && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.9rem' }}>
          <Field label="Bank Name"><TextInput value={v.bank_name} onChange={set('bank_name')} /></Field>
          <Field label="Account Number"><TextInput value={v.account_number} onChange={set('account_number')} /></Field>
          <Field label="Account Name"><TextInput value={v.account_name} onChange={set('account_name')} /></Field>
          <Field label="Payment Provider"><TextInput value={v.payment_provider} onChange={set('payment_provider')} /></Field>
        </div>
      )}
    </PayrollModal>
  )
}

export { STATUS_LABEL }
