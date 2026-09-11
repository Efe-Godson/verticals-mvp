// Place at: src/AlertsPage.jsx
// /lab/alerts - admin-only feed of anything the backend flagged as worth a
// look: a rate limit tripping (supabase/functions/_shared/rateLimit.ts) or a
// user authenticated from 2+ places at once (see log-sign-in /
// list_concurrent_sessions, once that phase lands). Reads through the
// list-alerts edge function since alert_events has no RLS policies at all -
// only the service role can see it.
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import PageSkeleton from './components/PageSkeleton'
import { useDeferredLoading } from './components/loadingHooks'
import { ErrorState } from './ErrorState'
import EmptyState from './components/EmptyState'
import { usePageBack } from './PageTitleContext'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Each alert type gets its own compact summary line + detail row instead of
// a raw JSON dump - the shape of `detail` is different per type (see the
// alert_events migration comment).
function AlertSummary({ type, detail }) {
  if (type === 'rate_limit') {
    return (
      <>
        <div style={{ fontWeight: 600 }}>Rate limit tripped - {detail.function}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
          {detail.ip && <>IP {detail.ip} </>}
          {detail.form_id && <>· form {detail.form_id} </>}
          {detail.user_id && <>· user {detail.user_id} </>}
          {detail.room_id && <>· room {detail.room_id} </>}
        </div>
      </>
    )
  }
  if (type === 'concurrent_sessions') {
    return (
      <>
        <div style={{ fontWeight: 600 }}>Same account signed in from multiple places - {detail.email || detail.user_id}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
          {(detail.sessions || []).map((s, i) => (
            <div key={i}>{s.ip || 'unknown IP'}{s.user_agent ? ` · ${s.user_agent}` : ''} · {formatWhen(s.created_at)}</div>
          ))}
        </div>
      </>
    )
  }
  return <div style={{ fontWeight: 600 }}>{type}</div>
}

const TYPE_COLOR = {
  rate_limit: 'var(--status-warning)',
  concurrent_sessions: 'var(--status-critical)',
}

function AlertsPage() {
  usePageBack('/lab', 'Lab')
  const [alerts, setAlerts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: fnError } = await supabase.functions.invoke('list-alerts', { body: {} })
      if (cancelled) return
      if (fnError || data?.error) {
        setError(data?.error || fnError.message || 'Could not load alerts.')
        return
      }
      setAlerts(data.alerts || [])
    }
    load()
    return () => { cancelled = true }
  }, [])

  const showSkel = useDeferredLoading(alerts === null && !error)
  if (alerts === null && !error) return showSkel ? <PageSkeleton variant="table" /> : null
  if (error) return <ErrorState message={error} />

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Alerts</h1>
      <p style={{ color: 'var(--color-muted)', margin: '0.3rem 0 1.2rem' }}>
        Rate limits tripped and accounts signed in from more than one place at once.
      </p>

      {alerts.length === 0 ? (
        <EmptyState title="Nothing flagged" message="No rate limits have tripped and no accounts show concurrent sessions." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {alerts.map(a => (
            <div key={a.id} className="card" style={{ padding: '0.9rem 1.1rem', display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', marginTop: '0.45rem', flexShrink: 0,
                background: TYPE_COLOR[a.type] || 'var(--color-muted)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <AlertSummary type={a.type} detail={a.detail} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {formatWhen(a.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AlertsPage
