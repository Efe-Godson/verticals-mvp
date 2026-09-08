// Lab-only: "the app, with seeded data". Drops you straight into the sample
// (is_demo) business's Reports - real pages, real navigation - and flips on
// the demo ribbon (see DemoRibbon.jsx) so "Create account / Log in" rides
// along at the bottom. Nothing here writes data or creates accounts.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { ErrorState } from '../../ErrorState'
import PageSkeleton from '../../components/PageSkeleton'
import { DEMO_FLAG } from './DemoRibbon'

export default function DemoExperience() {
  const [demo, setDemo] = useState(undefined) // undefined = loading, null = none
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.from('forms').select('id, name').eq('is_demo', true).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setDemo(data || null)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (demo?.id) {
      try { sessionStorage.setItem(DEMO_FLAG, '1') } catch { /* private mode */ }
    }
  }, [demo])

  if (error) return <div className="page"><ErrorState message={error} /></div>
  if (demo === undefined) return <div className="page"><PageSkeleton variant="table" /></div>
  if (demo === null) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <h1>Demo</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          No sample business is set up yet. Mark a form as the demo (<code>is_demo</code>) to use this.
        </p>
      </div>
    )
  }

  // Land on Reports - the whole point is to show data - then it's just the
  // real app from there.
  return <Navigate to={`/form/${demo.id}/report`} replace />
}
