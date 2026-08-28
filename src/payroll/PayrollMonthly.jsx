// The Payments page (index tab): the month's payroll at a glance (KPI
// strip), Run Payroll, the per-employee table + modal, and the bulk
// review / approve / mark-paid actions.
import { useEffect, useMemo, useState } from 'react'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import ConfirmDialog from '../ConfirmDialog'
import useIsMobile from '../hooks/useIsMobile'
import { MonthPicker, LocationFilter, PayrollModal, money, moneyShort, monthLabel, currentMonth, RecordStatusBadge } from './ui'
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
  const isMobile = useIsMobile(760)
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
  const [confirmPayAll, setConfirmPayAll] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  // Guided review after Run Payroll: walk each employee's breakdown one modal
  // at a time and approve / pay / hold before moving on.
  const [reviewQueue, setReviewQueue] = useState([]) // employee ids
  const [reviewIdx, setReviewIdx] = useState(null)   // null = not reviewing

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
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

  // Live projection for the KPI cards - covers the selected location and
  // stays useful before Run Payroll has produced any records.
  const kpi = useMemo(() => {
    const active = employees.filter(e => e.employment_status !== 'terminated' && (!location || e.primary_location_id === location))
    const bd = active.map(emp => calculateEmployeePayroll({
      employee: emp,
      entries: entries.filter(en => en.employee_id === emp.id && en.status !== 'rejected'),
      payrollMonth: month,
      settings,
    }))
    const paidRecs = records.filter(r => r.status === 'paid')
    return {
      staff: bd.length,
      total: bd.reduce((s, b) => s + b.baseSalary, 0),          // salaries as they started
      deductions: bd.reduce((s, b) => s + b.totalDeductions, 0),
      additions: bd.reduce((s, b) => s + b.totalAdditions, 0),
      net: bd.reduce((s, b) => s + b.finalAmount, 0),            // what we actually owe
      paidAmount: paidRecs.reduce((s, r) => s + Number(r.final_amount || 0), 0),
      paidCount: paidRecs.length,
    }
  }, [employees, entries, records, month, settings, location])

  const headcount = hasDraftRun ? records.length : kpi.staff
  const progressPct = kpi.net > 0 ? Math.round((kpi.paidAmount / kpi.net) * 100) : 0

  async function handleRun() {
    setRunning(true)
    try {
      const recs = await runPayroll(formId, month, form)
      setRecords(recs)
      setSelected([])
      showToast(`Payroll started for ${recs.length} employees. Review each one below.`, 'success')
      // Sort the review queue so the location filter (if any) leads.
      const ordered = recs
        .filter(r => !location || empById[r.employee_id]?.primary_location_id === location)
        .map(r => r.employee_id)
      if (ordered.length) { setReviewQueue(ordered); setReviewIdx(0) }
    } catch (err) {
      showToast('Start Payroll failed: ' + err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  function startReview(fromStatuses) {
    const q = records
      .filter(r => !fromStatuses || fromStatuses.includes(r.status))
      .map(r => r.employee_id)
    if (!q.length) { showToast('Nothing left to review.', 'info'); return }
    setReviewQueue(q)
    setReviewIdx(0)
  }

  // Clicking a row / card opens the same navigable modal, positioned at
  // that employee, so you can page back and forth through the whole table.
  function openAt(empId) {
    const q = records.map(r => r.employee_id)
    const i = q.indexOf(empId)
    if (i < 0) return
    setReviewQueue(q)
    setReviewIdx(i)
  }

  function advanceReview() {
    if (reviewIdx == null) return
    if (reviewIdx + 1 < reviewQueue.length) {
      setReviewIdx(reviewIdx + 1)
    } else {
      setReviewIdx(null)
      setReviewQueue([])
      showToast('Payroll review complete.', 'success')
      load({ quiet: true })
    }
  }

  function exitReview() {
    setReviewIdx(null)
    setReviewQueue([])
    load({ quiet: true })
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

  const payable = records.filter(r => r.status !== 'paid' && r.status !== 'cancelled' && r.status !== 'on_hold')
  const excluded = records.filter(r => r.status === 'on_hold')
  const payAllTotal = payable.reduce((s, r) => s + Number(r.final_amount || 0), 0)

  async function doPayAll() {
    setConfirmPayAll(false)
    try {
      await bulkSetRecordStatus(formId, payable, 'paid')
      await createPaymentBatch(formId, month, payable)
      showToast(`${payable.length} employees marked paid; payment batch created.`, 'success')
      load()
    } catch (err) {
      showToast('Mark All Paid failed: ' + err.message, 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const totalFinal = records.reduce((s, r) => s + Number(r.final_amount || 0), 0)

  // Guided-review current employee
  const reviewEmpId = reviewIdx != null ? reviewQueue[reviewIdx] : null
  const reviewEmp = reviewEmpId ? empById[reviewEmpId] : null
  const reviewRecord = reviewEmpId ? records.find(r => r.employee_id === reviewEmpId) : null
  const unreviewed = records.filter(r => ['draft', 'pending_approval', 'on_hold'].includes(r.status))

  return (
    <div>
      <style>{`
        .pay-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.7rem; margin-bottom: 1.1rem; }
        .pay-kpi { border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); padding: 0.9rem 1rem; }
        .pay-kpi .l { font-size: 0.72rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-muted); }
        .pay-kpi .v { font-size: 1.3rem; font-weight: 800; font-variant-numeric: tabular-nums; margin-top: 0.2rem; }
        .pay-kpi.net { border-color: var(--color-primary); background: var(--color-primary-soft); }
        .pay-kpi.net .v { font-size: 1.5rem; }
        @media (max-width: 760px) {
          .pay-kpis { grid-template-columns: 1fr 1fr; }
          .pay-kpi.k-total { order: 1 } .pay-kpi.net { order: 2 }
          .pay-kpi.k-ded { order: 3 } .pay-kpi.k-add { order: 4 }
          .pay-kpi .v { font-size: 1.15rem }
          .pay-kpi.net .v { font-size: 1.3rem }
        }
      `}</style>

      {/* controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <MonthPicker value={month} onChange={setMonth} />
          <LocationFilter locations={locations} value={location} onChange={setLocation} />
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {hasDraftRun && <button className="secondary" onClick={() => setExportOpen(true)}>Export</button>}
            {hasDraftRun && unreviewed.length > 0 && <button className="secondary" onClick={() => startReview(['draft', 'pending_approval', 'on_hold'])}>Review payroll ({unreviewed.length})</button>}
            {hasDraftRun && payable.length > 0 && <button className="secondary" onClick={() => setConfirmPayAll(true)}>Mark All Paid</button>}
            <button onClick={handleRun} disabled={running}>{running ? 'Starting…' : 'Start Payroll'}</button>
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{ marginBottom: '1rem' }}>
          <button onClick={handleRun} disabled={running} style={{ width: '100%', minHeight: 48, fontSize: '0.95rem' }}>
            {running ? 'Starting…' : 'Start Payroll'}
          </button>
          {hasDraftRun && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {unreviewed.length > 0 && <button className="secondary" style={{ flex: 1, minWidth: 130 }} onClick={() => startReview(['draft', 'pending_approval', 'on_hold'])}>Review ({unreviewed.length})</button>}
              <button className="secondary" style={{ flex: 1 }} onClick={() => setExportOpen(true)}>Export</button>
              {payable.length > 0 && <button className="secondary" style={{ flex: 1 }} onClick={() => setConfirmPayAll(true)}>Mark All Paid</button>}
            </div>
          )}
        </div>
      )}

      {/* 4 KPI cards */}
      <div className="pay-kpis">
        <Kpi cls="k-total" label="Total Payroll" value={kpi.total} short={isMobile} />
        <Kpi cls="k-ded" label="Deductions" value={kpi.deductions} short={isMobile} />
        <Kpi cls="k-add" label="Additions" value={kpi.additions} short={isMobile} />
        <Kpi cls="net" label="Net Payroll" value={kpi.net} short={isMobile} />
      </div>

      {/* payment progress */}
      <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1.3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.4rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>Payment progress</strong>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {isMobile
              ? <>{kpi.paidCount} of {headcount} paid · <strong style={{ color: 'var(--color-text)' }}>{progressPct}%</strong></>
              : <>{money(kpi.paidAmount)} of {money(kpi.net)} paid · {kpi.paidCount} of {headcount} employees</>}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--color-primary-soft)', overflow: 'hidden', margin: '0.55rem 0 0.35rem' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--color-primary)' }} />
        </div>
        {isMobile
          ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span>{money(kpi.paidAmount)} paid</span>
              <span style={{ color: 'var(--color-muted)' }}>{money(Math.max(0, kpi.net - kpi.paidAmount))} remaining</span>
            </div>
          : <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{progressPct}%</div>}
      </div>

      <div style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.7rem' }}>
        {monthLabel(month)} Payroll <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>· {headcount} employee{headcount === 1 ? '' : 's'}</span>
      </div>

      {!hasDraftRun ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          Payroll has not been run for {monthLabel(month)}.<br />
          Add entries first, then press <strong>Start Payroll</strong> to generate each employee's record.
        </div>
      ) : (
        <>
          {selected.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.6rem 1rem', background: 'var(--color-warning-soft)', borderRadius: 'var(--radius)', marginBottom: '0.8rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{selected.length} selected</span>
              <button className="secondary" onClick={() => bulk('paid')}>Mark Paid</button>
              <button className="secondary" onClick={() => bulk('on_hold')}>Hold Selected</button>
              <button className="secondary" onClick={() => setSelected([])}>Clear</button>
            </div>
          )}

          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {records.map(r => (
                <EmployeePayCard
                  key={r.id}
                  record={r}
                  name={empById[r.employee_id]?.full_name || '—'}
                  selected={selected.includes(r.id)}
                  onToggle={() => toggle(r.id)}
                  onOpen={() => openAt(r.employee_id)}
                />
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.2rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--color-muted)' }}>Total payable</span>
                <span>{money(totalFinal)}</span>
              </div>
            </div>
          ) : (
            <div className="table-wrap table-bleed">
              <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.6rem 0.5rem', borderBottom: '2px solid var(--color-border)' }}>
                      <input type="checkbox" checked={selected.length === records.length && records.length > 0} onChange={toggleAll} />
                    </th>
                    {['Employee', 'Base', 'Adjustments', 'Net Pay', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Employee' || h === 'Status' ? 'left' : 'right', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => {
                    const emp = empById[r.employee_id]
                    const adj = Number(r.total_additions || 0) - Number(r.total_deductions || 0)
                    return (
                      <tr key={r.id} style={{ cursor: 'pointer', background: r.status === 'paid' ? 'var(--color-primary-soft)' : undefined }} onClick={() => openAt(r.employee_id)}>
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
                        <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: adj > 0 ? 'var(--status-good)' : adj < 0 ? 'var(--status-critical)' : 'var(--color-muted)' }}>
                          {adj === 0 ? money(0) : `${adj > 0 ? '+' : '−'}${money(Math.abs(adj))}`}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontWeight: 700 }}>{money(r.final_amount)}</td>
                        <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}><RecordStatusBadge status={r.status} /></td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td colSpan={4} style={{ padding: '0.6rem 0.7rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-muted)' }}>Total payable</td>
                    <td style={{ padding: '0.6rem 0.7rem', textAlign: 'right', fontWeight: 800 }}>{money(totalFinal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* the navigable per-employee modal - opened by Start Payroll, the
          Review button, or clicking any row / card */}
      {reviewIdx != null && reviewEmp && reviewRecord && (
        <EmployeePayrollModal
          key={reviewEmpId}
          formId={formId}
          form={form}
          month={month}
          employee={{ ...reviewEmp, department_name: deptName[reviewEmp.department_id], location_name: locName[reviewEmp.primary_location_id] }}
          record={reviewRecord}
          entries={entries.filter(e => e.employee_id === reviewEmpId)}
          settings={settings}
          reviewPosition={{ index: reviewIdx + 1, total: reviewQueue.length }}
          onNext={advanceReview}
          onPrev={() => setReviewIdx(i => Math.max(0, (i ?? 0) - 1))}
          onClose={exitReview}
          onChanged={() => load({ quiet: true })}
        />
      )}

      {confirmPayAll && (
        <ConfirmDialog
          title="Mark all as paid?"
          message={`Marking ${payable.length} employees paid for a total of ${money(payAllTotal)}.${excluded.length ? ` ${excluded.length} on-hold employee${excluded.length > 1 ? 's are' : ' is'} excluded.` : ''}`}
          confirmLabel="Mark Paid"
          onConfirm={doPayAll}
          onCancel={() => setConfirmPayAll(false)}
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

function Kpi({ cls, label, value, short }) {
  return (
    <div className={`pay-kpi ${cls}`} title={short ? money(value) : undefined}>
      <div className="l">{label}</div>
      <div className="v">{short ? moneyShort(value) : money(value)}</div>
    </div>
  )
}

// Mobile row -> compact payment card (doc: don't squeeze the 6-col table
// onto a phone).
function EmployeePayCard({ record: r, name, selected, onToggle, onOpen }) {
  const adj = Number(r.total_additions || 0) - Number(r.total_deductions || 0)
  return (
    <div className="card" style={{ padding: '0.9rem 1rem', background: r.status === 'paid' ? 'var(--color-primary-soft)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={(e) => e.stopPropagation()} />
        <span style={{ fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <RecordStatusBadge status={r.status} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.3rem' }}>
        <span>Net Pay</span><span>{money(r.final_amount)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--color-muted)' }}>
        <span>Base</span><span>{money(r.base_salary)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--color-muted)' }}>
        <span>Adjustments</span>
        <span style={{ color: adj > 0 ? 'var(--status-good)' : adj < 0 ? 'var(--status-critical)' : 'inherit' }}>
          {adj === 0 ? money(0) : `${adj > 0 ? '+' : '−'}${money(Math.abs(adj))}`}
        </span>
      </div>
      <button className="secondary" onClick={onOpen} style={{ width: '100%', marginTop: '0.7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>View breakdown</span><span>›</span>
      </button>
    </div>
  )
}
