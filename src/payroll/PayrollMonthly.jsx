// The Payments page (index tab): the month's payroll at a glance (KPI
// strip), Run Payroll, the per-employee table + modal, and the bulk
// review / approve / mark-paid actions.
import { useEffect, useMemo, useState } from 'react'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import ConfirmDialog from '../ConfirmDialog'
import StatTile from '../report/components/StatTile'
import { MonthPicker, LocationFilter, PayrollModal, money, monthLabel, currentMonth, RecordStatusBadge } from './ui'
import { calculateEmployeePayroll } from './calculatePayroll'
import {
  payrollSettings, listEmployees, listDepartments, listLocations, listEntries, loadRecordsForMonth,
  runPayroll, bulkSetRecordStatus, createPaymentBatch,
} from './payrollApi'
import { exportPayrollToCSV, exportPayrollToExcel, exportPayrollToPDF } from './payrollExport'
import EmployeePayrollModal from './EmployeePayrollModal'

export default function PayrollMonthly() {
  const { form, formId } = usePayroll()
  const { showToast } = useToast()
  const settings = useMemo(() => payrollSettings(form), [form])

  const [month, setMonth] = useState(currentMonth())
  const [location, setLocation] = useState('')
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [locations, setLocations] = useState([])
  const [entries, setEntries] = useState([])
  const [allRecords, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState([])
  const [openEmpId, setOpenEmpId] = useState(null)
  const [confirmApproveAll, setConfirmApproveAll] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [emps, depts, locs, ents, recs] = await Promise.all([
        listEmployees(formId), listDepartments(formId), listLocations(formId),
        listEntries(formId, { month }), loadRecordsForMonth(formId, month),
      ])
      setEmployees(emps)
      setDepartments(depts)
      setLocations(locs)
      setEntries(ents)
      setRecords(recs)
      setSelected([])
    } catch (err) {
      setError(err.message || 'Could not load payroll.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [formId, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const empById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])
  const deptName = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.name])), [departments])
  const locName = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l.name])), [locations])
  // Run Payroll always covers every active employee; the location filter is a
  // view over the produced records.
  const records = useMemo(
    () => location ? allRecords.filter(r => empById[r.employee_id]?.primary_location_id === location) : allRecords,
    [allRecords, location, empById]
  )
  const hasDraftRun = allRecords.length > 0

  // Live projection for the KPI strip - covers the selected location and
  // stays useful before Run Payroll has produced any records.
  const kpi = useMemo(() => {
    const active = employees.filter(e => e.employment_status !== 'terminated' && (!location || e.primary_location_id === location))
    const bd = active.map(emp => calculateEmployeePayroll({
      employee: emp,
      entries: entries.filter(en => en.employee_id === emp.id && en.status !== 'rejected'),
      payrollMonth: month,
      settings,
    }))
    const paidAmount = records.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.final_amount || 0), 0)
    return {
      staff: bd.length,
      base: bd.reduce((s, b) => s + b.baseSalary, 0),
      deductions: bd.reduce((s, b) => s + b.totalDeductions, 0),
      additions: bd.reduce((s, b) => s + b.totalAdditions, 0),
      final: bd.reduce((s, b) => s + b.finalAmount, 0),
      paidAmount,
      paidCount: records.filter(r => r.status === 'paid').length,
    }
  }, [employees, entries, records, month, settings, location])

  async function handleRun() {
    setRunning(true)
    try {
      const recs = await runPayroll(formId, month, form)
      setRecords(recs)
      setSelected([])
      showToast(`Payroll run for ${recs.length} employees.`, 'success')
    } catch (err) {
      showToast('Run Payroll failed: ' + err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  function toggle(id) {
    setSelected(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  }
  function toggleAll() {
    setSelected(cur => cur.length === records.length ? [] : records.map(r => r.id))
  }

  async function bulk(status) {
    const targets = records.filter(r => selected.includes(r.id) && r.status !== 'paid' && r.status !== 'cancelled')
    if (!targets.length) { showToast('Nothing eligible selected.', 'error'); return }
    try {
      await bulkSetRecordStatus(formId, targets, status)
      showToast(`${targets.length} marked ${status.replace('_', ' ')}.`, 'success')
      load()
    } catch (err) {
      showToast('Bulk action failed: ' + err.message, 'error')
    }
  }

  const approvable = records.filter(r => r.status === 'draft' || r.status === 'pending_approval')
  const excluded = records.filter(r => r.status === 'on_hold')
  const approveAllTotal = approvable.reduce((s, r) => s + Number(r.final_amount || 0), 0)

  async function doApproveAll() {
    setConfirmApproveAll(false)
    try {
      await bulkSetRecordStatus(formId, approvable, 'approved')
      await createPaymentBatch(formId, month, approvable)
      showToast(`Approved ${approvable.length} employees; payment batch created.`, 'success')
      load()
    } catch (err) {
      showToast('Approve All failed: ' + err.message, 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const openEmp = openEmpId ? empById[openEmpId] : null
  const openRecord = openEmpId ? records.find(r => r.employee_id === openEmpId) : null
  const totalFinal = records.reduce((s, r) => s + Number(r.final_amount || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <MonthPicker value={month} onChange={setMonth} />
          <LocationFilter locations={locations} value={location} onChange={setLocation} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hasDraftRun && <button className="secondary" onClick={() => setExportOpen(true)}>Export</button>}
          {hasDraftRun && approvable.length > 0 && <button className="secondary" onClick={() => setConfirmApproveAll(true)}>Approve All</button>}
          <button onClick={handleRun} disabled={running}>{running ? 'Running…' : hasDraftRun ? 'Re-run Payroll' : 'Run Payroll'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
        <StatTile label="Staff" value={kpi.staff} />
        <StatTile label="Base Payroll" value={money(kpi.base)} />
        <StatTile label="Deductions" value={money(kpi.deductions)} />
        <StatTile label="Additions" value={money(kpi.additions)} />
        <StatTile label="Final Payroll" value={money(kpi.final)} />
        <StatTile label="Paid" value={`${money(kpi.paidAmount)} / ${money(kpi.final)}`} />
      </div>

      {!hasDraftRun ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          Payroll has not been run for {monthLabel(month)}.<br />
          Add entries first, then press <strong>Run Payroll</strong> to generate each employee's record.
        </div>
      ) : (
        <>
          {selected.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.6rem 1rem', background: 'var(--color-warning-soft)', borderRadius: 'var(--radius)', marginBottom: '0.8rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{selected.length} selected</span>
              <button className="secondary" onClick={() => bulk('approved')}>Approve Selected</button>
              <button className="secondary" onClick={() => bulk('on_hold')}>Hold Selected</button>
              <button className="secondary" onClick={() => bulk('paid')}>Mark Paid</button>
              <button className="secondary" onClick={() => setSelected([])}>Clear</button>
            </div>
          )}

          <div className="table-wrap table-bleed">
            <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.6rem 0.5rem', borderBottom: '2px solid var(--color-border)' }}>
                    <input type="checkbox" checked={selected.length === records.length && records.length > 0} onChange={toggleAll} />
                  </th>
                  {['Employee', 'Salary', 'Additions', 'Deductions', 'Final Amount', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Employee' || h === 'Status' ? 'left' : 'right', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const emp = empById[r.employee_id]
                  return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpenEmpId(r.employee_id)}>
                      <td style={{ padding: '0.55rem 0.5rem', borderBottom: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                      </td>
                      <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                        {emp?.full_name || '—'}
                        {(emp?.department_id || emp?.primary_location_id) && (
                          <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                            {' · '}{[deptName[emp.department_id], locName[emp.primary_location_id]].filter(Boolean).join(' — ')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{money(r.base_salary)}</td>
                      <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: r.total_additions > 0 ? 'var(--status-good)' : 'inherit' }}>{money(r.total_additions)}</td>
                      <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: r.total_deductions > 0 ? 'var(--status-critical)' : 'inherit' }}>{money(r.total_deductions)}</td>
                      <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontWeight: 700 }}>{money(r.final_amount)}</td>
                      <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}><RecordStatusBadge status={r.status} /></td>
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={5} style={{ padding: '0.6rem 0.7rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-muted)' }}>Total payable</td>
                  <td style={{ padding: '0.6rem 0.7rem', textAlign: 'right', fontWeight: 800 }}>{money(totalFinal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {openEmp && openRecord && (
        <EmployeePayrollModal
          formId={formId}
          form={form}
          month={month}
          employee={{ ...openEmp, department_name: deptName[openEmp.department_id], location_name: locName[openEmp.primary_location_id] }}
          record={openRecord}
          entries={entries.filter(e => e.employee_id === openEmpId)}
          settings={settings}
          onClose={() => setOpenEmpId(null)}
          onChanged={load}
        />
      )}

      {confirmApproveAll && (
        <ConfirmDialog
          title="Approve Payroll?"
          message={`You are approving ${approvable.length} employees for a total of ${money(approveAllTotal)}.${excluded.length ? ` ${excluded.length} on-hold employee${excluded.length > 1 ? 's are' : ' is'} excluded.` : ''}`}
          confirmLabel="Approve Payroll"
          onConfirm={doApproveAll}
          onCancel={() => setConfirmApproveAll(false)}
        />
      )}

      {exportOpen && (
        <PayrollModal
          title={`Export — ${monthLabel(month)}`}
          onClose={() => setExportOpen(false)}
          footer={<button className="secondary" onClick={() => setExportOpen(false)}>Close</button>}
        >
          <p style={{ marginTop: 0, color: 'var(--color-muted)', fontSize: '0.88rem' }}>{records.length} employee records.</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => { exportPayrollToExcel(records, empById, month); setExportOpen(false) }}>Excel</button>
            <button onClick={() => { exportPayrollToCSV(records, empById, month); setExportOpen(false) }}>CSV</button>
            <button onClick={() => { exportPayrollToPDF(records, empById, month); setExportOpen(false) }}>PDF</button>
          </div>
        </PayrollModal>
      )}
    </div>
  )
}
