// Entry Register (doc sections 19-20): every payroll event, filterable by
// month / location / employee / category / type, signed +/- amounts.
import { useEffect, useMemo, useState } from 'react'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import ConfirmDialog from '../ConfirmDialog'
import PageSkeleton from '../components/PageSkeleton'
import { useDeferredLoading } from '../components/loadingHooks'
import { ErrorState } from '../ErrorState'
import { money, monthLabel, currentMonth, LocationFilter, friendlyError, PayrollModal, Field, EmployeeSearchSelect } from './ui'
import { ENTRY_TYPE_LABELS, DEDUCTION_TYPES, ADDITION_TYPES } from './calculatePayroll'
import { payrollSettings, listEmployees, listLocations, listEntries, deleteEntry } from './payrollApi'
import AddEntryModal from './AddEntryModal'
import BulkEntryModal from './BulkEntryModal'
import ImportModal from './ImportModal'
import StatCards from './StatCards'
import useIsMobile from '../hooks/useIsMobile'
import { DataCard, DataCardList } from '../components/DataCards'
import { RefreshingIndicator } from '../components/InlineLoader'
import { getPageCache, setPageCache } from '../hooks/pageCache'

export default function PayrollEntries() {
  const { form, formId } = usePayroll()
  const { showToast } = useToast()
  const isMobile = useIsMobile()
  const settings = useMemo(() => payrollSettings(form), [form])

  const [employees, setEmployees] = useState([])
  const [locations, setLocations] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false) // mobile: Location/Employee/Category/Type + Import/Bulk
  const [pendingDelete, setPendingDelete] = useState(null) // entry row awaiting confirm

  const [fMonth, setFMonth] = useState(currentMonth())
  const [fLocation, setFLocation] = useState('')
  const [fEmployee, setFEmployee] = useState('')
  const [fType, setFType] = useState('')
  const [fCategory, setFCategory] = useState('')

  const cacheKey = `payroll-entries:${formId}:${fMonth}:${fEmployee}:${fType}:${fCategory}`

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setRefreshing(true)
    setError('')
    try {
      const [emps, locs, ents] = await Promise.all([
        listEmployees(formId),
        listLocations(formId),
        listEntries(formId, {
          month: fMonth || undefined,
          employeeId: fEmployee || undefined,
          entryType: fType || undefined,
          category: fCategory || undefined,
        }),
      ])
      setEmployees(emps)
      setLocations(locs)
      setEntries(ents)
      setPageCache(cacheKey, { employees: emps, locations: locs, entries: ents })
    } catch (err) {
      setError(err.message || 'Could not load entries.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const cached = getPageCache(cacheKey)
    if (cached) {
      setEmployees(cached.employees)
      setLocations(cached.locations)
      setEntries(cached.entries)
      setLoading(false)
      load({ quiet: true })
    } else {
      load()
    }
  }, [formId, fMonth, fEmployee, fType, fCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterCount = [fLocation, fEmployee, fCategory, fType].filter(Boolean).length

  const empById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])

  // Employee dropdown + the list handed to Add/Bulk narrow to the picked location.
  const scopedEmployees = useMemo(
    () => fLocation ? employees.filter(e => e.primary_location_id === fLocation) : employees,
    [employees, fLocation]
  )

  // If the selected employee is not at the newly-picked location, clear it.
  useEffect(() => {
    if (fEmployee && fLocation && empById[fEmployee]?.primary_location_id !== fLocation) setFEmployee('')
  }, [fLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleEntries = useMemo(
    () => fLocation ? entries.filter(e => empById[e.employee_id]?.primary_location_id === fLocation) : entries,
    [entries, fLocation, empById]
  )

  // Top entry types as a share of all events in view (max 4 cards).
  const typeBreakdown = useMemo(() => {
    const total = visibleEntries.length
    if (!total) return []
    const counts = {}
    for (const e of visibleEntries) counts[e.entry_type] = (counts[e.entry_type] || 0) + 1
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type, count]) => ({
        label: ENTRY_TYPE_LABELS[type] || type,
        value: `${Math.round((count / total) * 100)}%`,
        sub: `${count} of ${total}`,
        color: DEDUCTION_TYPES.includes(type) ? 'var(--status-critical)' : 'var(--status-good)',
      }))
  }, [visibleEntries])

  async function remove(id) {
    setPendingDelete(null)
    try {
      await deleteEntry(formId, id)
      showToast('Entry removed.', 'success')
      load()
    } catch (err) {
      showToast(friendlyError(err, "Couldn't remove that entry."), 'error')
    }
  }

  const showSkel = useDeferredLoading(loading)
  if (loading) return showSkel ? <PageSkeleton variant="table" /> : null
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      {typeBreakdown.length > 0 && <StatCards items={typeBreakdown} />}

      {isMobile ? (
        // Mobile: month + a single "Filters" button (badge shows how many are
        // active) holding Location/Employee/Category/Type + Import/Bulk Entry,
        // so the page opens on content instead of five stacked dropdowns.
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshingIndicator show={refreshing && !loading} />
            <input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
            <button
              type="button"
              className="secondary"
              onClick={() => setFiltersOpen(true)}
              aria-label="Filters and more actions"
              style={{ position: 'relative', minHeight: 40, padding: '0 0.9rem', flexShrink: 0 }}
            >
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6, background: 'var(--color-primary)', color: 'white',
                  borderRadius: '50%', minWidth: 18, height: 18, padding: '0 3px', fontSize: '0.68rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>{activeFilterCount}</span>
              )}
            </button>
          </div>
          <button onClick={() => setAddOpen(true)} style={{ width: '100%', marginTop: '0.6rem' }}>+ Add Entry</button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <RefreshingIndicator show={refreshing && !loading} />
            <input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} />
            <LocationFilter locations={locations} value={fLocation} onChange={setFLocation} />
            <EmployeeSearchSelect employees={scopedEmployees} value={fEmployee} onChange={setFEmployee} style={{ minWidth: '170px' }} />
            <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="deduction">Deductions</option>
              <option value="addition">Additions</option>
            </select>
            <select value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">All Types</option>
              <optgroup label="Deductions">{DEDUCTION_TYPES.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}</optgroup>
              <optgroup label="Additions">{ADDITION_TYPES.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}</optgroup>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={() => setImportOpen(true)}>Import</button>
            <button className="secondary" onClick={() => setBulkOpen(true)}>Bulk Entry</button>
            <button onClick={() => setAddOpen(true)}>+ Add Entry</button>
          </div>
        </div>
      )}

      {isMobile && filtersOpen && (
        <MobileFiltersSheet
          onClose={() => setFiltersOpen(false)}
          locations={locations}
          employees={scopedEmployees}
          fLocation={fLocation} setFLocation={setFLocation}
          fEmployee={fEmployee} setFEmployee={setFEmployee}
          fCategory={fCategory} setFCategory={setFCategory}
          fType={fType} setFType={setFType}
          onImport={() => setImportOpen(true)}
          onBulk={() => setBulkOpen(true)}
        />
      )}

      {isMobile ? (
        visibleEntries.length === 0 ? (
          <p style={{ padding: '1.4rem 0', color: 'var(--color-muted)' }}>No entries for this filter.</p>
        ) : (
          <DataCardList>
            {visibleEntries.map(e => {
              const deduction = e.entry_category === 'deduction'
              return (
                <DataCard
                  key={e.id}
                  title={e.employee?.full_name || empById[e.employee_id]?.full_name || '-'}
                  subtitle={`${new Date(e.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${monthLabel(e.payroll_month)}`}
                  footer={
                    <button className="secondary" onClick={() => setPendingDelete(e)} style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', color: '#c0392b' }}>
                      Delete
                    </button>
                  }
                >
                  <DataCard.Row
                    label="Amount"
                    strong
                    value={
                      <span style={{ color: deduction ? 'var(--status-critical)' : 'var(--status-good)' }}>
                        {deduction ? '-' : '+'}{money(e.amount)}
                      </span>
                    }
                  />
                  <DataCard.Row
                    label="Type"
                    align="left"
                    value={`${ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}${e.quantity != null ? ` × ${e.quantity}` : ''}`}
                  />
                  <DataCard.Row label="Reason" align="left" muted value={e.reason || '-'} />
                </DataCard>
              )
            })}
          </DataCardList>
        )
      ) : (
      <div className="table-wrap table-bleed">
        <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Date', 'Employee', 'Type', 'Reason', 'Amount', 'Payroll', ''].map(h => (
              <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {visibleEntries.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '1.4rem', color: 'var(--color-muted)' }}>No entries for this filter.</td></tr>
            )}
            {visibleEntries.map(e => {
              const deduction = e.entry_category === 'deduction'
              return (
                <tr key={e.id}>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    {new Date(e.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{e.employee?.full_name || empById[e.employee_id]?.full_name || '-'}</td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                    {ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}
                    {e.quantity != null && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}> × {e.quantity}</span>}
                  </td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{e.reason || '-'}</td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap', color: deduction ? 'var(--status-critical)' : 'var(--status-good)' }}>
                    {deduction ? '-' : '+'}{money(e.amount)}
                  </td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', color: 'var(--color-muted)', fontSize: '0.82rem' }}>{monthLabel(e.payroll_month)}</td>
                  <td style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                    <button className="secondary" onClick={() => setPendingDelete(e)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}>Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {addOpen && (
        <AddEntryModal formId={formId} settings={settings} employees={scopedEmployees} onClose={() => setAddOpen(false)} onSaved={load} />
      )}
      {bulkOpen && (
        <BulkEntryModal formId={formId} settings={settings} employees={scopedEmployees} onClose={() => setBulkOpen(false)} onSaved={load} />
      )}
      {importOpen && (
        <ImportModal mode="entries" formId={formId} settings={settings} employees={employees} onClose={() => setImportOpen(false)} onSaved={load} />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          message={`${ENTRY_TYPE_LABELS[pendingDelete.entry_type] || pendingDelete.entry_type}${pendingDelete.reason ? ` - ${pendingDelete.reason}` : ''} (${money(pendingDelete.amount)}) for ${empById[pendingDelete.employee_id]?.full_name || 'this employee'} will be removed. If payroll has already run for ${monthLabel(pendingDelete.payroll_month)}, re-run it to apply the change.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

// Mobile-only: everything that used to be five stacked dropdowns + two
// secondary buttons, collapsed into one sheet reached from "Filters". Each
// control still applies immediately (no separate Apply step) since changing
// any of them already re-triggers `load()` via the effect's deps.
function MobileFiltersSheet({
  onClose, locations, employees,
  fLocation, setFLocation, fEmployee, setFEmployee, fCategory, setFCategory, fType, setFType,
  onImport, onBulk,
}) {
  return (
    <PayrollModal title="Filter Entries" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {locations.length > 0 && (
          <Field label="Location">
            <LocationFilter locations={locations} value={fLocation} onChange={setFLocation} style={{ width: '100%' }} />
          </Field>
        )}
        <Field label="Employee">
          <EmployeeSearchSelect employees={employees} value={fEmployee} onChange={setFEmployee} style={{ width: '100%' }} />
        </Field>
        <Field label="Category">
          <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} style={{ width: '100%' }}>
            <option value="">All Categories</option>
            <option value="deduction">Deductions</option>
            <option value="addition">Additions</option>
          </select>
        </Field>
        <Field label="Type">
          <select value={fType} onChange={(e) => setFType(e.target.value)} style={{ width: '100%' }}>
            <option value="">All Types</option>
            <optgroup label="Deductions">{DEDUCTION_TYPES.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}</optgroup>
            <optgroup label="Additions">{ADDITION_TYPES.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}</optgroup>
          </select>
        </Field>
      </div>

      <div style={{ height: 1, background: 'var(--color-border)', margin: '0.9rem 0 1rem' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button type="button" className="secondary" onClick={() => { onClose(); onImport() }} style={{ width: '100%' }}>Import</button>
        <button type="button" className="secondary" onClick={() => { onClose(); onBulk() }} style={{ width: '100%' }}>Bulk Entry</button>
      </div>
    </PayrollModal>
  )
}
