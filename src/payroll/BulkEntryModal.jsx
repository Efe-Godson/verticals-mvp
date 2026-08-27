// Bulk payroll entries (doc sections 15-18). Three modes in one modal:
//   same     - one entry applied to many employees (doc section 15)
//   days     - a day count per employee for missed / extra days (16-17)
//   grid     - a spreadsheet-style free grid (18)
import { useMemo, useState } from 'react'
import { useToast } from '../Toast'
import { PayrollModal, Field, TextInput, Select, money, currentMonth, entryTypeGroups, categoryOf } from './ui'
import { getDailyRate, ENTRY_TYPE_LABELS } from './calculatePayroll'
import { createEntries } from './payrollApi'

function todayStr() { return new Date().toISOString().slice(0, 10) }

const MODES = [
  { key: 'same', label: 'Same entry, many staff' },
  { key: 'days', label: 'Missed / extra days' },
  { key: 'grid', label: 'Spreadsheet' },
]

export default function BulkEntryModal({ formId, settings, employees, onClose, onSaved }) {
  const { showToast } = useToast()
  const groups = useMemo(() => entryTypeGroups(settings?.enabledEntryTypes), [settings])
  const employeesById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])

  const [mode, setMode] = useState('same')
  const [payrollMonth, setPayrollMonth] = useState(currentMonth())
  const [date, setDate] = useState(todayStr())
  const [saving, setSaving] = useState(false)

  // --- same-entry mode ---
  const [sameType, setSameType] = useState('fine')
  const [sameReason, setSameReason] = useState('')
  const [sameAmount, setSameAmount] = useState('')
  const [sameIds, setSameIds] = useState([])

  // --- days mode ---
  const [daysType, setDaysType] = useState('missed_day')
  const [dayCounts, setDayCounts] = useState({}) // { empId: qty }

  // --- grid mode ---
  const [rows, setRows] = useState([{ employee_id: '', entry_type: 'fine', reason: '', quantity: '', amount: '' }])

  function toggleSame(id) {
    setSameIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  }

  async function submit() {
    setSaving(true)
    try {
      let payload = []
      if (mode === 'same') {
        if (!sameIds.length) throw new Error('Pick at least one employee.')
        if (!(Number(sameAmount) > 0)) throw new Error('Enter an amount.')
        payload = sameIds.map(employee_id => ({
          employee_id, entry_date: date, entry_category: categoryOf(sameType), entry_type: sameType,
          quantity: null, amount: Number(sameAmount), reason: sameReason, payroll_month: payrollMonth,
        }))
      } else if (mode === 'days') {
        payload = Object.entries(dayCounts)
          .filter(([, qty]) => Number(qty) > 0)
          .map(([employee_id, qty]) => ({
            employee_id, entry_date: date, entry_category: categoryOf(daysType), entry_type: daysType,
            quantity: Number(qty), amount: 0, reason: ENTRY_TYPE_LABELS[daysType], payroll_month: payrollMonth,
          }))
        if (!payload.length) throw new Error('Enter a day count for at least one employee.')
      } else {
        payload = rows
          .filter(r => r.employee_id && r.entry_type)
          .map(r => ({
            employee_id: r.employee_id, entry_date: date,
            entry_category: categoryOf(r.entry_type), entry_type: r.entry_type,
            quantity: r.quantity !== '' ? Number(r.quantity) : null,
            amount: r.amount !== '' ? Number(r.amount) : 0,
            reason: r.reason, payroll_month: payrollMonth,
          }))
        if (!payload.length) throw new Error('Add at least one complete row.')
      }
      await createEntries(formId, payload, employeesById, settings)
      showToast(`${payload.length} entries saved.`, 'success')
      onSaved?.()
      onClose()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PayrollModal
      title="Add Bulk Payroll Entries"
      onClose={onClose}
      wide
      maxWidth={mode === 'grid' ? '760px' : undefined}
      footer={<>
        <button className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Entries'}</button>
      </>}
    >
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            className={mode === m.key ? '' : 'secondary'}
            onClick={() => setMode(m.key)}
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.8rem' }}>
        <div style={{ flex: 1 }}><Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Payroll Month"><TextInput type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} /></Field></div>
      </div>

      {mode === 'same' && (
        <>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <div style={{ flex: 1 }}>
              <Field label="Type">
                <Select value={sameType} onChange={(e) => setSameType(e.target.value)}>
                  <optgroup label="Deductions">{groups.deduction.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
                  <optgroup label="Additions">{groups.addition.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
                </Select>
              </Field>
            </div>
            <div style={{ flex: 1 }}><Field label="Amount (₦)"><TextInput type="number" min="0" step="0.01" value={sameAmount} onChange={(e) => setSameAmount(e.target.value)} /></Field></div>
          </div>
          <Field label="Reason"><TextInput value={sameReason} onChange={(e) => setSameReason(e.target.value)} /></Field>
          <Field label={`Employees (${sameIds.length} selected)`}>
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.5rem' }}>
              {employees.map(emp => (
                <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={sameIds.includes(emp.id)} onChange={() => toggleSame(emp.id)} />
                  {emp.full_name}
                </label>
              ))}
            </div>
          </Field>
        </>
      )}

      {mode === 'days' && (
        <>
          <Field label="Type">
            <Select value={daysType} onChange={(e) => setDaysType(e.target.value)}>
              <option value="missed_day">Missed Day (deduction)</option>
              <option value="extra_day">Extra Day (addition)</option>
            </Select>
          </Field>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {employees.map(emp => {
              const qty = Number(dayCounts[emp.id]) || 0
              const amt = qty * getDailyRate(emp.monthly_salary, payrollMonth, settings)
              return (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{emp.full_name}</span>
                  <input
                    type="number" min="0" step="0.5" value={dayCounts[emp.id] ?? ''}
                    onChange={(e) => setDayCounts(cur => ({ ...cur, [emp.id]: e.target.value }))}
                    style={{ width: '70px' }}
                  />
                  <span style={{ width: '110px', textAlign: 'right', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                    {qty > 0 ? money(amt, 0) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {mode === 'grid' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>{['Employee', 'Type', 'Reason', 'Qty', 'Amount', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const upd = (k, val) => setRows(cur => cur.map((row, j) => j === i ? { ...row, [k]: val } : row))
                return (
                  <tr key={i}>
                    <td style={{ padding: '0.25rem' }}>
                      <Select value={r.employee_id} onChange={(e) => upd('employee_id', e.target.value)} style={{ minWidth: '130px' }}>
                        <option value="">—</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                      </Select>
                    </td>
                    <td style={{ padding: '0.25rem' }}>
                      <Select value={r.entry_type} onChange={(e) => upd('entry_type', e.target.value)} style={{ minWidth: '120px' }}>
                        <optgroup label="Deductions">{groups.deduction.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
                        <optgroup label="Additions">{groups.addition.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
                      </Select>
                    </td>
                    <td style={{ padding: '0.25rem' }}><TextInput value={r.reason} onChange={(e) => upd('reason', e.target.value)} style={{ minWidth: '120px' }} /></td>
                    <td style={{ padding: '0.25rem' }}><TextInput type="number" min="0" step="0.5" value={r.quantity} onChange={(e) => upd('quantity', e.target.value)} style={{ width: '60px' }} /></td>
                    <td style={{ padding: '0.25rem' }}><TextInput type="number" min="0" step="0.01" value={r.amount} onChange={(e) => upd('amount', e.target.value)} style={{ width: '90px' }} placeholder="auto" /></td>
                    <td style={{ padding: '0.25rem' }}>
                      <button type="button" className="secondary" onClick={() => setRows(cur => cur.filter((_, j) => j !== i))} style={{ padding: '0.2rem 0.45rem' }}>×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button type="button" className="secondary" onClick={() => setRows(cur => [...cur, { employee_id: '', entry_type: 'fine', reason: '', quantity: '', amount: '' }])} style={{ marginTop: '0.5rem', fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}>
            + Add row
          </button>
          <p style={{ fontSize: '0.76rem', color: 'var(--color-muted)', marginTop: '0.4rem' }}>
            Leave Amount blank for Missed / Extra Day — it is computed from the day count.
          </p>
        </div>
      )}
    </PayrollModal>
  )
}
