// Employee list (doc section 4): search, filter by department / location /
// status, guided Excel import, row -> profile.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePayroll } from './PayrollShell'
import { ErrorState } from '../ErrorState'
import EmptyState from '../components/EmptyState'
import { SkeletonTableRows } from '../components/Skeleton'
import { RefreshingIndicator } from '../components/InlineLoader'
import { useDeferredLoading } from '../components/loadingHooks'
import { money, EmployeeStatusBadge, LocationFilter, roleList, deptIds, locationIds, namesFor, dedupeByName } from './ui'
import { payrollSettings, listEmployees, listDepartments, listLocations } from './payrollApi'
import EmployeeFormModal from './EmployeeFormModal'
import ImportModal from './ImportModal'
import PayrollSettingsModal from './PayrollSettingsModal'

const norm = (s) => String(s || '').trim().toLowerCase()

export default function PayrollEmployees() {
  const { form, formId, reloadForm } = usePayroll()
  const navigate = useNavigate()
  const settings = useMemo(() => payrollSettings(form), [form])

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [locFilter, setLocFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setRefreshing(true)
    setError('')
    try {
      const [emps, depts, locs] = await Promise.all([
        listEmployees(formId), listDepartments(formId), listLocations(formId),
      ])
      setEmployees(emps)
      setDepartments(depts)
      setLocations(locs)
    } catch (err) {
      setError(err.message || 'Could not load employees.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [formId]) // eslint-disable-line react-hooks/exhaustive-deps

  const deptName = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.name])), [departments])
  const locName = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l.name])), [locations])
  // Dropdowns show each name once; filtering then matches by name so an
  // employee tagged with any same-named duplicate still shows up.
  const deptOptions = useMemo(() => dedupeByName(departments), [departments])
  const locOptions = useMemo(() => dedupeByName(locations), [locations])
  // Every role string already in use, for the Add/Edit form's autocomplete.
  const roleSuggestions = useMemo(
    () => Array.from(new Set(employees.flatMap(roleList))).sort((a, b) => a.localeCompare(b)),
    [employees],
  )

  const filtered = useMemo(() => {
    const deptFilterName = deptFilter ? norm(deptName[deptFilter]) : ''
    const locFilterName = locFilter ? norm(locName[locFilter]) : ''
    return employees.filter(e => {
      const roles = roleList(e).join(' ').toLowerCase()
      if (search && !e.full_name.toLowerCase().includes(search.toLowerCase()) && !roles.includes(search.toLowerCase())) return false
      if (deptFilterName && !deptIds(e).some(id => norm(deptName[id]) === deptFilterName)) return false
      if (locFilterName && !locationIds(e).some(id => norm(locName[id]) === locFilterName)) return false
      if (statusFilter && e.employment_status !== statusFilter) return false
      return true
    })
  }, [employees, search, deptFilter, locFilter, statusFilter, deptName, locName])

  const showSkeleton = useDeferredLoading(loading)
  if (loading && !showSkeleton) return null
  if (error) return <ErrorState message={error} onRetry={load} />

  const noneAtAll = !loading && employees.length === 0
  const noneMatch = !loading && employees.length > 0 && filtered.length === 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: '170px' }} />
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {deptOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <LocationFilter locations={locOptions} value={locFilter} onChange={setLocFilter} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['active', 'on_leave', 'suspended', 'inactive', 'terminated'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <RefreshingIndicator show={refreshing && !loading} style={{ marginRight: '0.2rem' }} />
          <button className="secondary" onClick={() => setSettingsOpen(true)} title="Payroll settings, departments &amp; locations">⚙ Settings</button>
          <button className="secondary" onClick={() => setImportOpen(true)}>Import</button>
          <button onClick={() => setAddOpen(true)}>+ Add Employee</button>
        </div>
      </div>

      {noneAtAll ? (
        <EmptyState
          title="No employees yet"
          message="Add your staff here, or import them from a spreadsheet, to start running payroll."
          action={<button onClick={() => setAddOpen(true)}>+ Add Employee</button>}
        />
      ) : noneMatch ? (
        <EmptyState title="No matches" message="No employees match the current search or filters." />
      ) : (
      <div className="table-wrap table-bleed">
        <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Employee', 'Role', 'Department', 'Location', 'Monthly Salary', 'Status'].map(h => (
              <th key={h} style={{ textAlign: h === 'Monthly Salary' ? 'right' : 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          {loading ? (
            <SkeletonTableRows rows={8} cols={['40%', '55%', '50%', '48%', '35%', '58px']} />
          ) : (
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} onClick={() => navigate(e.id)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                  {e.full_name}
                  {e.employee_number && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}> · {e.employee_number}</span>}
                </td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{roleList(e).join(', ') || '—'}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{namesFor(deptIds(e), deptName) || '—'}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{namesFor(locationIds(e), locName) || '—'}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{money(e.monthly_salary)}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}><EmployeeStatusBadge status={e.employment_status} /></td>
              </tr>
            ))}
          </tbody>
          )}
        </table>
      </div>
      )}

      {addOpen && (
        <EmployeeFormModal
          formId={formId}
          settings={settings}
          departments={departments}
          locations={locations}
          roleSuggestions={roleSuggestions}
          onClose={() => setAddOpen(false)}
          onSaved={() => load({ quiet: true })}
        />
      )}
      {importOpen && (
        <ImportModal
          mode="employees"
          formId={formId}
          settings={settings}
          departments={departments}
          locations={locations}
          onClose={() => setImportOpen(false)}
          onSaved={() => load({ quiet: true })}
        />
      )}

      {settingsOpen && (
        <PayrollSettingsModal
          form={form}
          formId={formId}
          reloadForm={reloadForm}
          onClose={() => { setSettingsOpen(false); load({ quiet: true }) }}
        />
      )}
    </div>
  )
}
