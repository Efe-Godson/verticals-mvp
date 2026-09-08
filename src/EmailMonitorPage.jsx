// Place at: src/EmailMonitorPage.jsx
// /lab/email-monitor - admin-only. A dashboard of cards, one per kind of
// email the app watches; "password_reset_request" (fed by the
// request-password-reset edge function, see Login.jsx's forgot-password
// flow) is the first one. Built so a second email type later is just another
// card in the same grid, not a rewrite.
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import PageSkeleton from './components/PageSkeleton'
import { useDeferredLoading } from './components/loadingHooks'
import { ErrorState } from './ErrorState'

function formatWhen(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function PasswordResetCard({ events, counts }) {
  const rows = events.filter(e => e.type === 'password_reset_request').slice(0, 30)
  return (
    <div className="card" style={{ padding: '1.2rem' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Password reset requests</div>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 0.9rem' }}>
        Every forgot-password submission - whether or not the email actually matched an account.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{counts.last_hour}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Last hour</div>
        </div>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{counts.last_day}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Last 24h</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>No requests yet.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>When</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>Account?</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id}>
                  <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{formatWhen(e.created_at)}</td>
                  <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>{e.email}</td>
                  <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>
                    {e.account_existed
                      ? <span style={{ color: 'var(--status-good)' }}>Yes</span>
                      : <span style={{ color: 'var(--color-muted)' }}>No</span>}
                  </td>
                  <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{e.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmailMonitorPage() {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: fnError } = await supabase.functions.invoke('list-email-events', { body: {} })
      if (cancelled) return
      if (fnError || data?.error) {
        setError(data?.error || fnError.message || 'Could not load email activity.')
        return
      }
      setResult(data)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const showSkel = useDeferredLoading(result === null && !error)
  if (result === null && !error) return showSkel ? <PageSkeleton variant="cards" /> : null
  if (error) return <ErrorState message={error} />

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Email Monitor</h1>
      <p style={{ color: 'var(--color-muted)', margin: '0.3rem 0 1.2rem' }}>
        Emails the app sends, watched for abuse - more cards land here as more email types are tracked.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <PasswordResetCard events={result.events} counts={result.password_reset_requests} />
      </div>
    </div>
  )
}

export default EmailMonitorPage
