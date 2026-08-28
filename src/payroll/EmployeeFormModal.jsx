// Add / edit an employee (doc sections 5-8). Personal + employment + salary,
// with inline "create department / location" shortcuts and a collapsed
// bank-details block (optional, for future API payouts).
//
// Role, Department and Location are each multi-value categories - one person
// can be a "Baker" and a "Store Keeper", or work across two locations. Roles
// are free-text tags (with autocomplete from roles already in use);
// departments and locations are picked from the managed lists, with "+ Add"
// to create a new one on the spot.
import { useMemo, useState } from 'react'
import { useToast } from '../Toast'
import { PayrollModal, Field, TextInput, Select, roleList, deptIds, locationIds } from './ui'
import { createEmployee, updateEmployee, createDepartment, createLocation } from './payrollApi'

const STATUSES = ['active', 'on_leave', 'suspended', 'inactive', 'terminated']
const STATUS_LABEL = { active: 'Active', on_leave: 'On Leave', suspended: 'Suspended', inactive: 'Inactive', terminated: 'Terminated' }

const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.82rem',
  background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)',
}
const chipX = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  fontSize: '0.95rem', lineHeight: 1, color: 'var(--color-text)',
}

// Free-text tags (roles). Enter or comma commits; `suggestions` feeds a datalist.
function TagInput({ values, onChange, placeholder, suggestions = [], listId }) {
  const [draft, setDraft] = useState('')
  const add = (raw) => {
    const t = raw.trim()
    if (!t) return
    if (!values.some(v => v.toLowerCase() === t.toLowerCase())) onChange([...values, t])
    setDraft('')
  }
  return (
    <div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
          {values.map(v => (
            <span key={v} style={chipStyle}>
              {v}
              <button type="button" style={chipX} aria-label={`Remove ${v}`} onClick={() => onChange(values.filter(x => x !== v))}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        list={listId}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft) }
          else if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1))
        }}
        onBlur={() => add(draft)}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  )
}

// Pick several from a known list (departments / locations). Chips for the
// chosen ones + a dropdown of the rest.
function MultiSelectChips({ values, onChange, options, placeholder }) {
  const byId = Object.fromEntries(options.map(o => [o.id, o.name]))
  const unchosen = options.filter(o => !values.includes(o.id))
  return (
    <div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
          {values.map(id => (
            <span key={id} style={chipStyle}>
              {byId[id] || 'Unknown'}
              <button type="button" style={chipX} aria-label="Remove" onClick={() => onChange(values.filter(x => x !== id))}>×</button>
            </span>
          ))}
        </div>
      )}
      <Select
        value=""
        onChange={(e) => { if (e.target.value) onChange([...values, e.target.value]) }}
        disabled={!unchosen.length}
      >
        <option value="">{unchosen.length ? (placeholder || 'Add…') : 'All added'}</option>
        {unchosen.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
    </div>
  )
}

export default function EmployeeFormModal({ formId, settings, employee, departments, locations = [], roleSuggestions = [], onClose, onSaved }) {
  const { showToast } = useToast()
  const editing = !!employee
  const [v, setV] = useState({
    full_name: employee?.full_name || '',
    employee_number: employee?.employee_number || '',
    phone: employee?.phone || '',
    email: employee?.email || '',
    job_titles: roleList(employee),
    department_ids: deptIds(employee),
    location_ids: locationIds(employee),
    employment_status: employee?.employment_status || 'active',
    start_date: employee?.start_date || '',
    monthly_salary: employee?.monthly_salary ?? '',
    bank_name: employee?.bank_name || '',
    account_number: employee?.account_number || '',
    account_name: employee?.account_name || '',
    payment_provider: employee?.payment_provider || '',
  })
  const [depts, setDepts] = useState(departments)
  const [locs, setLocs] = useState(locations)
  const [newDept, setNewDept] = useState('')
  const [newLoc, setNewLoc] = useState('')
  const [showBank, setShowBank] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setV(cur => ({ ...cur, [k]: e.target.value }))
  const setField = (k) => (val) => setV(cur => ({ ...cur, [k]: val }))

  const roleOptions = useMemo(
    () => Array.from(new Set([...roleSuggestions, ...v.job_titles])).sort((a, b) => a.localeCompare(b)),
    [roleSuggestions, v.job_titles],
  )

  async function addDepartment() {
    if (!newDept.trim()) return
    try {
      const d = await createDepartment(formId, newDept)
      setDepts(cur => [...cur, d].sort((a, b) => a.name.localeCompare(b.name)))
      setV(cur => ({ ...cur, department_ids: [...cur.department_ids, d.id] }))
      setNewDept('')
    } catch (err) {
      showToast('Could not add department: ' + err.message, 'error')
    }
  }

  async function addLocation() {
    if (!newLoc.trim()) return
    try {
      const l = await createLocation(formId, { name: newLoc.trim() })
      setLocs(cur => [...cur, l].sort((a, b) => a.name.localeCompare(b.name)))
      setV(cur => ({ ...cur, location_ids: [...cur.location_ids, l.id] }))
      setNewLoc('')
    } catch (err) {
      showToast('Could not add location: ' + err.message, 'error')
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
        job_titles: v.job_titles,
        department_ids: v.department_ids,
        location_ids: v.location_ids,
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
      <div className="form-2col">
        <Field label="Employee Name"><TextInput value={v.full_name} onChange={set('full_name')} /></Field>
        <Field label="Staff ID" hint="Optional — e.g. RCH-001"><TextInput value={v.employee_number} onChange={set('employee_number')} /></Field>
        <Field label="Phone"><TextInput value={v.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><TextInput type="email" value={v.email} onChange={set('email')} /></Field>
      </div>

      <Field label="Roles" hint="One person can hold several — type a role and press Enter.">
        <TagInput
          values={v.job_titles}
          onChange={setField('job_titles')}
          placeholder="e.g. Baker, then Enter"
          suggestions={roleOptions}
          listId="emp-role-suggestions"
        />
      </Field>

      <div className="form-2col">
        <Field label="Departments" hint="Assign to one or more.">
          <MultiSelectChips values={v.department_ids} onChange={setField('department_ids')} options={depts} placeholder="Add a department…" />
        </Field>
        <Field label="Locations" hint="Works at one or more.">
          <MultiSelectChips values={v.location_ids} onChange={setField('location_ids')} options={locs} placeholder="Add a location…" />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Field label="Create department"><TextInput value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department name" /></Field>
        </div>
        <button className="secondary" type="button" onClick={addDepartment} style={{ marginBottom: '0.9rem' }}>+ Add</button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Field label="Create location"><TextInput value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="New location name" /></Field>
        </div>
        <button className="secondary" type="button" onClick={addLocation} style={{ marginBottom: '0.9rem' }}>+ Add</button>
      </div>

      <div className="form-2col">
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
        <div className="form-2col">
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
