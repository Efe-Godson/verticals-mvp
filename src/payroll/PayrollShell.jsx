// Layout for every /form/:id/payroll/* route. Loads the anchor form once
// and hands it to child routes via <Outlet context>. Section navigation
// (Payments / Staff / Events) lives in the app NavBar - see NavBar.jsx's
// payroll sub-tab strip.
import { useEffect, useState, useCallback } from 'react'
import { useParams, Outlet, useOutletContext } from 'react-router-dom'
import { loadPayrollForm } from './payrollApi'
import { LoadingState } from '../LoadingState'
import { ErrorState } from '../ErrorState'

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
      <Outlet context={{ form, formId: id, reloadForm }} />
    </div>
  )
}
