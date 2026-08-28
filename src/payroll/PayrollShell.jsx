// Layout for every /form/:id/payroll/* tab. Loads the anchor form once,
// renders the 3-section sub-nav (Payments / Staff / Events), and hands the
// form down to child routes via <Outlet context>. Child pages read it with
// usePayroll() and call reloadForm() after they change form.settings.
import { useEffect, useState, useCallback } from 'react'
import { useParams, NavLink, Outlet, useOutletContext } from 'react-router-dom'
import { loadPayrollForm } from './payrollApi'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'

const TABS = [
  { to: '', label: 'Payments', end: true },
  { to: 'staff', label: 'Staff' },
  { to: 'events', label: 'Events' },
]

export function usePayroll() {
  return useOutletContext()
}

export default function PayrollShell() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reloadForm = useCallback(async () => {
    const data = await loadPayrollForm(id)
    setForm(data)
    return data
  }, [id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    loadPayrollForm(id)
      .then(data => { if (!cancelled) setForm(data) })
      .catch(err => { if (!cancelled) setError(err.message || 'Could not load payroll.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div className="page" style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(tab => (
          <NavLink
            key={tab.to || 'overview'}
            to={tab.to ? `/form/${id}/payroll/${tab.to}` : `/form/${id}/payroll`}
            end={tab.end}
            style={({ isActive }) => ({
              padding: '0.6rem 0.9rem', fontSize: '0.88rem', fontWeight: 600,
              color: isActive ? 'var(--color-primary)' : 'var(--color-muted)',
              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ form, formId: id, reloadForm }} />
    </div>
  )
}
