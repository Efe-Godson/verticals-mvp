// Place at: src/ShareModal.jsx
// Google-Workspace-style share dialog, opened from the "⋮" menu on a
// workflow tile (BusinessesHome.jsx) or a location tile (TemplateLocations.jsx)
// - only ever shown to the owner (see decision: only the owner manages
// sharing), so `session.user` here is always the owner, never a
// collaborator. All the actual work happens server-side in the manage-share
// edge function, which re-verifies ownership itself (the service-role key
// it runs with bypasses RLS entirely).
import { useEffect, useState } from 'react'
import Modal from './components/Modal'
import ConfirmDialog from './ConfirmDialog'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'

// Transfers move either the whole workflow or a single location (see
// supabase/functions/manage-workflow-transfer) - scope here is the same
// 'workflow' | 'location' value manage-share already uses, so it doubles as
// the transfer scope too.
const ACTIVE_TRANSFER_STATUSES = ['sending', 'pending']

function ShareModal({ scope, templateSlug, formId, displayName, onClose }) {
  const { session } = useAuth()
  const { showToast } = useToast()
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [transferLoading, setTransferLoading] = useState(true)
  const [transferEmail, setTransferEmail] = useState('')
  const [transferBusy, setTransferBusy] = useState(false)
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)

  const scopeParams = scope === 'workflow' ? { scope, template_slug: templateSlug } : { scope, form_id: formId }

  async function callShareFunction(body) {
    const { data, error } = await supabase.functions.invoke('manage-share', { body: { ...scopeParams, ...body } })
    if (error) throw new Error(error.message || 'Something went wrong')
    if (data?.error) throw new Error(data.error)
    return data
  }

  async function callTransferFunction(body) {
    const { data, error } = await supabase.functions.invoke('manage-workflow-transfer', { body: { scope, template_slug: templateSlug, form_id: formId, ...body } })
    if (error) throw new Error(error.message || 'Something went wrong')
    if (data?.error) throw new Error(data.error)
    return data
  }

  async function loadShares() {
    setLoading(true)
    try {
      const data = await callShareFunction({ action: 'list' })
      setShares(data.shares || [])
    } catch (err) {
      showToast('Could not load who has access: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadTransferStatus() {
    setTransferLoading(true)
    try {
      const data = await callTransferFunction({ action: 'status' })
      setTransfer(data.transfer)
    } catch (err) {
      showToast('Could not load transfer status: ' + err.message, 'error')
    } finally {
      setTransferLoading(false)
    }
  }

  useEffect(() => {
    loadShares()
    loadTransferStatus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    try {
      const data = await callShareFunction({ action: 'invite', email, role })
      setShares(current => [data.share, ...current.filter(s => s.id !== data.share.id)])
      setEmail('')
      showToast(
        data.emailSent
          ? `Invited ${data.share.email}.`
          : `${data.share.email} now has access - they already had an account, so no invite email was sent.`,
        'success'
      )
    } catch (err) {
      showToast('Could not invite: ' + err.message, 'error')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(share, newRole) {
    if (newRole === share.role) return
    setBusyId(share.id)
    try {
      const data = await callShareFunction({ action: 'update_role', share_id: share.id, role: newRole })
      setShares(current => current.map(s => s.id === share.id ? data.share : s))
    } catch (err) {
      showToast('Could not change role: ' + err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(share) {
    setBusyId(share.id)
    try {
      await callShareFunction({ action: 'remove', share_id: share.id })
      setShares(current => current.filter(s => s.id !== share.id))
    } catch (err) {
      showToast('Could not remove: ' + err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRequestTransfer() {
    setConfirmingTransfer(false)
    setTransferBusy(true)
    try {
      const data = await callTransferFunction({ action: 'request', email: transferEmail })
      setTransfer(data.transfer)
      setTransferEmail('')
      showToast(`Transfer invitation sent to ${data.transfer.recipient_email}.`, 'success')
    } catch (err) {
      showToast('Could not start transfer: ' + err.message, 'error')
    } finally {
      setTransferBusy(false)
    }
  }

  async function handleCancelTransfer() {
    setTransferBusy(true)
    try {
      await callTransferFunction({ action: 'cancel', id: transfer.id })
      setTransfer(null)
    } catch (err) {
      showToast('Could not cancel the transfer: ' + err.message, 'error')
    } finally {
      setTransferBusy(false)
    }
  }

  function copyLink() {
    const link = scope === 'workflow'
      ? `${window.location.origin}/templates/${templateSlug}/locations?owner=${session.user.id}`
      : `${window.location.origin}/form/${formId}/records`
    navigator.clipboard.writeText(link)
    showToast('Link copied.', 'success')
  }

  return (
    <>
    <Modal
      size="md"
      onClose={onClose}
      title={scope === 'workflow' ? `Share "${displayName}" — all locations` : `Share "${displayName}"`}
    >
      {scope === 'workflow' ? (
        <p style={{ fontSize: '0.85rem', margin: '0 0 1rem', padding: '0.6rem 0.8rem', background: 'var(--color-warning-soft)', borderRadius: 'var(--radius)' }}>
          This shares every location in this workflow, including ones added later. Admins can manage all of them; viewers get read-only access from Records and Reports. To share just one location, use Share on that location's tile instead.
        </p>
      ) : (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          Admins get full access to this location. Viewers get read-only access from Records and Reports, and never see it on Home.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.1rem' }}>
          <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session?.user?.email}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, flexShrink: 0 }}>Owner</span>
        </div>

        {loading ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', padding: '0.4rem 0.1rem' }}>Loading…</span>
        ) : shares.length === 0 ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', padding: '0.4rem 0.1rem' }}>
            Not shared with anyone yet.
          </span>
        ) : shares.map(share => (
          <div
            key={share.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
              padding: '0.5rem 0.1rem', borderTop: '1px solid var(--color-border)'
            }}
          >
            <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {share.email}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              <select
                value={share.role}
                disabled={busyId === share.id}
                onChange={(e) => {
                  const value = e.target.value
                  // Picking this from the role dropdown just pre-fills the
                  // transfer form below with this person's email (still
                  // needs the confirm step) - it never changes their role
                  // by itself, so the select snaps back to share.role.
                  if (value === '__transfer') { setTransferEmail(share.email); setConfirmingTransfer(true); return }
                  handleRoleChange(share, value)
                }}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.4rem' }}
              >
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
                <option value="__transfer">Transfer ownership…</option>
              </select>
              <button
                type="button" className="secondary" disabled={busyId === share.id}
                onClick={() => handleRemove(share)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        <input
          type="email" required placeholder="Email address" value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: '0.5rem', fontSize: '0.85rem' }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={inviting}>{inviting ? 'Inviting…' : 'Invite'}</button>
      </form>

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Transfer ownership</div>
        {transferLoading ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Loading…</span>
        ) : transfer && ACTIVE_TRANSFER_STATUSES.includes(transfer.status) ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
            fontSize: '0.85rem', padding: '0.6rem 0.8rem', background: 'var(--color-warning-soft)', borderRadius: 'var(--radius)',
          }}>
            <span>
              Pending — {transfer.recipient_email} has until {new Date(transfer.expires_at).toLocaleDateString()} to accept.
            </span>
            <button
              type="button" className="secondary" disabled={transferBusy}
              onClick={handleCancelTransfer}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', flexShrink: 0 }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
              {scope === 'workflow'
                ? 'Hand full ownership of every location in this workflow to someone else. You\'ll be kept on as an Admin once they accept - only they can manage sharing or transfer it again from here.'
                : 'Hand full ownership of this location to someone else. You\'ll be kept on as an Admin once they accept - only they can manage sharing or transfer it again from here.'}
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); if (transferEmail.trim()) setConfirmingTransfer(true) }}
              style={{ display: 'flex', gap: '0.4rem' }}
            >
              <input
                type="email" required placeholder="New owner's email" value={transferEmail}
                onChange={(e) => setTransferEmail(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '0.5rem', fontSize: '0.85rem' }}
              />
              <button type="submit" className="secondary" disabled={transferBusy}>Transfer…</button>
            </form>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <button type="button" className="secondary" onClick={copyLink}>Copy share link</button>
        <button type="button" className="secondary" onClick={onClose}>Done</button>
      </div>
    </Modal>
    {confirmingTransfer && (
      <ConfirmDialog
        title="Transfer ownership?"
        message={
          scope === 'workflow'
            ? `${transferEmail} will get full ownership of "${displayName}" and every location in it. You'll be kept on as an Admin once they accept, but only they can manage sharing from here.`
            : `${transferEmail} will get full ownership of the location "${displayName}". You'll be kept on as an Admin once they accept, but only they can manage sharing from here.`
        }
        confirmLabel="Send invitation"
        danger
        onConfirm={handleRequestTransfer}
        onCancel={() => setConfirmingTransfer(false)}
      />
    )}
    </>
  )
}

export default ShareModal
