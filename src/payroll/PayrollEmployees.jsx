// Employee list (doc section 4): search, filter, add, import, row -> profile.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePayroll } from './PayrollShell'
import { useToast } from '../Toast'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'
import { money, EmployeeStatusBadge } from './ui'
import { payrollSettings, listEmployees, listDepartments, importEmployees } from './payrollApi'
import { readWorkbookRows } from '../recordsImport'
import EmployeeFormModal from './EmployeeFormModal'

export default function PayrollEmployees() {
  const { form, formId } = usePayroll()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const settings = useMemo(() => payrollSettings(form), [form])
  const fileRef = useRef(null)

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [emps, depts] = await Promise.all([listEmployees(formId), listDepartments(formId)])
      setEmployees(emps)
      setDepartments(depts)
    } catch (err) {
      setError(err.message || 'Could not load employees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [formId]) // eslint-disable-line react-hooks/exhaustive-deps

  const deptName = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.name])), [departments])

  const filtered = useMemo(() => employees.filter(e => {
    if (search && !e.full_name.toLowerCase().includes(search.toLowerCase()) && !(e.job_title || '').toLowerCase().includes(search.toLowerCase())) return false
    if (deptFilter && e.department_id !== deptFilter) return false
    if (statusFilter && e.employment_status !== statusFilter) return false
    return true
  }), [employees, search, deptFilter, statusFilter])

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = await readWorkbookRows(file)
      const mapped = rows.map(r => {
        const get = (...keys) => { for (const k of Object.keys(r)) { if (keys.some(x => k.toLowerCase().trim() === x)) return r[k] } return undefined }
        const dname = String(get('department', 'dept') || '').trim()
        const dept = departments.find(d => d.name.toLowerCase() === dname.toLowerCase())
        return {
          full_name: String(get('employee name', 'name', 'full name', 'employee') || '').trim(),
          job_title: String(get('job title', 'role', 'title', 'position') || '').trim() || null,
          department_id: dept?.id || null,
          monthly_salary: Number(String(get('monthly salary', 'salary', 'pay') || '0').replace(/[^0-9.]/g, '')) || 0,
          employment_status: 'active',
        }
      }).filter(r => r.full_name)
      if (!mapped.length) { showToast('No usable rows found. Expected columns: Employee Name, Job Title, Department, Monthly Salary.', 'error'); return }
      await importEmployees(formId, mapped, settings)
      showToast(`Imported ${mapped.length} employees.`, 'success')
      load()
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: '180px' }} />
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['active', 'on_leave', 'suspended', 'inactive', 'terminated'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImportFile} />
          <button onClick={() => setAddOpen(true)}>+ Add Employee</button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Employee', 'Role', 'Department', 'Monthly Salary', 'Status'].map(h => (
              <th key={h} style={{ textAlign: h === 'Monthly Salary' ? 'right' : 'left', padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-muted)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '1.4rem', color: 'var(--color-muted)' }}>No employees{employees.length ? ' match the filters' : ' yet'}.</td></tr>
            )}
            {filtered.map(e => (
              <tr key={e.id} onClick={() => navigate(e.id)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>
                  {e.full_name}
                  {e.employee_number && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}> · {e.employee_number}</span>}
                </td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{e.job_title || '—'}</td>
                <td style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--color-border)' }}>{deptName[e.department_id] || '—'}</td>
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
          onClose={() => setAddOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
