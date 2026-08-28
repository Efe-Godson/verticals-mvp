// Employee profile (doc sections 9-10): header, quick actions, and tabs for
// Overview / Entries / Payroll History / Payments.
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import { money, monthLabel, EmployeeStatusBadge, RecordStatusBadge, roleList, deptIds, locationIds, namesFor } from './ui'
import { getDailyRate, ENTRY_TYPE_LABELS } from './calculatePayroll'
import {
  payrollSettings, getEmployee, listDepartments, listLocations, listEntries, deleteEmployee,
} from './payrollApi'
import { supabase } from '../supabaseClient'
import EmployeeFormModal from './EmployeeFormModal'
import AddEntryModal from './AddEntryModal'
import ConfirmDialog from '../ConfirmDialog'

const QUICK = [
  { type: 'fine', label: 'Add Fine' },
  { type: 'missed_day', label: 'Add Missed Day' },
  { type: 'extra_day', label: 'Add Extra Day' },
  { type: 'bonus', label: 'Add Addition' },
  { type: 'other_deduction', label: 'Add Deduction' },
]

function currentMonthStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export default function PayrollEmployeeProfile() {
  const { empId } = useParams()
  const { form, formId } = usePayroll()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const settings = useMemo(() => payrollSettings(form), [form])

  const [employee, setEmployee] = useState(null)
  const [departments, setDepartments] = useState([])
  const [locations, setLocations] = useState([])
  const [entries, setEntries] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [addType, setAddType] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [emp, depts, locs] = await Promise.all([getEmployee(empId), listDepartments(formId), listLocations(formId)])
      setEmployee(emp)
      setDepartments(depts)
      setLocations(locs)
      const [ents, allRecords] = await Promise.all([
        listEntries(formId, { employeeId: empId }),
        supabase.from('payroll_records').select('*').eq('payroll_form_id', formId).eq('employee_id', empId).order('payroll_month', { ascending: false }),
      ])
      setEntries(ents)
      setRecords(allRecords.data || [])
    } catch (err) {
      setError(err.message || 'Could not load employee.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [empId, formId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const deptNameById = Object.fromEntries(departments.map(d => [d.id, d.name]))
  const locNameById = Object.fromEntries(locations.map(l => [l.id, l.name]))
  const roleText = roleList(employee).join(', ')
  const deptText = namesFor(deptIds(employee), deptNameById)
  const locText = namesFor(locationIds(employee), locNameById)
  const dailyRate = getDailyRate(employee.monthly_salary, currentMonthStr(), settings)
  const thisMonthEntries = entries.filter(e => e.payroll_month === currentMonthStr())
  const lastPaid = records.find(r => r.status === 'paid')

  async function handleDelete() {
    setConfirmDelete(false)
    try {
      await deleteEmployee(formId, empId)
      showToast('Employee removed.', 'success')
      navigate('/form/' + formId + '/payroll/staff')
    } catch (err) {
      showToast('Could not remove: ' + err.message, 'error')
    }
  }

  return (
    <div>
      <button className="secondary" onClick={() => navigate(-1)} style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem', marginBottom: '0.8rem' }}>← Back</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{employee.full_name}</h2>
          <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            {[roleText, deptText, locText].filter(Boolean).join(' · ') || 'No role set'}
            {employee.employee_number ? ` · ${employee.employee_number}` : ''}
          </div>
          <div style={{ marginTop: '0.4rem' }}><EmployeeStatusBadge status={employee.employment_status} /></div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={() => setEditOpen(true)}>Edit</button>
          <button className="secondary" style={{ color: '#c0392b' }} onClick={() => setConfirmDelete(true)}>Remove</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Monthly Salary</div><strong style={{ fontSize: '1.15rem' }}>{money(employee.monthly_salary)}</strong></div>
        <div><div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Daily Rate</div><strong style={{ fontSize: '1.15rem' }}>{money(dailyRate, 2)}</strong></div>
        <div><div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Start Date</div><strong style={{ fontSize: '1.15rem' }}>{employee.start_date ? new Date(employee.start_date).toLocaleDateString('en-GB') : '—'}</strong></div>
        <div><div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Last Payment</div><strong style={{ fontSize: '1.15rem' }}>{lastPaid ? money(lastPaid.final_amount) : '—'}</strong></div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '1.1rem 0' }}>
        {QUICK.map(q => (
          <button key={q.type} className="secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => setAddType(q.type)}>{q.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
        {[['overview', 'Overview'], ['entries', 'Entries'], ['history', 'Payroll History'], ['payments', 'Payments']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="secondary"
            style={{
              border: 'none', background: 'none', borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === key ? 'var(--color-primary)' : 'var(--color-muted)', borderRadius: 0, fontWeight: 600, fontSize: '0.86rem',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>This month's adjustments ({monthLabel(currentMonthStr())})</div>
          {thisMonthEntries.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>No entries yet this month.</p>
          ) : thisMonthEntries.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.87rem', padding: '0.3rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>{ENTRY_TYPE_LABELS[e.entry_type]}{e.reason ? ` — ${e.reason}` : ''}</span>
              <span style={{ color: e.entry_category === 'deduction' ? 'var(--status-critical)' : 'var(--status-good)' }}>
                {e.entry_category === 'deduction' ? '-' : '+'}{money(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'entries' && (
        <div className="table-wrap table-bleed">
          <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>{['Date', 'Type', 'Reason', 'Amount', 'Payroll'].map(h => (
              <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '0.5rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={5} style={{ padding: '1.2rem', color: 'var(--color-muted)' }}>No entries.</td></tr>}
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{new Date(e.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{ENTRY_TYPE_LABELS[e.entry_type]}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{e.reason || '—'}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: e.entry_category === 'deduction' ? 'var(--status-critical)' : 'var(--status-good)' }}>
                    {e.entry_category === 'deduction' ? '-' : '+'}{money(e.amount)}
                  </td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)', fontSize: '0.82rem' }}>{monthLabel(e.payroll_month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === 'history' || tab === 'payments') && (
        <div className="table-wrap table-bleed">
          <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>{['Month', 'Base', 'Additions', 'Deductions', 'Final', 'Status'].map(h => (
              <th key={h} style={{ textAlign: h === 'Month' || h === 'Status' ? 'left' : 'right', padding: '0.5rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {records.filter(r => tab === 'history' || r.status === 'paid').length === 0 && (
                <tr><td colSpan={6} style={{ padding: '1.2rem', color: 'var(--color-muted)' }}>Nothing yet.</td></tr>
              )}
              {records.filter(r => tab === 'history' || r.status === 'paid').map(r => (
                <tr key={r.id}>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{monthLabel(r.payroll_month)}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{money(r.base_salary)}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{money(r.total_additions)}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{money(r.total_deductions)}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontWeight: 700 }}>{money(r.final_amount)}</td>
                  <td style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}><RecordStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editOpen && (
        <EmployeeFormModal formId={formId} settings={settings} employee={employee} departments={departments} locations={locations} roleSuggestions={roleList(employee)} onClose={() => setEditOpen(false)} onSaved={load} />
      )}
      {addType && (
        <AddEntryModal formId={formId} settings={settings} employees={[employee]} presetEmployeeId={employee.id} presetType={addType} onClose={() => setAddType(null)} onSaved={load} />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Remove employee?"
          message={`${employee.full_name} will be hidden from payroll. Existing records are kept.`}
          confirmLabel="Remove"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
