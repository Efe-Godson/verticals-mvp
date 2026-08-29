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
import Modal from './components/Modal'
import ConfirmDialog from './ConfirmDialog'
import PageSkeleton from './components/PageSkeleton'
import { useDeferredLoading } from './components/loadingHooks'
import { ErrorState } from './ErrorState'

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
      // The platform gateway itself (rejecting before our function code
      // even runs - e.g. an expired JWT) uses `message`, not `error`.
      if (body?.message) return body.message
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

// A typed password is otherwise fully masked the whole way through - no way
// to double-check what was actually typed before handing it to the staff
// member. This only toggles what's on screen right now; there's no stored
// password to "reveal" later (GoTrue hashes it, and this app never keeps a
// plaintext copy - Reset Password sets a new one, it can't show the old one).
function PasswordInput({ value, onChange, placeholder, autoFocus, style }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        required minLength={6}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...style, paddingRight: '3.2rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: '0.3rem', top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer',
          padding: '0.2rem 0.4rem', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1
        }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
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

  const showSkel = useDeferredLoading(loading)
  if (loading) return showSkel ? <PageSkeleton variant="table" /> : null
  if (error) return <ErrorState message={error} />

  return (
    <div className="page" style={isFocusMode ? { paddingTop: '4rem' } : undefined}>
      {/* Reserves room for PosSidePanel's fixed top-left hamburger - see the
          same fix in PublicForm.jsx/Records.jsx. */}
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
          <div style={{ margin: '0.3rem 0 1rem' }}>
            <PasswordInput
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Login'}</button>
        </form>
      </div>

      <h3 style={{ marginTop: '2rem' }}>Staff Logins</h3>
      {staff.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No staff logins yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {staff.map(s => (
            <div key={s.id} className="card" style={{ padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.7rem' }}>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{s.email.split('@')[0]}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', overflowWrap: 'anywhere' }}>
                  Login: {s.email} · Added {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ marginTop: '0.3rem' }}>
                  <StaffStatusBadge lastSeenAt={s.last_seen_at} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="secondary" onClick={() => { setResetTarget(s); setResetPassword('') }}>Reset Password</button>
                <button className="secondary" style={{ color: 'var(--status-critical)' }} onClick={() => setPendingDeleteId(s.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resetTarget && (
        <Modal
          size="sm"
          onClose={() => setResetTarget(null)}
          title={`Reset Password for ${resetTarget.email.split('@')[0]}`}
        >
          <form onSubmit={submitResetPassword}>
            <div style={{ marginBottom: '1rem' }}>
              <PasswordInput
                autoFocus value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password"
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary" onClick={() => setResetTarget(null)}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Remove this staff login?"
          message="They'll immediately lose access and won't be able to sign in again."
          confirmLabel="Remove"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}

export default AdminStaff
