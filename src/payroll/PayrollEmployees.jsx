// Employee list (doc section 4): search, filter by department / location /
// status, guided Excel import, row -> profile.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePayroll } from './PayrollShell'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import { money, EmployeeStatusBadge, LocationFilter } from './ui'
import { payrollSettings, listEmployees, listDepartments, listLocations } from './payrollApi'
import EmployeeFormModal from './EmployeeFormModal'
import ImportModal from './ImportModal'

export default function PayrollEmployees() {
  const { form, formId } = usePayroll()
  const navigate = useNavigate()
  const settings = useMemo(() => payrollSettings(form), [form])

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [locFilter, setLocFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  async function load() {
    setLoading(true)
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
    }
  }

  useEffect(() => { load() }, [formId]) // eslint-disable-line react-hooks/exhaustive-deps

  const deptName = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.name])), [departments])
  const locName = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l.name])), [locations])

  const filtered = useMemo(() => employees.filter(e => {
    if (search && !e.full_name.toLowerCase().includes(search.toLowerCase()) && !(e.job_title || '').toLowerCase().includes(search.toLowerCase())) return false
    if (deptFilter && e.department_id !== deptFilter) return false
    if (locFilter && e.primary_location_id !== locFilter) return false
    if (statusFilter && e.employment_status !== statusFilter) return false
    return true
  }), [employees, search, deptFilter, locFilter, statusFilter])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: '170px' }} />
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <LocationFilter locations={locations} value={locFilter} onChange={setLocFilter} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['active', 'on_leave', 'suspended', 'inactive', 'terminated'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={() => setImportOpen(true)}>Import</button>
          <button onClick={() => setAddOpen(true)}>+ Add Employee</button>
        </div>
      </div>

      <div className="table-wrap table-bleed">
        <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Employee', 'Role', 'Department', 'Location', 'Monthly Salary', 'Status'].map(h => (
              <th key={h} style={{ textAlign: h === 'Monthly Salary' ? 'right' : 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '1.4rem', color: 'var(--color-muted)' }}>No employees{employees.length ? ' match the filters' : ' yet'}.</td></tr>
            )}
            {filtered.map(e => (
              <tr key={e.id} onClick={() => navigate(e.id)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                  {e.full_name}
                  {e.employee_number && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}> · {e.employee_number}</span>}
                </td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{e.job_title || '—'}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{deptName[e.department_id] || '—'}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{locName[e.primary_location_id] || '—'}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{money(e.monthly_salary)}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}><EmployeeStatusBadge status={e.employment_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <EmployeeFormModal
          formId={formId}
          settings={settings}
          departments={departments}
          locations={locations}
          onClose={() => setAddOpen(false)}
          onSaved={load}
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
          onSaved={load}
        />
      )}
    </div>
  )
}
