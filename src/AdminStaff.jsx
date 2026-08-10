// Place at: src/AdminStaff.jsx
// Lets the form owner create staff logins scoped to this one form. A staff
// account is a real Supabase Auth user (see manage-staff edge function),
// restricted app-wide (see StaffScopedRoute in App.jsx) to Order Screen,
// Add Products, and Records for this form only - everything else here on
// the Admin page, Reports, Settings, other forms, stays owner-only.
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import PosSidePanel from './PosSidePanel'

// supabase-js only populates `data` when the function returns 2xx - on a
// non-2xx response `data` is null and `error.message` is just the generic
// "Edge Function returned a non-2xx status code", which is all any of the
// toasts here used to show. The actual reason (e.g. "email already
// registered") is in the response body, reachable via error.context.
async function functionErrorMessage(invokeError, data) {
  if (data?.error) return data.error
  if (invokeError?.context?.json) {
    try {
      const body = await invokeError.context.json()
      if (body?.error) return body.error
    } catch { /* body wasn't JSON, fall through to the generic message */ }
  }
  return invokeError?.message || 'Unknown error'
}

// The access token supabase-js attaches can go stale if it wasn't refreshed
// in time (e.g. the tab sat idle) - manage-staff then rejects it with
// "Invalid or expired session" even though the rest of the app still shows
// the user as signed in (RLS-backed table queries route around expiry more
// gracefully than a token an edge function validates directly). Force a
// refresh and retry once before surfacing that as an error.
async function invokeManageStaff(body) {
  let result = await supabase.functions.invoke('manage-staff', { body })
  if (result.error) {
    await supabase.auth.refreshSession()
    result = await supabase.functions.invoke('manage-staff', { body })
  }
  return result
}

// The synthetic email built below only needs to be *shaped* like an email
// for Supabase Auth to accept it - it's never actually sent anywhere. But
// GoTrue still validates that shape strictly, so anything the owner types
// (spaces, punctuation, emoji...) has to be squashed down to a safe
// local-part first, or account creation fails with a raw GoTrue "invalid
// format" error that means nothing to a non-technical form owner.
function sanitizeUsername(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '')
}

// There's no real "logged in / logged out" signal available client-side (no
// session table exposed via the client SDK) - AuthContext.jsx instead has
// staff sessions ping a heartbeat every 60s while the tab is open, so
// "Active" here just means a heartbeat landed recently. Generous enough to
// not flicker between polls, but still tight enough to read as "right now".
const ACTIVE_WITHIN_MS = 2 * 60 * 1000

function timeAgo(dateString) {
  const ms = Date.now() - new Date(dateString).getTime()
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function StaffStatusBadge({ lastSeenAt }) {
  const active = lastSeenAt && (Date.now() - new Date(lastSeenAt).getTime()) < ACTIVE_WITHIN_MS
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: active ? '#1a7f37' : '#bbb'
      }} />
      {active ? 'Active' : lastSeenAt ? `Offline · last seen ${timeAgo(lastSeenAt)}` : 'Never logged in'}
    </div>
  )
}

function AdminStaff() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isFocusMode = searchParams.get('focus') === '1'
  const { showToast } = useToast()

  const [form, setForm] = useState(null)
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)

  const [resetTarget, setResetTarget] = useState(null) // staff row being given a new password
  const [resetPassword, setResetPassword] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  async function loadStaff() {
    const { data, error: invokeError } = await invokeManageStaff({ action: 'list', form_id: id })
    if (invokeError || data?.error) {
      setError(await functionErrorMessage(invokeError, data))
    } else {
      setStaff(data.staff)
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error: formError } = await supabase.from('forms').select('*').eq('id', id).single()
      if (formError || !data) {
        setError('This form could not be found.')
        setLoading(false)
        return
      }
      setForm(data)
      await loadStaff()
      setLoading(false)
    }
    load()
  }, [id])

  // Refreshes status badges on their own, without the owner needing to
  // reload the page to see someone go active/offline.
  useEffect(() => {
    const interval = setInterval(loadStaff, 30000)
    return () => clearInterval(interval)
  }, [id])

  async function createStaff(e) {
    e.preventDefault()
    // Staff sign in with a plain username, not a real inbox - Supabase Auth
    // still needs an email-shaped identifier, so one is built here from the
    // username plus a per-form domain (keeps usernames only needing to be
    // unique within this one form, not across the whole project).
    const cleanUsername = sanitizeUsername(username)
    if (!cleanUsername) {
      showToast('Username needs at least one letter or number.', 'error')
      return
    }
    setCreating(true)
    const staffEmail = `${cleanUsername}@${id.slice(0, 8)}.staff.local`
    const { data, error: invokeError } = await invokeManageStaff({ action: 'create', form_id: id, email: staffEmail, password })
    setCreating(false)

    if (invokeError || data?.error) {
      showToast('Could not create staff login: ' + await functionErrorMessage(invokeError, data), 'error')
      return
    }
    showToast(`Staff login created for ${cleanUsername}.`, 'success')
    setUsername('')
    setPassword('')
    loadStaff()
  }

  async function submitResetPassword(e) {
    e.preventDefault()
    const { data, error: invokeError } = await invokeManageStaff({ action: 'reset_password', form_id: id, staff_id: resetTarget.id, password: resetPassword })
    if (invokeError || data?.error) {
      showToast('Could not reset password: ' + await functionErrorMessage(invokeError, data), 'error')
      return
    }
    showToast(`Password updated for ${resetTarget.email.split('@')[0]}.`, 'success')
    setResetTarget(null)
    setResetPassword('')
  }

  async function confirmDelete() {
    const { data, error: invokeError } = await invokeManageStaff({ action: 'delete', form_id: id, staff_id: pendingDeleteId })
    setPendingDeleteId(null)
    if (invokeError || data?.error) {
      showToast('Could not remove staff login: ' + await functionErrorMessage(invokeError, data), 'error')
      return
    }
    showToast('Staff login removed.', 'success')
    loadStaff()
  }

  if (loading) return <div className="page">Loading admin...</div>
  if (error) return <div className="page" style={{ color: 'red' }}>{error}</div>

  return (
    <div className="page">
      {isFocusMode && <PosSidePanel formId={form.id} hasCartField={form.fields?.some(f => f.type === 'cart')} />}
      <h1>Create New Location Login</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: '-0.5rem' }}>
        Create staff logins for "{form.name}". Staff can only reach Order Screen, Add Products, and Records - nothing else in the app.
      </p>

      <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem', maxWidth: '420px' }}>
        <h3 style={{ marginTop: 0 }}>New Staff Login</h3>
        <form onSubmit={createStaff}>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Username</label>
          <input
            type="text" required value={username} onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
            placeholder="e.g. waiter1"
            style={{ width: '100%', padding: '0.5rem', margin: '0.3rem 0 0.3rem' }}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
            Letters, numbers, dots, dashes, and underscores only.
          </div>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Password</label>
          <input
            type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', margin: '0.3rem 0 1rem' }}
          />
          <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Login'}</button>
        </form>
      </div>

      <h3 style={{ marginTop: '2rem' }}>Staff Logins</h3>
      {staff.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No staff logins yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {staff.map(s => (
            <div key={s.id} className="card" style={{ padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.email.split('@')[0]}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  Login: {s.email} · Added {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ marginTop: '0.3rem' }}>
                  <StaffStatusBadge lastSeenAt={s.last_seen_at} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="secondary" onClick={() => { setResetTarget(s); setResetPassword('') }}>Reset Password</button>
                <button className="secondary" style={{ color: '#c0392b' }} onClick={() => setPendingDeleteId(s.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resetTarget && (
        <div
          onClick={() => setResetTarget(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ background: 'white', padding: '1.5rem', width: '360px', maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Reset Password for {resetTarget.email.split('@')[0]}</h3>
            <form onSubmit={submitResetPassword}>
              <input
                type="password" required minLength={6} autoFocus value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password"
                style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setResetTarget(null)}>Cancel</button>
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <div
          onClick={() => setPendingDeleteId(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ background: 'white', padding: '1.5rem', width: '360px', maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 0.6rem' }}>Remove this staff login?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>They'll immediately lose access and won't be able to sign in again.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="secondary" onClick={() => setPendingDeleteId(null)}>Cancel</button>
              <button style={{ background: '#c0392b' }} onClick={confirmDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminStaff
