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
import { MonthPicker, LocationFilter, PayrollModal, money, moneyShort, monthLabel, currentMonth, RecordStatusBadge, friendlyError } from './ui'
import { calculateEmployeePayroll } from './calculatePayroll'
import {
  payrollSettings, listEmployees, listDepartments, listLocations, listEntries, loadRecordsForMonth,
  runPayroll, bulkSetRecordStatus, createPaymentBatch, resetPayrollMonth,
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false)
  // { title, message, confirmLabel, danger?, run } for one-off confirmations
  const [confirmAction, setConfirmAction] = useState(null)
  const ask = (cfg) => setConfirmAction(cfg)
  const askPayAll = () => setConfirmPayAll(true)
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
  const hasRun = allRecords.length > 0

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

  const headcount = hasRun ? records.length : kpi.staff
  const progressPct = kpi.net > 0 ? Math.round((kpi.paidAmount / kpi.net) * 100) : 0

  async function doRun() {
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
      showToast(friendlyError(err, "Couldn't start payroll. Please try again."), 'error')
    } finally {
      setRunning(false)
    }
  }

  function handleRun() {
    if (running) return
    ask({
      title: `Start ${monthLabel(month)} payroll?`,
      message: `${kpi.staff} employee${kpi.staff === 1 ? '' : 's'} · base ${money(kpi.total)}, − ${money(kpi.deductions)} deductions, + ${money(kpi.additions)} additions → estimated net ${money(kpi.net)}. A record is created for each, then you review and pay them one by one.`,
      confirmLabel: 'Start Payroll',
      run: doRun,
    })
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

  async function doBulk(status, targets) {
    try {
      await bulkSetRecordStatus(formId, targets, status)
      const verb = status === 'paid' ? 'marked paid' : 'moved back to pending'
      showToast(`${targets.length} employee${targets.length > 1 ? 's' : ''} ${verb}.`, 'success')
      load()
    } catch (err) {
      showToast(friendlyError(err, "Couldn't update those records."), 'error')
    }
  }

  // status: 'paid' (pending -> paid) or 'draft' (paid -> pending).
  function bulk(status) {
    const want = status === 'paid' ? (r => r.status !== 'paid' && r.status !== 'cancelled') : (r => r.status === 'paid')
    const eligible = records.filter(r => selected.includes(r.id) && want(r))
    const skipped = selected.length - eligible.length
    if (!eligible.length) {
      showToast(status === 'paid' ? 'Every selected employee is already paid.' : 'None of the selected employees are paid.', 'info')
      return
    }
    const label = status === 'paid' ? 'Mark paid' : 'Mark pending'
    ask({
      title: `${label} — ${eligible.length} employee${eligible.length > 1 ? 's' : ''}?`,
      message: status === 'paid'
        ? `They'll be recorded as paid for ${monthLabel(month)}.${skipped ? ` ${skipped} already-paid selection${skipped > 1 ? 's' : ''} skipped.` : ''}`
        : `Their ${monthLabel(month)} payment is reversed and the records unlock for edits.${skipped ? ` ${skipped} not-yet-paid selection${skipped > 1 ? 's' : ''} skipped.` : ''}`,
      confirmLabel: label,
      run: () => doBulk(status, eligible),
    })
  }

  // Two payment states only: Paid, or Pending (everything not paid/cancelled).
  const payable = records.filter(r => r.status !== 'paid' && r.status !== 'cancelled')

  async function doPayAll() {
    setConfirmPayAll(false)
    try {
      await bulkSetRecordStatus(formId, payable, 'paid')
      await createPaymentBatch(formId, month, payable)
      showToast(`${payable.length} employee${payable.length > 1 ? 's' : ''} marked paid. Payment batch recorded.`, 'success')
      load()
    } catch (err) {
      showToast(friendlyError(err, "Couldn't mark everyone paid. Some may have gone through — reload to check."), 'error')
    }
  }

  async function doRecalc() {
    try {
      await runPayroll(formId, month, form)
      showToast(`${monthLabel(month)} payroll recalculated from current salaries and events.`, 'success')
      load({ quiet: true })
    } catch (err) {
      showToast(friendlyError(err, "Couldn't recalculate this month's payroll."), 'error')
    }
  }

  async function doReset() {
    try {
      await resetPayrollMonth(formId, month)
      showToast(`${monthLabel(month)} payroll reset. Staff, salaries and events are unchanged.`, 'success')
      setReviewIdx(null); setReviewQueue([]); setSelected([])
      load()
    } catch (err) {
      showToast(friendlyError(err, "Couldn't reset this month's payroll."), 'error')
    }
  }

  const OPTIONS = [
    { label: 'Export payroll', onClick: () => setExportOpen(true), disabled: !hasRun },
    { label: 'Download payslips', onClick: () => showToast('Payslip downloads are coming soon.', 'info'), disabled: !hasRun },
    { label: 'Print payroll', onClick: () => { if (hasRun) window.print() }, disabled: !hasRun },
    { divider: true },
    {
      label: 'Recalculate payroll', disabled: !hasRun,
      onClick: () => ask({
        title: `Recalculate ${monthLabel(month)} payroll?`,
        message: `Every unpaid record is updated to match the current staff salaries and payroll events. Paid records are left as they are.`,
        confirmLabel: 'Recalculate', run: doRecalc,
      }),
    },
    { divider: true },
    {
      label: 'Reset payroll', danger: true, disabled: !hasRun,
      onClick: () => ask({
        title: `Reset ${monthLabel(month)} payroll?`,
        message: `This clears the generated payroll and payment records for ${monthLabel(month)} so it can be started fresh. Staff, salaries and payroll events are NOT affected.`,
        confirmLabel: 'Reset payroll', danger: true, run: doReset,
      }),
    },
  ]

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const totalFinal = records.reduce((s, r) => s + Number(r.final_amount || 0), 0)

  // Guided-review current employee
  const reviewEmpId = reviewIdx != null ? reviewQueue[reviewIdx] : null
  const reviewEmp = reviewEmpId ? empById[reviewEmpId] : null
  const reviewRecord = reviewEmpId ? records.find(r => r.employee_id === reviewEmpId) : null

  // Pending = not yet paid, for the selected month/location view.
  const pendingCount = payable.length
  const remainingAmount = Math.max(0, kpi.net - kpi.paidAmount)

  return (
    <div>
      <style>{`
        .pay-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.4rem; }
        .pay-toolbar-left, .pay-toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        /* Compact KPI strip: ~15% shorter than before, tighter label. */
        .pay-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.7rem; margin-bottom: 1.4rem; }
        .pay-kpi { border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); padding: 0.6rem 0.8rem; }
        .pay-kpi .l { font-size: 0.66rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-muted); font-weight: 700; }
        .pay-kpi .v { font-size: 1.2rem; font-weight: 800; font-variant-numeric: tabular-nums; margin-top: 0.1rem; color: var(--color-text); }
        /* Net Payroll: subtle THEME tint (not semantic green) so it reads as
           the headline figure, not an "addition". Amount stays dark. */
        .pay-kpi.net { border-color: var(--color-primary); background: var(--color-primary-soft); }
        .pay-kpi.net .v { font-size: 1.35rem; }
        /* Table: grows with the page (no nested vertical scroll on desktop),
           tinted sticky header, faint theme-tint hover. */
        .pay-table-scroll { max-height: none; }
        .pay-table thead th { position: sticky; top: 0; background: var(--color-bg); z-index: 1; }
        .pay-table tbody tr:hover { background: var(--color-primary-soft); }
        @media (max-width: 760px) {
          .pay-kpis { grid-template-columns: 1fr 1fr; }
          .pay-kpi.k-total { order: 1 } .pay-kpi.net { order: 2 }
          .pay-kpi.k-ded { order: 3 } .pay-kpi.k-add { order: 4 }
          .pay-kpi .v { font-size: 1.1rem }
          .pay-kpi.net .v { font-size: 1.2rem }
        }
      `}</style>

      {/* toolbar - left = filters, right = actions (§5). Review payroll is
          the primary (theme) action once payroll exists; before that it's
          Start Payroll. No status badge (§4). */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.2rem' }}>
          <MonthPicker value={month} onChange={setMonth} style={{ width: '100%' }} />
          <LocationFilter locations={locations} value={location} onChange={setLocation} style={{ width: '100%' }} />
          {!hasRun ? (
            <>
              <button onClick={handleRun} disabled={running} style={{ width: '100%', minHeight: 48, fontSize: '0.95rem' }}>{running ? 'Starting…' : 'Start Payroll'}</button>
              <OptionsMenu open={menuOpen} setOpen={setMenuOpen} items={OPTIONS} fullWidth />
            </>
          ) : (
            <>
              <button onClick={() => startReview()} style={{ width: '100%', minHeight: 48, fontSize: '0.95rem' }}>Review payroll · {pendingCount}</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {pendingCount > 0 && <button className="secondary" style={{ flex: 1, minHeight: 44 }} onClick={askPayAll}>Mark all paid</button>}
                <div style={{ flex: 1 }}><OptionsMenu open={menuOpen} setOpen={setMenuOpen} items={OPTIONS} fullWidth /></div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="pay-toolbar">
          <div className="pay-toolbar-left">
            <MonthPicker value={month} onChange={setMonth} />
            <LocationFilter locations={locations} value={location} onChange={setLocation} />
          </div>
          <div className="pay-toolbar-right">
            {!hasRun ? (
              <button onClick={handleRun} disabled={running}>{running ? 'Starting…' : 'Start Payroll'}</button>
            ) : (
              <>
                <button onClick={() => startReview()}>Review payroll · {pendingCount}</button>
                {pendingCount > 0 && <button className="secondary" onClick={askPayAll}>Mark all paid</button>}
              </>
            )}
            <OptionsMenu open={menuOpen} setOpen={setMenuOpen} items={OPTIONS} />
          </div>
        </div>
      )}

      {/* 4 KPI cards */}
      <div className="pay-kpis">
        <Kpi cls="k-total" label="Total Payroll" value={kpi.total} short={isMobile} />
        <Kpi cls="k-ded" label="Deductions" value={kpi.deductions} short={isMobile} amountColor="var(--status-critical)" />
        <Kpi cls="k-add" label="Additions" value={kpi.additions} short={isMobile} amountColor="var(--status-good)" />
        <Kpi cls="net" label="Net Payroll" value={kpi.net} short={isMobile} />
      </div>

      {/* payment progress */}
      <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1.3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.4rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>Payment progress</strong>
          {isMobile
            ? <strong style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{progressPct}%</strong>
            : <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                {money(kpi.paidAmount)} paid · {money(remainingAmount)} remaining
                <span style={{ marginLeft: '0.8rem' }}>{kpi.paidCount} of {headcount} employees paid</span>
              </span>}
        </div>
        {isMobile && (
          <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: '0.15rem 0 0' }}>
            {kpi.paidCount} of {headcount} employees paid
          </div>
        )}
        <div style={{ height: 8, borderRadius: 999, background: 'var(--color-primary-soft)', overflow: 'hidden', margin: '0.55rem 0 0.35rem' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--color-primary)' }} />
        </div>
        {isMobile
          ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span>{money(kpi.paidAmount)} paid</span>
              <span style={{ color: 'var(--color-muted)' }}>{money(remainingAmount)} remaining</span>
            </div>
          : <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{progressPct}%</div>}
      </div>

      <div style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.7rem' }}>
        {monthLabel(month)} Payroll <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>· {headcount} employee{headcount === 1 ? '' : 's'}</span>
      </div>

      {!hasRun ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          Payroll has not been run for {monthLabel(month)}.<br />
          Add entries first, then press <strong>Start Payroll</strong> to generate each employee's record.
        </div>
      ) : (
        <>
          {selected.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.6rem 1rem', background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius)', marginBottom: '0.8rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem', marginRight: 'auto' }}>{selected.length} selected</span>
              <button onClick={() => bulk('paid')}>Mark paid</button>
              <OptionsMenu
                open={bulkMenuOpen}
                setOpen={setBulkMenuOpen}
                label="More ▾"
                items={[
                  { label: 'Mark pending', onClick: () => bulk('draft') },
                  { label: 'Export selected', onClick: () => { setExportSelectedOnly(true); setExportOpen(true) } },
                  { divider: true },
                  { label: 'Clear selection', onClick: () => setSelected([]) },
                ]}
              />
            </div>
          )}

          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {records.map(r => (
                <EmployeePayCard
                  key={r.id}
                  record={r}
                  name={empById[r.employee_id]?.full_name?.trim() || ''}
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
            <div className="table-wrap table-bleed pay-table-scroll">
              <table className="records-table pay-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.6rem 0.5rem', borderBottom: '2px solid var(--color-border)' }}>
                      <input type="checkbox" checked={selected.length === records.length && records.length > 0} onChange={toggleAll} />
                    </th>
                    {['Employee', 'Base', 'Adjustments', 'Net Pay', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Employee' || h === 'Status' ? 'left' : 'right', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.75rem', letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => {
                    const emp = empById[r.employee_id]
                    const add = Number(r.total_additions || 0)
                    const ded = Number(r.total_deductions || 0)
                    const name = emp?.full_name?.trim()
                    return (
                      <tr key={r.id} style={{ cursor: 'pointer', background: selected.includes(r.id) ? 'var(--color-primary-soft)' : undefined }} onClick={() => openAt(r.employee_id)}>
                        <td style={{ padding: '0.55rem 0.5rem', borderBottom: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                          {name
                            ? <span style={{ fontWeight: 600 }}>{name}</span>
                            : <span style={{ color: 'var(--status-serious)', fontWeight: 600 }}>⚠ Unnamed employee</span>}
                          {(emp?.department_id || emp?.primary_location_id) && (
                            <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                              {' · '}{[deptName[emp.department_id], locName[emp.primary_location_id]].filter(Boolean).join(' — ')}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{money(r.base_salary)}</td>
                        <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontSize: '0.85rem', lineHeight: 1.35 }}>
                          {add === 0 && ded === 0 && <span style={{ color: 'var(--color-muted)' }}>{money(0)}</span>}
                          {add > 0 && <div style={{ color: 'var(--status-good)' }}>+{money(add)}</div>}
                          {ded > 0 && <div style={{ color: 'var(--status-critical)' }}>−{money(ded)}</div>}
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
          title="Mark all employees as paid?"
          message={`${payable.length} employee${payable.length === 1 ? '' : 's'} will be marked as paid for ${monthLabel(month)}. Amount remaining: ${money(remainingAmount)}.`}
          confirmLabel="Mark all paid"
          onConfirm={doPayAll}
          onCancel={() => setConfirmPayAll(false)}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onConfirm={() => { const fn = confirmAction.run; setConfirmAction(null); fn?.() }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {exportOpen && (() => {
        const rows = exportSelectedOnly ? records.filter(r => selected.includes(r.id)) : records
        const closeExport = () => { setExportOpen(false); setExportSelectedOnly(false) }
        return (
          <PayrollModal
            title={`Export — ${monthLabel(month)}`}
            onClose={closeExport}
            footer={<button className="secondary" onClick={closeExport}>Close</button>}
          >
            <p style={{ marginTop: 0, color: 'var(--color-muted)', fontSize: '0.88rem' }}>
              {rows.length} {exportSelectedOnly ? 'selected ' : ''}employee record{rows.length === 1 ? '' : 's'}.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => { exportPayrollToExcel(rows, empById, month); closeExport() }}>Excel</button>
              <button onClick={() => { exportPayrollToCSV(rows, empById, month); closeExport() }}>CSV</button>
              <button onClick={() => { exportPayrollToPDF(rows, empById, month); closeExport() }}>PDF</button>
            </div>
          </PayrollModal>
        )
      })()}
    </div>
  )
}

function Kpi({ cls, label, value, short, amountColor }) {
  return (
    <div className={`pay-kpi ${cls}`} title={short ? money(value) : undefined}>
      <div className="l">{label}</div>
      <div className="v" style={{ color: amountColor }}>{short ? moneyShort(value) : money(value)}</div>
    </div>
  )
}

// Secondary payroll actions. `items`: { label, onClick, disabled?, danger? } | { divider: true }
function OptionsMenu({ open, setOpen, items, fullWidth, label = 'Options ▾' }) {
  return (
    <div style={{ position: 'relative', ...(fullWidth ? { width: '100%' } : {}) }}>
      <button className="secondary" onClick={() => setOpen(o => !o)} style={fullWidth ? { width: '100%', minHeight: 44 } : undefined}>
        {label}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 0.3rem)', zIndex: 41, minWidth: 210,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)', padding: '0.3rem', display: 'flex', flexDirection: 'column',
          }}>
            {items.map((it, i) => it.divider
              ? <div key={i} style={{ height: 1, background: 'var(--color-border)', margin: '0.3rem 0' }} />
              : (
                <button key={i} className="secondary" disabled={it.disabled}
                  onClick={() => { setOpen(false); it.onClick() }}
                  style={{ border: 'none', background: 'transparent', textAlign: 'left', justifyContent: 'flex-start',
                    padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: it.danger ? 'var(--status-critical)' : 'var(--color-text)' }}>
                  {it.label}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

// Mobile row -> compact payment card (doc: don't squeeze the 6-col table
// onto a phone).
function EmployeePayCard({ record: r, name, selected, onToggle, onOpen }) {
  const add = Number(r.total_additions || 0)
  const ded = Number(r.total_deductions || 0)
  return (
    <div className="card" style={{ padding: '0.9rem 1rem', background: selected ? 'var(--color-primary-soft)' : undefined, borderColor: selected ? 'var(--color-primary)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={(e) => e.stopPropagation()} />
        <span style={{ fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: name ? undefined : 'var(--status-serious)' }}>
          {name || '⚠ Unnamed employee'}
        </span>
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
        <span style={{ display: 'flex', gap: '0.6rem' }}>
          {add === 0 && ded === 0 && money(0)}
          {add > 0 && <span style={{ color: 'var(--status-good)' }}>+{money(add)}</span>}
          {ded > 0 && <span style={{ color: 'var(--status-critical)' }}>−{money(ded)}</span>}
        </span>
      </div>
      <button className="secondary" onClick={onOpen} style={{ width: '100%', marginTop: '0.7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>View payroll</span><span>›</span>
      </button>
    </div>
  )
}
