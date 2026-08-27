// Entry Register (doc sections 19-20): every payroll event, filterable,
// signed +/- amounts.
import { useEffect, useMemo, useState } from 'react'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import { money, monthLabel, currentMonth } from './ui'
import { ENTRY_TYPE_LABELS, DEDUCTION_TYPES, ADDITION_TYPES } from './calculatePayroll'
import { payrollSettings, listEmployees, listEntries, deleteEntry } from './payrollApi'
import AddEntryModal from './AddEntryModal'
import BulkEntryModal from './BulkEntryModal'

export default function PayrollEntries() {
  const { form, formId } = usePayroll()
  const { showToast } = useToast()
  const settings = useMemo(() => payrollSettings(form), [form])

  const [employees, setEmployees] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const [fMonth, setFMonth] = useState(currentMonth())
  const [fEmployee, setFEmployee] = useState('')
  const [fType, setFType] = useState('')
  const [fCategory, setFCategory] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [emps, ents] = await Promise.all([
        listEmployees(formId),
        listEntries(formId, {
          month: fMonth || undefined,
          employeeId: fEmployee || undefined,
          entryType: fType || undefined,
          category: fCategory || undefined,
        }),
      ])
      setEmployees(emps)
      setEntries(ents)
    } catch (err) {
      setError(err.message || 'Could not load entries.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [formId, fMonth, fEmployee, fType, fCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(id) {
    try {
      await deleteEntry(formId, id)
      showToast('Entry removed.', 'success')
      load()
    } catch (err) {
      showToast('Could not remove: ' + err.message, 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} />
          <select value={fEmployee} onChange={(e) => setFEmployee(e.target.value)}>
            <option value="">All employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
            <option value="">All</option>
            <option value="deduction">Deductions</option>
            <option value="addition">Additions</option>
          </select>
          <select value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">All types</option>
            <optgroup label="Deductions">{DEDUCTION_TYPES.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}</optgroup>
            <optgroup label="Additions">{ADDITION_TYPES.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}</optgroup>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={() => setBulkOpen(true)}>Bulk Entry</button>
          <button onClick={() => setAddOpen(true)}>+ Add Entry</button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Date', 'Employee', 'Type', 'Reason', 'Amount', 'Payroll', ''].map(h => (
              <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '1.4rem', color: 'var(--color-muted)' }}>No entries for this filter.</td></tr>
            )}
            {entries.map(e => {
              const deduction = e.entry_category === 'deduction'
              return (
                <tr key={e.id}>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    {new Date(e.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{e.employee?.full_name || '—'}</td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                    {ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}
                    {e.quantity != null && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}> × {e.quantity}</span>}
                  </td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{e.reason || '—'}</td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap', color: deduction ? 'var(--status-critical)' : 'var(--status-good)' }}>
                    {deduction ? '-' : '+'}{money(e.amount)}
                  </td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', color: 'var(--color-muted)', fontSize: '0.82rem' }}>{monthLabel(e.payroll_month)}</td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                    <button className="secondary" onClick={() => remove(e.id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}>Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddEntryModal formId={formId} settings={settings} employees={employees} onClose={() => setAddOpen(false)} onSaved={load} />
      )}
      {bulkOpen && (
        <BulkEntryModal formId={formId} settings={settings} employees={employees} onClose={() => setBulkOpen(false)} onSaved={load} />
      )}
    </div>
  )
}
