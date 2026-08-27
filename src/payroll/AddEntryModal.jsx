// Single payroll entry (doc sections 13-14). Handles the "smart" types:
// missed_day / extra_day hide the Amount field and ask for a day count
// instead, showing the computed amount live (quantity x daily rate).
import { useMemo, useState } from 'react'
import { useToast } from '../Toast'
import { PayrollModal, Field, TextInput, Select, money, currentMonth, entryTypeGroups, categoryOf, DAY_ENTRY_TYPES } from './ui'
import { getDailyRate, ENTRY_TYPE_LABELS } from './calculatePayroll'
import { createEntries } from './payrollApi'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function AddEntryModal({
  formId, settings, employees, presetEmployeeId, presetType, onClose, onSaved,
}) {
  const { showToast } = useToast()
  const groups = useMemo(() => entryTypeGroups(settings?.enabledEntryTypes), [settings])

  const [employeeIds, setEmployeeIds] = useState(presetEmployeeId ? [presetEmployeeId] : [])
  const [entryType, setEntryType] = useState(presetType || 'fine')
  const [date, setDate] = useState(todayStr())
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [payrollMonth, setPayrollMonth] = useState(currentMonth())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const isDayType = DAY_ENTRY_TYPES.includes(entryType)
  const employeesById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])

  // Live preview of the computed amount for day-based entries. When several
  // employees are selected their daily rates differ, so show a range.
  const dayPreview = useMemo(() => {
    if (!isDayType || !employeeIds.length) return null
    const qty = Number(quantity) || 0
    const values = employeeIds.map(id => qty * getDailyRate(employeesById[id]?.monthly_salary, payrollMonth, settings))
    const min = Math.min(...values), max = Math.max(...values)
    return min === max ? money(min, 2) : `${money(min, 2)} – ${money(max, 2)}`
  }, [isDayType, employeeIds, quantity, payrollMonth, settings, employeesById])

  function handleTypeChange(next) {
    setEntryType(next)
  }

  function toggleEmployee(id) {
    setEmployeeIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  }

  async function save() {
    if (!employeeIds.length) { showToast('Pick at least one employee.', 'error'); return }
    if (!isDayType && !(Number(amount) > 0)) { showToast('Enter an amount.', 'error'); return }
    if (isDayType && !(Number(quantity) > 0)) { showToast('Enter a number of days.', 'error'); return }

    setSaving(true)
    try {
      const rows = employeeIds.map(employee_id => ({
        employee_id,
        entry_date: date,
        entry_category: categoryOf(entryType),
        entry_type: entryType,
        quantity: isDayType ? Number(quantity) : null,
        amount: isDayType ? 0 : Number(amount),
        reason,
        notes,
        payroll_month: payrollMonth,
      }))
      await createEntries(formId, rows, employeesById, settings)
      showToast(`Entry saved for ${employeeIds.length} employee${employeeIds.length > 1 ? 's' : ''}.`, 'success')
      onSaved?.()
      onClose()
    } catch (err) {
      showToast('Could not save entry: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PayrollModal
      title="Add Payroll Entry"
      onClose={onClose}
      footer={<>
        <button className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button>
      </>}
    >
      <Field label={`Employees (${employeeIds.length} selected)`}>
        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.5rem' }}>
          {employees.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>No employees yet.</div>}
          {employees.map(emp => (
            <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={employeeIds.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} />
              {emp.full_name}
            </label>
          ))}
        </div>
      </Field>

      <div style={{ display: 'flex', gap: '0.8rem' }}>
        <div style={{ flex: 1 }}>
          <Field label="Entry Type">
            <Select value={entryType} onChange={(e) => handleTypeChange(e.target.value)}>
              <optgroup label="Deductions">
                {groups.deduction.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
              <optgroup label="Additions">
                {groups.addition.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </div>

      {isDayType ? (
        <Field label="Number of days" hint={dayPreview ? `Computed amount: ${dayPreview}` : 'Amount is calculated from the daily rate.'}>
          <TextInput type="number" min="0" step="0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
      ) : (
        <Field label="Amount (₦)">
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}

      <Field label="Reason">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`e.g. ${ENTRY_TYPE_LABELS[entryType]} — details`} />
      </Field>

      <div style={{ display: 'flex', gap: '0.8rem' }}>
        <div style={{ flex: 1 }}>
          <Field label="Payroll Month" hint="Defaults from the entry date.">
            <TextInput type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Notes (optional)">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </PayrollModal>
  )
}
