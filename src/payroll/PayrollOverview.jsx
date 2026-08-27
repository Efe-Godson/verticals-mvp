// Overview dashboard (doc section 3): the current month at a glance.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePayroll } from './PayrollShell'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import StatTile from '../report/components/StatTile'
import PieChart from '../report/components/PieChart'
import { MonthPicker, money, monthLabel, currentMonth } from './ui'
import { calculateEmployeePayroll, ENTRY_TYPE_LABELS } from './calculatePayroll'
import {
  payrollSettings, listEmployees, listEntries, loadRecordsForMonth, runPayroll,
} from './payrollApi'
import AddEntryModal from './AddEntryModal'

export default function PayrollOverview() {
  const { form, formId } = usePayroll()
  const navigate = useNavigate()
  const settings = useMemo(() => payrollSettings(form), [form])

  const [month, setMonth] = useState(currentMonth())
  const [employees, setEmployees] = useState([])
  const [entries, setEntries] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [running, setRunning] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [emps, ents, recs] = await Promise.all([
        listEmployees(formId),
        listEntries(formId, { month }),
        loadRecordsForMonth(formId, month),
      ])
      setEmployees(emps)
      setEntries(ents)
      setRecords(recs)
    } catch (err) {
      setError(err.message || 'Could not load payroll overview.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [formId, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const breakdowns = useMemo(() => {
    const active = employees.filter(e => e.employment_status !== 'terminated')
    return active.map(emp => calculateEmployeePayroll({
      employee: emp,
      entries: entries.filter(en => en.employee_id === emp.id && en.status !== 'rejected'),
      payrollMonth: month,
      settings,
    }))
  }, [employees, entries, month, settings])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const basePayroll = breakdowns.reduce((s, b) => s + b.baseSalary, 0)
  const totalDeductions = breakdowns.reduce((s, b) => s + b.totalDeductions, 0)
  const totalAdditions = breakdowns.reduce((s, b) => s + b.totalAdditions, 0)
  const finalPayroll = breakdowns.reduce((s, b) => s + b.finalAmount, 0)

  const paidRecords = records.filter(r => r.status === 'paid')
  const paidAmount = paidRecords.reduce((s, r) => s + Number(r.final_amount || 0), 0)
  const pendingCount = Math.max(0, breakdowns.length - paidRecords.length)

  const recent = entries.slice(0, 8).map(e => ({
    id: e.id,
    text: `${e.employee?.full_name || 'Someone'} — ${ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}${e.reason ? ` (${e.reason})` : ''}`,
    amount: `${e.entry_category === 'deduction' ? '-' : '+'}${money(e.amount)}`,
    deduction: e.entry_category === 'deduction',
  }))

  async function handleRun() {
    setRunning(true)
    try {
      await runPayroll(formId, month, form)
      navigate('monthly')
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.7rem', marginBottom: '1.2rem' }}>
        <MonthPicker value={month} onChange={setMonth} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={() => setAddOpen(true)}>+ Add Entry</button>
          <button onClick={handleRun} disabled={running}>{running ? 'Running…' : 'Run Payroll'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
        <StatTile label="Total Staff" value={employees.filter(e => e.employment_status !== 'terminated').length} />
        <StatTile label="Base Payroll" value={money(basePayroll)} />
        <StatTile label="Total Deductions" value={money(totalDeductions)} />
        <StatTile label="Total Additions" value={money(totalAdditions)} />
        <StatTile label="Final Payroll" value={money(finalPayroll)} />
        <StatTile label="Payment Progress" value={`${money(paidAmount)} / ${money(finalPayroll)}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <div className="card" style={{ padding: '1.2rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
            Payment Progress — {monthLabel(month)}
          </div>
          {records.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Payroll not run for this month yet.</p>
          ) : (
            <PieChart size={150} data={[{ label: 'Paid', count: paidRecords.length }, { label: 'Pending', count: pendingCount }]} />
          )}
        </div>

        <div className="card" style={{ padding: '1.2rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>Recent Activity</div>
          {recent.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>No entries recorded for this month.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {recent.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', fontSize: '0.86rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.4rem' }}>
                  <span>{r.text}</span>
                  <span style={{ whiteSpace: 'nowrap', color: r.deduction ? 'var(--status-critical)' : 'var(--status-good)' }}>{r.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <AddEntryModal
          formId={formId}
          settings={settings}
          employees={employees}
          onClose={() => setAddOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
