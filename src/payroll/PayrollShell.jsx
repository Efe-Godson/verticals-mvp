// Layout for every /form/:id/payroll/* route. Payroll is a contained
// environment (no app NavBar - see App.jsx's isPayrollEnv): section nav is
// the slide-out in PayrollSidePanel, and this shows the current section as
// the page heading. Loads the anchor form once and hands it to child
// routes via <Outlet context>.
import { useEffect, useState, useCallback } from 'react'
import { useParams, useLocation, Outlet, useOutletContext } from 'react-router-dom'
import { loadPayrollForm } from './payrollApi'
import { ErrorState } from '../ErrorState'
import { Skeleton, SkeletonKpis, SkeletonTableRows } from '../components/Skeleton'
import PayrollSidePanel from './PayrollSidePanel'

export function usePayroll() {
  return useOutletContext()
}

function sectionLabel(pathname) {
  if (/\/payroll\/staff(\/|$)/.test(pathname)) return 'Staff'
  if (/\/payroll\/events(\/|$)/.test(pathname)) return 'Events'
  return 'Payments'
}

export default function PayrollShell() {
  const { id } = useParams()
  const { pathname } = useLocation()
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

  return (
    <div className="payroll-shell">
      <PayrollSidePanel formId={id} />
      <div className="page" style={{ maxWidth: '1000px' }}>
        {/* The section heading is known from the URL immediately, so show it
            even while the anchor form loads - only the body below is a
            skeleton (brief §2/§4). */}
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 1.3rem' }}>{sectionLabel(pathname)}</h1>
        {loading ? (
          <div aria-busy="true">
            <SkeletonKpis count={4} />
            <div style={{ height: '1.2rem' }} />
            <div className="table-wrap">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} style={{ padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}><Skeleton w="55%" h="0.7rem" /></th>
                ))}</tr></thead>
                <SkeletonTableRows rows={6} cols={5} />
              </table>
            </div>
          </div>
        ) : error ? <ErrorState message={error} />
          : <Outlet context={{ form, formId: id, reloadForm }} />}
      </div>
    </div>
  )
}
