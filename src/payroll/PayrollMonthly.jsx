// The Payments page (index tab): the month's payroll at a glance (KPI
// strip), Run Payroll, the per-employee table + modal, and the bulk
// review / approve / mark-paid actions.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { ErrorState, InlineError } from '../ErrorState'
import { SkeletonKpis, SkeletonTableRows, Skeleton } from '../components/Skeleton'
import { RefreshingIndicator, InlineLoader } from '../components/InlineLoader'
import EmptyState from '../components/EmptyState'
import { useDeferredLoading } from '../components/loadingHooks'
import ConfirmDialog from '../ConfirmDialog'
import useIsMobile from '../hooks/useIsMobile'
import { MonthPicker, LocationFilter, PayrollModal, money, moneyShort, monthLabel, currentMonth, RecordStatusBadge, friendlyError, locationIds, deptIds, namesFor, dedupeByName } from './ui'
import { calculateEmployeePayroll } from './calculatePayroll'
import {
  payrollSettings, listEmployees, listDepartments, listLocations, listEntries, loadRecordsForMonth,
  runPayroll, bulkSetRecordStatus, createPaymentBatch, resetPayrollMonth, listPayrollHistory,
} from './payrollApi'
import { exportPayrollToCSV, exportPayrollToExcel, exportPayrollToPDF } from './payrollExport'
import EmployeePayrollModal from './EmployeePayrollModal'
import PayrollSettingsModal from './PayrollSettingsModal'
import { DataCard } from '../components/DataCards'
import SearchIcon from '../SearchIcon'
import { getPageCache, setPageCache } from '../hooks/pageCache'

const norm = (s) => String(s || '').trim().toLowerCase()

export default function PayrollMonthly() {
  const { form, formId, reloadForm } = usePayroll()
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
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState([])
  const [confirmPayAll, setConfirmPayAll] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
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

  // quiet = background refresh after a mutation: keep the current UI on
  // screen, just flag "Updating…" (brief §3C) instead of dropping to a
  // skeleton.
  // Revisiting a month you've already loaded this session paints from the
  // cached data instantly and refreshes silently behind it, instead of
  // reshowing the skeleton every time (see src/hooks/pageCache.js).
  const cacheKey = `payroll-monthly:${formId}:${month}`

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setRefreshing(true)
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
      setPageCache(cacheKey, { employees: emps, departments: depts, locations: locs, entries: ents, allRecords: recs })
    } catch (err) {
      setError(err.message || 'Could not load payroll.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const cached = getPageCache(cacheKey)
    if (cached) {
      setEmployees(cached.employees)
      setDepartments(cached.departments)
      setLocations(cached.locations)
      setEntries(cached.entries)
      setRecords(cached.allRecords)
      setLoading(false)
      load({ quiet: true })
    } else {
      load()
    }
  }, [formId, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const empById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])
  const deptName = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.name])), [departments])
  const locName = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l.name])), [locations])
  // The location <select> lists each name once; match employees by location
  // NAME so a same-named duplicate location still counts (departments/
  // locations have no unique-name constraint - see ui.jsx's dedupeByName).
  const locOptions = useMemo(() => dedupeByName(locations), [locations])
  const selLocName = location ? norm(locName[location]) : ''
  const atLoc = useCallback(
    (emp) => !selLocName || locationIds(emp).some(id => norm(locName[id]) === selLocName),
    [selLocName, locName],
  )

  // Run Payroll always covers every active employee; the location filter is a
  // view over the produced records.
  const records = useMemo(
    () => selLocName ? allRecords.filter(r => atLoc(empById[r.employee_id])) : allRecords,
    [allRecords, selLocName, atLoc, empById]
  )
  const hasRun = allRecords.length > 0

  // Free-text find over the produced records, by employee name. A view over
  // `records` only - selection / Run / totals still work off the full set.
  const visibleRecords = useMemo(() => {
    const q = empSearch.trim().toLowerCase()
    if (!q) return records
    return records.filter(r => (empById[r.employee_id]?.full_name || '').toLowerCase().includes(q))
  }, [records, empSearch, empById])

  // Live projection for the KPI cards - covers the selected location and
  // stays useful before Run Payroll has produced any records.
  const kpi = useMemo(() => {
    const active = employees.filter(e => e.employment_status !== 'terminated' && atLoc(e))
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
  }, [employees, entries, records, month, settings, atLoc])

  const headcount = hasRun ? records.length : kpi.staff

  async function doRun() {
    setRunning(true)
    try {
      const recs = await runPayroll(formId, month, form)
      setRecords(recs)
      setSelected([])
      showToast(`Payroll started for ${recs.length} employees. Review each one below.`, 'success')
      // Sort the review queue so the location filter (if any) leads.
      const ordered = recs
        .filter(r => atLoc(empById[r.employee_id]))
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
      title: `${label} - ${eligible.length} employee${eligible.length > 1 ? 's' : ''}?`,
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
      showToast(friendlyError(err, "Couldn't mark everyone paid. Some may have gone through - reload to check."), 'error')
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
    { label: 'Payroll settings', onClick: () => setSettingsOpen(true) },
    { divider: true },
    { label: 'Export payroll', onClick: () => setExportOpen(true), disabled: !hasRun },
    { label: 'Download payslips', onClick: () => showToast('Payslip downloads are coming soon.', 'info'), disabled: !hasRun },
    { label: 'Print payroll', onClick: () => { if (hasRun) window.print() }, disabled: !hasRun },
    { label: 'Payroll history', onClick: () => setHistoryOpen(true) },
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

  const showSkeleton = useDeferredLoading(loading)
  if (loading) return showSkeleton ? <PaymentsSkeleton isMobile={isMobile} /> : null
  if (error) return <ErrorState message={error} onRetry={load} />

  const totalFinal = visibleRecords.reduce((s, r) => s + Number(r.final_amount || 0), 0)

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
      `}</style>

      {/* Mobile: a completely different, action-focused reading of this page
          (design brief - "how much / for how many / how complete / what do I
          do / who's being paid", everything else moved into Options).
          Desktop keeps the fuller dashboard (toolbar, 4 KPI cards, the
          bordered progress card, unchanged below) - only the <640px layout
          here. */}
      {isMobile ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <MonthPicker value={month} onChange={setMonth} style={{ flex: 1, minWidth: 0 }} />
            <button
              type="button" className="secondary" onClick={() => setMenuOpen(true)}
              aria-label="Payroll details and more options"
              style={{ flexShrink: 0, minHeight: 40, minWidth: 40, padding: '0 0.7rem', fontSize: '1rem', letterSpacing: '0.12em' }}
            >
              •••
            </button>
          </div>
          {locOptions.length > 0 && (
            <LocationFilter
              locations={locOptions} value={location} onChange={setLocation}
              style={{
                width: '100%', marginBottom: '1.6rem',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)',
                color: 'var(--color-text)', fontSize: '0.88rem', fontWeight: 600, padding: '0.5rem 0.7rem',
              }}
            />
          )}

          {/* 1. How much? / 2. For how many? - in its own tile, tinted with
              the theme color (same role as desktop's .pay-kpi.net) so it
              reads as the headline figure rather than a plain white card. */}
          <div className="card" style={{
            padding: '1rem 1.1rem', marginBottom: '1.6rem',
            borderColor: 'var(--color-primary)', background: 'var(--color-primary-soft)',
          }}>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
              {money(kpi.net)}
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.92rem', marginTop: '0.15rem' }}>
              Net Payroll · {headcount} employee{headcount === 1 ? '' : 's'}
            </div>
          </div>

          {/* 4. What should I do? - one strong CTA; once payroll exists this
              becomes the next real action instead of sticking around
              alongside it. */}
          <div style={{ marginBottom: '2rem' }}>
            {!hasRun ? (
              <button onClick={handleRun} disabled={running} style={{ width: '100%', minHeight: 50, fontSize: '1rem' }}>
                {running ? 'Starting…' : 'Start Payroll'}
              </button>
            ) : pendingCount > 0 ? (
              <button onClick={() => startReview()} style={{ width: '100%', minHeight: 50, fontSize: '1rem' }}>
                Review payroll · {pendingCount}
              </button>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.9rem', padding: '0.4rem 0' }}>
                ✓ All employees paid
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="pay-toolbar">
          <div className="pay-toolbar-left">
            <MonthPicker value={month} onChange={setMonth} />
            <LocationFilter locations={locOptions} value={location} onChange={setLocation} />
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

      {/* 4 KPI cards - desktop only; mobile leads with the hero Net Payroll
          figure above instead. The old "Payment progress" card is gone on
          both - the paid/remaining split lives in the Options sheet (mobile)
          and the Status column of the table itself carries the rest. */}
      {!isMobile && (
        <div className="pay-kpis">
          <Kpi cls="k-total" label="Total Payroll" value={kpi.total} />
          <Kpi cls="k-ded" label="Deductions" value={kpi.deductions} amountColor="var(--status-critical)" />
          <Kpi cls="k-add" label="Additions" value={kpi.additions} amountColor="var(--status-good)" />
          <Kpi cls="net" label="Net Payroll" value={kpi.net} />
        </div>
      )}

      {/* Mobile + payroll not started yet: the CTA button above already
          covers it - an "Employees" heading with nothing under it but an
          empty-state sentence is redundant, so skip the whole section. */}
      {!(isMobile && !hasRun) && (
        <>
          <div style={{ fontSize: isMobile ? '1.05rem' : '0.92rem', fontWeight: 700, marginBottom: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Mobile: just "Employees" - the month and headcount are already
                established above, no need to repeat them. */}
            {isMobile
              ? <span>Employees</span>
              : <span>{monthLabel(month)} Payroll <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>· {headcount} employee{headcount === 1 ? '' : 's'}</span></span>}
            <RefreshingIndicator show={refreshing} />
            {/* Desktop has room for the full search field inline; mobile keeps
                it collapsed behind an icon so the heading row stays short. */}
            {hasRun && records.length > 4 && !isMobile && (
              <input
                type="text"
                placeholder="Search employees by name…"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                style={{ marginLeft: 'auto', width: '280px', maxWidth: '100%' }}
              />
            )}
            {hasRun && records.length > 4 && isMobile && (
              <button
                type="button"
                className="secondary"
                onClick={() => setSearchOpen(o => { if (o) setEmpSearch(''); return !o })}
                aria-label={searchOpen ? 'Close employee search' : 'Search employees'}
                aria-pressed={searchOpen}
                style={{
                  marginLeft: 'auto', padding: '0.35rem 0.5rem', lineHeight: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: searchOpen ? 'var(--color-primary-soft)' : undefined,
                  borderColor: searchOpen ? 'var(--color-primary)' : undefined,
                  color: searchOpen ? 'var(--color-primary)' : undefined,
                }}
              >
                <SearchIcon size={16} />
              </button>
            )}
          </div>
          {hasRun && searchOpen && isMobile && (
            <input
              autoFocus
              type="text"
              placeholder="Search employees by name…"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.9rem' }}
            />
          )}
        </>
      )}

      {!hasRun ? (
        isMobile ? null : (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            Payroll has not been run for {monthLabel(month)}.<br />
            Add entries first, then press <strong>Start Payroll</strong> to generate each employee's record.
          </div>
        )
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
              {visibleRecords.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', padding: '0.6rem 0.2rem' }}>No employees match “{empSearch}”.</p>
              ) : visibleRecords.map(r => (
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
                <span style={{ color: 'var(--color-muted)' }}>Total payable{empSearch.trim() ? ' (matches)' : ''}</span>
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
                  {visibleRecords.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '1.2rem 0.7rem', color: 'var(--color-muted)' }}>No employees match “{empSearch}”.</td></tr>
                  )}
                  {visibleRecords.map(r => {
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
                          {(() => {
                            const meta = [namesFor(deptIds(emp), deptName), namesFor(locationIds(emp), locName)].filter(Boolean).join(' - ')
                            return meta && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>{' · '}{meta}</span>
                          })()}
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
                    <td colSpan={4} style={{ padding: '0.6rem 0.7rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-muted)' }}>Total payable{empSearch.trim() ? ' (matches)' : ''}</td>
                    <td style={{ padding: '0.6rem 0.7rem', textAlign: 'right', fontWeight: 800 }}>{money(totalFinal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Mobile "•••": everything the 4 KPI cards + bordered progress card
          used to show permanently, plus the same secondary actions the
          desktop OptionsMenu offers, in one bottom sheet instead of
          occupying screen space all the time (design brief §3). */}
      {isMobile && menuOpen && (
        <MobileOptionsSheet
          onClose={() => setMenuOpen(false)}
          kpi={kpi}
          remainingAmount={remainingAmount}
          items={OPTIONS}
        />
      )}

      {/* Payroll settings / history - reachable from both the mobile sheet
          and the desktop OptionsMenu above (same OPTIONS array either way). */}
      {settingsOpen && (
        <PayrollSettingsModal
          form={form}
          formId={formId}
          reloadForm={reloadForm}
          onClose={() => { setSettingsOpen(false); load({ quiet: true }) }}
        />
      )}
      {historyOpen && (
        <PayrollHistoryModal
          formId={formId}
          currentMonth={month}
          onSelectMonth={(m) => { setMonth(m); setHistoryOpen(false); setMenuOpen(false) }}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* the navigable per-employee modal - opened by Start Payroll, the
          Review button, or clicking any row / card */}
      {reviewIdx != null && reviewEmp && reviewRecord && (
        <EmployeePayrollModal
          key={reviewEmpId}
          formId={formId}
          form={form}
          month={month}
          employee={{ ...reviewEmp, department_name: namesFor(deptIds(reviewEmp), deptName), location_name: namesFor(locationIds(reviewEmp), locName) }}
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
            title={`Export - ${monthLabel(month)}`}
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
function OptionsMenu({ open, setOpen, items, fullWidth, minHeight, label = 'Options ▾' }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0, ...(fullWidth ? { width: '100%' } : {}) }}>
      <button
        className="secondary"
        onClick={() => setOpen(o => !o)}
        aria-label={label === '⋯' ? 'More options' : undefined}
        style={{
          ...(fullWidth ? { width: '100%' } : {}),
          ...(minHeight ? { minHeight, padding: '0 0.9rem' } : {}),
        }}
      >
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

// Mobile's "•••": the numbers the 4 KPI cards + bordered progress card show
// on desktop (Total/Deductions/Additions/Paid/Remaining), plus the same
// secondary actions as the desktop OptionsMenu (`items`) - one bottom sheet
// instead of permanent screen space (design brief §3). Reuses PayrollModal,
// which is already a sheet on a phone (see src/components/Modal.jsx).
function MobileOptionsSheet({ onClose, kpi, remainingAmount, items }) {
  const row = { display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', padding: '0.35rem 0' }
  return (
    <PayrollModal title="Payroll Details" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={row}><span style={{ color: 'var(--color-muted)' }}>Total Payroll</span><span style={{ fontWeight: 700 }}>{money(kpi.total)}</span></div>
        <div style={row}><span style={{ color: 'var(--color-muted)' }}>Deductions</span><span style={{ fontWeight: 700, color: 'var(--status-critical)' }}>{money(kpi.deductions)}</span></div>
        <div style={row}><span style={{ color: 'var(--color-muted)' }}>Additions</span><span style={{ fontWeight: 700, color: 'var(--status-good)' }}>{money(kpi.additions)}</span></div>
        <div style={{ height: 1, background: 'var(--color-border)', margin: '0.5rem 0' }} />
        <div style={row}><span style={{ color: 'var(--color-muted)' }}>Paid</span><span style={{ fontWeight: 700 }}>{money(kpi.paidAmount)}</span></div>
        <div style={row}><span style={{ color: 'var(--color-muted)' }}>Remaining</span><span style={{ fontWeight: 700 }}>{money(remainingAmount)}</span></div>
      </div>

      <div style={{ height: 1, background: 'var(--color-border)', margin: '0.9rem 0 0.4rem' }} />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => it.divider
          ? <div key={i} style={{ height: 1, background: 'var(--color-border)', margin: '0.4rem 0' }} />
          : (
            <button
              key={i} className="secondary" disabled={it.disabled}
              onClick={() => { onClose(); it.onClick() }}
              style={{
                border: 'none', background: 'transparent', textAlign: 'left', justifyContent: 'flex-start',
                padding: '0.7rem 0.2rem', fontSize: '0.95rem', minHeight: 44,
                color: it.danger ? 'var(--status-critical)' : 'var(--color-text)',
              }}
            >
              {it.label}
            </button>
          ))}
      </div>
    </PayrollModal>
  )
}

// Every past month that's ever had payroll run, newest first - reached from
// Options ("Payroll history") on both mobile and desktop. There's no
// separate history view/report here: tapping a month just re-points this
// same page at it (setMonth), reusing everything else on the page (KPIs,
// progress, the table/cards, Options) rather than building a second,
// read-only version of the same information.
function PayrollHistoryModal({ formId, currentMonth, onSelectMonth, onClose }) {
  const [rows, setRows] = useState(null) // null = loading
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listPayrollHistory(formId)
      .then(data => { if (!cancelled) setRows(data) })
      .catch(err => { if (!cancelled) setError(friendlyError(err, 'Could not load payroll history.')) })
    return () => { cancelled = true }
  }, [formId])

  return (
    <PayrollModal title="Payroll History" onClose={onClose}>
      {error ? (
        <InlineError message={error} style={{ fontSize: '0.88rem' }} />
      ) : rows === null ? (
        <InlineLoader />
      ) : rows.length === 0 ? (
        <EmptyState title="No payroll history" message="No payroll has been run yet." style={{ padding: '1.5rem 1rem' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {rows.map(r => {
            const fullyPaid = r.headcount > 0 && r.paidCount === r.headcount
            const isCurrent = r.month === currentMonth
            return (
              <button
                key={r.month}
                type="button"
                className="secondary"
                onClick={() => onSelectMonth(r.month)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem',
                  textAlign: 'left', padding: '0.65rem 0.8rem', minHeight: 48,
                  border: `1px solid ${isCurrent ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isCurrent ? 'var(--color-primary-soft)' : 'transparent',
                }}
              >
                <span>
                  <div style={{ fontWeight: 600 }}>{monthLabel(r.month)}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                    {r.headcount} employee{r.headcount === 1 ? '' : 's'}
                  </div>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{money(r.total)}</div>
                  <div style={{ fontSize: '0.78rem', color: fullyPaid ? 'var(--status-good)' : 'var(--color-muted)' }}>
                    {fullyPaid ? 'Fully paid' : `${r.paidCount} of ${r.headcount} paid`}
                  </div>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </PayrollModal>
  )
}

// Mobile row -> compact payment card (doc: don't squeeze the 6-col table
// onto a phone). Uses the shared DataCard primitive; tap the card to open the
// per-employee payroll modal.
function EmployeePayCard({ record: r, name, selected, onToggle, onOpen }) {
  const add = Number(r.total_additions || 0)
  const ded = Number(r.total_deductions || 0)
  return (
    <DataCard
      title={name
        ? name
        : <span style={{ color: 'var(--status-serious)' }}>⚠ Unnamed employee</span>}
      status={<RecordStatusBadge status={r.status} />}
      selected={selected}
      onToggle={onToggle}
      onOpen={onOpen}
    >
      <DataCard.Row label="Net Pay" value={money(r.final_amount)} strong />
      <DataCard.Row label="Base" value={money(r.base_salary)} muted />
      <DataCard.Row
        label="Adjustments"
        muted
        value={
          add === 0 && ded === 0 ? money(0) : (
            <span style={{ display: 'inline-flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              {add > 0 && <span style={{ color: 'var(--status-good)' }}>+{money(add)}</span>}
              {ded > 0 && <span style={{ color: 'var(--status-critical)' }}>−{money(ded)}</span>}
            </span>
          )
        }
      />
    </DataCard>
  )
}

// Initial-load placeholder: same shapes as the real page (filter row, 4
// KPI cards, progress card, table) so nothing jumps when data arrives.
function PaymentsSkeleton({ isMobile }) {
  return (
    <div aria-hidden="true">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.4rem' }}>
        <Skeleton w={isMobile ? '100%' : '160px'} h="38px" />
        <Skeleton w={isMobile ? '100%' : '150px'} h="38px" />
        <Skeleton w={isMobile ? '100%' : '130px'} h="38px" style={{ marginLeft: isMobile ? 0 : 'auto' }} />
      </div>
      <SkeletonKpis count={4} />
      <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1.3rem' }}>
        <Skeleton w="35%" h="0.9rem" style={{ marginBottom: '0.7rem' }} />
        <Skeleton w="100%" h="8px" radius="999px" />
      </div>
      <Skeleton w="40%" h="0.9rem" style={{ marginBottom: '0.8rem' }} />
      <div className="table-wrap table-bleed pay-table-scroll">
        <table className="records-table pay-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Employee', 'Base', 'Adjustments', 'Net Pay', 'Status'].map(h => (
              <th key={h} style={{ padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          <SkeletonTableRows rows={7} cols={['45%', '60%', '55%', '60%', '58px']} />
        </table>
      </div>
    </div>
  )
}
