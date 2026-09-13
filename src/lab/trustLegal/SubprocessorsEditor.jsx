// Place at: src/lab/trustLegal/SubprocessorsEditor.jsx
// Subprocessors gets its own editor shape (brief section 13): the shared
// LegalPageEditor for its optional Markdown intro, plus a provider list
// that's just live data (no draft/publish state of its own - a provider
// row is either Active and shown, or Inactive and hidden).
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../Toast'
import ConfirmDialog from '../../ConfirmDialog'
import Modal from '../../components/Modal'
import { ErrorState } from '../../ErrorState'
import LegalPageEditor from './LegalPageEditor'

const BLANK = { provider_name: '', purpose: '', data_involved: '', link: '', status: 'Active' }

export default function SubprocessorsEditor() {
  const { showToast } = useToast()
  const [providers, setProviders] = useState(null) // null while loading
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // provider row being edited, or BLANK for a new one, or null
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  async function load() {
    setError('')
    const { data, error: fetchError } = await supabase
      .from('subprocessors').select('*').order('sort_order', { ascending: true })
    if (fetchError) { setError('Could not load subprocessors: ' + fetchError.message); return }
    setProviders(data || [])
  }

  useEffect(() => { load() }, [])

  async function saveProvider(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing.id) {
        const { error: updateError } = await supabase.from('subprocessors').update({
          provider_name: editing.provider_name, purpose: editing.purpose, data_involved: editing.data_involved,
          link: editing.link, status: editing.status, updated_at: new Date().toISOString(),
        }).eq('id', editing.id)
        if (updateError) throw new Error(updateError.message)
      } else {
        const { error: insertError } = await supabase.from('subprocessors').insert([{
          ...editing, sort_order: providers.length,
        }])
        if (insertError) throw new Error(insertError.message)
      }
      showToast('Provider saved.', 'success')
      setEditing(null)
      load()
    } catch (err) {
      showToast('Could not save: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function performDelete() {
    const id = pendingDeleteId
    setPendingDeleteId(null)
    const { error: deleteError } = await supabase.from('subprocessors').delete().eq('id', id)
    if (deleteError) { showToast('Could not delete: ' + deleteError.message, 'error'); return }
    setProviders(current => current.filter(p => p.id !== id))
    showToast('Provider removed.', 'success')
  }

  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <LegalPageEditor slug="subprocessors" label="Subprocessors" contentOnly />

      <div className="toolbar-row" style={{ justifyContent: 'space-between', margin: '1.5rem 0 1rem' }}>
        <h3 style={{ margin: 0 }}>Providers</h3>
        <button type="button" onClick={() => setEditing({ ...BLANK })}>+ Add Provider</button>
      </div>

      {providers === null ? null : providers.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No providers added yet.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {providers.map(p => (
            <div key={p.id} style={{
              padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '0.7rem', borderBottom: '1px solid var(--color-border)',
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {p.provider_name}
                  <span style={{
                    marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                    color: p.status === 'Active' ? 'var(--status-good)' : 'var(--color-muted)',
                    background: p.status === 'Active' ? 'color-mix(in srgb, var(--status-good) 15%, transparent)' : 'var(--color-bg)',
                  }}>
                    {p.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{p.purpose}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="secondary" onClick={() => setEditing(p)}>Edit</button>
                <button type="button" className="secondary" style={{ color: '#c0392b' }} onClick={() => setPendingDeleteId(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal size="sm" onClose={() => setEditing(null)} title={editing.id ? 'Edit provider' : 'Add provider'}>
          <form onSubmit={saveProvider}>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.8rem' }}>
              Provider name
              <input type="text" required autoFocus value={editing.provider_name}
                onChange={e => setEditing({ ...editing, provider_name: e.target.value })}
                style={{ width: '100%', marginTop: '0.35rem' }} />
            </label>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.8rem' }}>
              Purpose
              <input type="text" value={editing.purpose || ''}
                onChange={e => setEditing({ ...editing, purpose: e.target.value })}
                style={{ width: '100%', marginTop: '0.35rem' }} />
            </label>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.8rem' }}>
              Data involved
              <input type="text" value={editing.data_involved || ''}
                onChange={e => setEditing({ ...editing, data_involved: e.target.value })}
                style={{ width: '100%', marginTop: '0.35rem' }} />
            </label>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.8rem' }}>
              Privacy/website link
              <input type="url" value={editing.link || ''}
                onChange={e => setEditing({ ...editing, link: e.target.value })}
                placeholder="https://" style={{ width: '100%', marginTop: '0.35rem' }} />
            </label>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'block', marginBottom: '1rem' }}>
              Status
              <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}
                style={{ width: '100%', marginTop: '0.35rem' }}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete this provider?"
          message="This removes it from the public Subprocessors table immediately."
          confirmLabel="Delete" danger
          onConfirm={performDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
