// Place at: src/expenses/ExpenseShell.jsx
// Layout for /form/:id/expenses/* - a contained environment with no app
// NavBar (see App.jsx's isExpenseEnv), navigated via PosSidePanel's expense
// links. Mirrors payroll/PayrollShell.jsx: load the anchor form once, hand
// it to child routes via <Outlet context>.
import { useEffect, useState, useCallback } from 'react'
import { useParams, Outlet, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ErrorState } from '../ErrorState'
import PageSkeleton from '../components/PageSkeleton'
import PosSidePanel from '../PosSidePanel'

export function useExpenses() {
  return useOutletContext()
}

export default function ExpenseShell() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reloadForm = useCallback(async () => {
    const { data, error: e } = await supabase.from('forms').select('*').eq('id', id).single()
    if (!e && data) setForm(data)
    return data
  }, [id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    supabase.from('forms').select('*').eq('id', id).single()
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e || !data) setError('This expense book could not be found.')
        else setForm(data)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  return (
    <>
      <PosSidePanel formId={id} />
      <div className="page" style={{ maxWidth: '820px' }}>
        {loading ? <PageSkeleton variant="detail" />
          : error ? <ErrorState message={error} />
            : <Outlet context={{ form, formId: id, reloadForm }} />}
      </div>
    </>
  )
}
