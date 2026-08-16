// Place at: src/TemplateLocations.jsx
// One template's "home page": every location (fully independent form -
// own menu, own orders, own records) created from this template, plus
// "+ Add Location" for the next one. Reached from BusinessesHome.jsx's
// grid, or from Templates.jsx's "Manage" once a template is already in use.
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'
import HomeRecycleBinDialog from './HomeRecycleBinDialog'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { categoryColor, LocationIcon } from './templateVisuals'
import { createLocationForm, locationDestination } from './locations'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'

function LocationTile({ location, color, onManage }) {
  return (
    <div
      className="template-tile"
      onClick={onManage}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onManage() } }}
      style={{
        position: 'relative', aspectRatio: '1', border: '1px solid var(--color-border)', borderRadius: '12px',
        background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.5rem', padding: '0.9rem', textAlign: 'center', cursor: 'pointer'
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '10px', background: `${color}16`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <LocationIcon color={color} />
      </div>
      <span style={{
        fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {location.settings?.locationName || location.name}
      </span>
    </div>
  )
}

function AddLocationTile({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="template-tile"
      style={{
        aspectRatio: '1', border: '1.5px dashed var(--color-border)', borderRadius: '12px',
        background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.4rem', padding: '0.9rem', color: 'var(--color-muted)', cursor: 'pointer'
      }}
    >
      <span style={{ fontSize: '1.4rem', lineHeight: 1, fontWeight: 700 }}>+</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Add Location</span>
    </button>
  )
}

function TemplateLocations() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showToast } = useToast()

  const { setTrigger } = useRecycleBinTrigger()

  const [template, setTemplate] = useState(null)
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [locationNameInput, setLocationNameInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)

  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [pendingBinConfirm, setPendingBinConfirm] = useState(null) // { type: 'permanentDelete', formId } | { type: 'emptyBin' }
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [trashedLocations, setTrashedLocations] = useState([])
  const [loadingBin, setLoadingBin] = useState(false)

  async function loadLocations(templateSlug) {
    const { data } = await supabase
      .from('forms').select('id, name, settings')
      .eq('user_id', session.user.id)
      .eq('settings->>templateSlug', templateSlug)
      .is('deleted_at', null)
      .is('settings->>primaryFormId', null)
      .order('created_at', { ascending: false })
    setLocations(data || [])

    const { count } = await supabase
      .from('forms').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('settings->>templateSlug', templateSlug)
      .not('deleted_at', 'is', null)
    setBinCount(count || 0)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error: templateError } = await supabase.from('templates').select('*').eq('slug', slug).single()
      if (templateError || !data) {
        setError('This template could not be found.')
        setLoading(false)
        return
      }
      setTemplate(data)
      await loadLocations(slug)
      setLoading(false)
    }
    load()
  }, [slug])

  // Publishes the bin's open handler + count to NavBar (see BusinessesHome.jsx
  // for the same pattern) so it's reachable from here too, scoped to just
  // this template's locations rather than every form on the account.
  useEffect(() => {
    setTrigger({ onOpen: openBin, count: binCount })
    return () => setTrigger(null)
  }, [binCount])

  async function openBin() {
    setShowBin(true)
    setLoadingBin(true)
    const { data } = await supabase
      .from('forms').select('id, name, settings, deleted_at')
      .eq('user_id', session.user.id)
      .eq('settings->>templateSlug', slug)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setTrashedLocations(data || [])
    setLoadingBin(false)
  }

  function requestDeleteLocation(formId) {
    setPendingDeleteId(formId)
  }

  async function performDeleteLocation() {
    const formId = pendingDeleteId
    setPendingDeleteId(null)
    const { error } = await supabase.from('forms').update({ deleted_at: new Date().toISOString() }).eq('id', formId)
    if (error) {
      showToast('Could not delete: ' + error.message, 'error')
      return
    }
    setLocations(current => current.filter(l => l.id !== formId))
    setBinCount(count => count + 1)
    showToast('Location moved to Recycle Bin.', 'success')
  }

  async function restoreLocation(formId) {
    const { data, error } = await supabase
      .from('forms').update({ deleted_at: null }).eq('id', formId).select().single()
    if (error) {
      showToast('Could not restore this location: ' + error.message, 'error')
      return
    }
    setTrashedLocations(current => current.filter(l => l.id !== formId))
    setLocations(current => [data, ...current])
    setBinCount(count => Math.max(0, count - 1))
    showToast('Location restored.', 'success')
  }

  async function performPermanentDelete(formId) {
    const { error } = await supabase.from('forms').delete().eq('id', formId)
    if (error) {
      showToast('Could not permanently delete: ' + error.message, 'error')
      return
    }
    setTrashedLocations(current => current.filter(l => l.id !== formId))
    setBinCount(count => Math.max(0, count - 1))
    showToast('Location permanently deleted.', 'success')
  }

  async function performEmptyBin() {
    const ids = trashedLocations.map(l => l.id)
    if (ids.length === 0) return
    const { error } = await supabase.from('forms').delete().in('id', ids)
    if (error) {
      showToast('Could not empty the bin: ' + error.message, 'error')
      return
    }
    setTrashedLocations([])
    setBinCount(0)
    showToast('Recycle Bin emptied.', 'success')
  }

  function handleBinConfirm() {
    const confirm = pendingBinConfirm
    setPendingBinConfirm(null)
    if (!confirm) return
    if (confirm.type === 'permanentDelete') performPermanentDelete(confirm.formId)
    else if (confirm.type === 'emptyBin') performEmptyBin()
  }

  function openAddModal() {
    setLocationNameInput(template.name)
    setShowAddModal(true)
  }

  async function confirmAddLocation(e) {
    e.preventDefault()
    if (!locationNameInput.trim()) return
    setCreating(true)
    try {
      const form = await createLocationForm({ session, template, locationName: locationNameInput })
      showToast(`"${form.name}" created, customize it now.`, 'success')
      setShowAddModal(false)
      navigate(locationDestination(template, form.id))
    } catch (err) {
      showToast('Could not create this location: ' + err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const color = categoryColor(template.category)

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .template-tile:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>

      <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>← All businesses</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ margin: '0.5rem 0 0.2rem' }}>{template.name}</h1>
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>
            {locations.length} location{locations.length !== 1 ? 's' : ''}
          </p>
        </div>
        {locations.length > 0 && (
          <button className="secondary" onClick={() => setShowManageModal(true)}>
            Manage Locations
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem', marginTop: '1rem' }}>
        {locations.map(location => (
          <LocationTile
            key={location.id}
            location={location}
            color={color}
            onManage={() => navigate(locationDestination(template, location.id))}
          />
        ))}
        <AddLocationTile onClick={openAddModal} />
      </div>

      {showManageModal && (
        <div
          onClick={() => setShowManageModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '420px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <h3 style={{ margin: 0 }}>Manage Locations</h3>
              <button className="secondary" onClick={() => setShowManageModal(false)}>Close</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.2rem', marginBottom: '1rem' }}>
              Deleting moves a location to the Recycle Bin - you can restore it later from there.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {locations.length === 0 && (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>No locations left.</p>
              )}
              {locations.map(location => (
                <div key={location.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem',
                  padding: '0.5rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: '6px'
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{location.settings?.locationName || location.name}</span>
                  <button
                    type="button"
                    className="secondary"
                    style={{ color: '#c0392b', fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                    onClick={() => requestDeleteLocation(location.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Move this location to the Recycle Bin?"
          message="You can restore it later from the Recycle Bin."
          confirmLabel="Move to Bin"
          onConfirm={performDeleteLocation}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {showBin && (
        <HomeRecycleBinDialog
          forms={trashedLocations}
          loading={loadingBin}
          onRestore={restoreLocation}
          onPermanentDelete={(formId) => setPendingBinConfirm({ type: 'permanentDelete', formId })}
          onEmptyBin={() => trashedLocations.length > 0 && setPendingBinConfirm({ type: 'emptyBin' })}
          onClose={() => setShowBin(false)}
        />
      )}

      {pendingBinConfirm && (
        <ConfirmDialog
          title={pendingBinConfirm.type === 'emptyBin' ? 'Empty Recycle Bin?' : 'Permanently delete this location?'}
          message={
            pendingBinConfirm.type === 'emptyBin'
              ? `Permanently delete all ${trashedLocations.length} location(s) in the bin, along with their records? This cannot be undone.`
              : 'This will permanently delete this location and all of its records. This cannot be undone.'
          }
          confirmLabel="Delete"
          danger
          onConfirm={handleBinConfirm}
          onCancel={() => setPendingBinConfirm(null)}
        />
      )}

      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '380px', maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 0.4rem' }}>Name this location</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              A new, independent "{template.name}" - its own menu and its own orders.
            </p>
            <form onSubmit={confirmAddLocation}>
              <input
                type="text" required autoFocus value={locationNameInput}
                onChange={(e) => setLocationNameInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateLocations
