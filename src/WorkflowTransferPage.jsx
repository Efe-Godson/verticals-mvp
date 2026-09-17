// Place at: src/WorkflowTransferPage.jsx
// Where a transfer invitation email's link (see supabase/functions/
// manage-workflow-transfer and ShareModal.jsx's "Transfer ownership")
// actually lands - reviews the invite and lets the recipient accept or
// decline. Works for both scopes the backend supports: a whole workflow
// (every location in a business) or a single location.
import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'
import { LoadingState } from './LoadingState'

function WorkflowTransferPage() {
  const { id } = useParams()
  const location = useLocation()
  const { session, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  // The secret never touches the server as part of the URL path/query - it
  // rides in the fragment (#token=...), which browsers don't send on
  // navigation, and is read here purely client-side.
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('token') || ''

  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmingAccept, setConfirmingAccept] = useState(false)

  async function call(action) {
    const { data, error: fnError } = await supabase.functions.invoke('manage-workflow-transfer', { body: { action, id, token } })
    if (fnError) throw new Error(fnError.message || 'Something went wrong')
    if (data?.error) throw new Error(data.error)
    return data
  }

  useEffect(() => {
    if (authLoading || !session) return
    if (!token) { setError("This invitation link is missing its secret - open it directly from the email you were sent."); setLoading(false); return }
    let cancelled = false
    call('review')
      .then(data => { if (!cancelled) { setTransfer(data.transfer); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [authLoading, session, id, token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccept() {
    setConfirmingAccept(false)
    setBusy(true)
    try {
      const data = await call('accept')
      setTransfer(data.transfer)
      showToast('Ownership transferred.', 'success')
    } catch (err) {
      showToast('Could not accept: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDecline() {
    setBusy(true)
    try {
      const data = await call('decline')
      setTransfer(data.transfer)
    } catch (err) {
      showToast('Could not decline: ' + err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) return <LoadingState />

  // No forced redirect through PrivateRoute here - that would drop the
  // #token fragment before this component ever mounts. Instead, ask for a
  // sign-in and let the person reopen the same email link once they have.
  if (!session) {
    return (
      <div className="page" style={{ maxWidth: '420px' }}>
        <h1>Ownership transfer</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Sign in with the email address that received this invitation, then open this link again to review it.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
          <Link to="/login"><button type="button">Log in</button></Link>
          <Link to="/signup"><button type="button" className="secondary">Sign up</button></Link>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingState />

  if (error) {
    return (
      <div className="page" style={{ maxWidth: '420px' }}>
        <h1>Ownership transfer</h1>
        <p style={{ color: '#c0392b' }}>{error}</p>
      </div>
    )
  }

  const subjectLabel = transfer.scope === 'workflow'
    ? `"${transfer.display_name}" and all ${transfer.form_count} of its locations`
    : `the location "${transfer.display_name}"`

  return (
    <div className="page" style={{ maxWidth: '480px' }}>
      <h1>Ownership transfer</h1>

      {transfer.status === 'accepted' ? (
        <p>You now own {subjectLabel}. <Link to="/">Go to Home</Link>.</p>
      ) : transfer.status === 'declined' ? (
        <p>You declined this invitation.</p>
      ) : transfer.status === 'cancelled' ? (
        <p>{transfer.owner_email} cancelled this invitation.</p>
      ) : transfer.expired ? (
        <p>This invitation has expired. Ask {transfer.owner_email} to send a new one.</p>
      ) : (
        <>
          <p style={{ color: 'var(--color-muted)' }}>
            <strong>{transfer.owner_email}</strong> has offered to transfer ownership of {subjectLabel} to you ({transfer.recipient_email}).
            You'll get full ownership - the previous owner is kept on as an Admin instead of losing access outright, but only you can manage sharing or transfer it again from here. Existing records and other collaborators stay in place.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.2rem' }}>
            <button type="button" disabled={busy} onClick={() => setConfirmingAccept(true)}>Accept</button>
            <button type="button" className="secondary" disabled={busy} onClick={handleDecline}>Decline</button>
          </div>
        </>
      )}

      {confirmingAccept && (
        <ConfirmDialog
          title="Accept this transfer?"
          message={`You will get full ownership of ${subjectLabel}. This can't be undone.`}
          confirmLabel="Accept"
          onConfirm={handleAccept}
          onCancel={() => setConfirmingAccept(false)}
        />
      )}
    </div>
  )
}

export default WorkflowTransferPage
