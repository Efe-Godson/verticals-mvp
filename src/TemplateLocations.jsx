// Place at: src/TemplateLocations.jsx
// One template's "home page": every location (fully independent form -
// own menu, own orders, own records) created from this template, plus
// "+ Add Location" for the next one. Reached from BusinessesHome.jsx's
// grid, or from Templates.jsx's "Manage" once a template is already in use.
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'
import HomeRecycleBinDialog from './HomeRecycleBinDialog'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { categoryColor, LocationIcon } from './templateVisuals'
import { createLocationForm, duplicateLocationForm, locationDestination } from './locations'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'
import { usePageTitle } from './PageTitleContext'

// Options menu (⋮) matches BusinessesHome.jsx's BusinessTile exactly, just
// with Duplicate/logo actions added alongside Delete - the old "Manage
// Locations" modal (a single flat list with only Delete) is gone in favor
// of putting every action right on the card it acts on.
function LocationTile({ location, color, uploading, onManage, onDuplicate, onDelete, onLogoChange, onLogoRemove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const fileInputRef = useRef(null)
  const logoUrl = location.settings?.logoUrl

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
      {/* PNG only: the accept attribute is a picker hint, not enforcement
          (some OS pickers let you override it to "all files"), so the real
          check happens on the selected file itself, see handleLogoChange. */}
      <input
        ref={fileInputRef} type="file" accept="image/png" style={{ display: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const file = e.target.files[0]
          e.target.value = ''
          if (file) onLogoChange(file)
        }}
      />

      <div style={{ position: 'absolute', top: '0.4rem', right: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          title="More options"
          aria-label="More options"
          style={{
            width: '24px', height: '24px', padding: 0,
            borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-muted)',
            fontSize: '1rem', lineHeight: 1, cursor: 'pointer'
          }}
        >
          ⋮
        </button>
        {menuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setMenuOpen(false)} />
            <div className="dropdown-panel" style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '0.2rem',
              background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '150px', overflow: 'hidden'
            }}>
              <div
                onClick={() => { setMenuOpen(false); onDuplicate() }}
                style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left' }}
              >
                Duplicate
              </div>
              <div
                onClick={() => { setMenuOpen(false); fileInputRef.current?.click() }}
                style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left' }}
              >
                {logoUrl ? 'Change Logo' : 'Add Logo'}
              </div>
              {logoUrl && (
                <div
                  onClick={() => { setMenuOpen(false); onLogoRemove() }}
                  style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left' }}
                >
                  Remove Logo
                </div>
              )}
              <div
                onClick={() => { setMenuOpen(false); onDelete() }}
                style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', color: '#c0392b', textAlign: 'left' }}
              >
                Delete
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.2rem 0' }} />
              <div
                onClick={() => setMenuOpen(false)}
                style={{ padding: '0.55rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--color-muted)', textAlign: 'left' }}
              >
                Cancel
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{
        width: '44px', height: '44px', borderRadius: '10px', background: logoUrl ? 'transparent' : `${color}16`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
      }}>
        {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LocationIcon color={color} />}
      </div>
      <span style={{
        fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {location.settings?.locationName || location.name}
      </span>

      {uploading && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)',
        }}>
          Uploading…
        </div>
      )}
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

  usePageTitle(template?.name)

  const [showAddModal, setShowAddModal] = useState(false)
  const [locationNameInput, setLocationNameInput] = useState('')
  const [creating, setCreating] = useState(false)
  // Non-null while the "name this location" modal is duplicating an
  // existing one rather than creating a fresh one from the template -
  // holds just the source location's id (see duplicateLocationForm).
  const [duplicateSourceId, setDuplicateSourceId] = useState(null)

  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [pendingBinConfirm, setPendingBinConfirm] = useState(null) // { type: 'permanentDelete', formId } | { type: 'emptyBin' }
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [trashedLocations, setTrashedLocations] = useState([])
  const [loadingBin, setLoadingBin] = useState(false)
  const [uploadingLogoId, setUploadingLogoId] = useState(null)

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

  // Spread-merge into that one location's own settings bag, same convention
  // as Records.jsx/ReportBuilder.jsx's updateFormSettings - this page just
  // has several forms open at once instead of one, so it takes the
  // location explicitly rather than reading a single formRef.
  async function saveLocationSettings(location, patch) {
    const updatedSettings = { ...(location.settings || {}), ...patch }
    const { error } = await supabase.from('forms').update({ settings: updatedSettings }).eq('id', location.id)
    if (error) {
      showToast('Could not save: ' + error.message, 'error')
      return
    }
    setLocations(current => current.map(l => l.id === location.id ? { ...l, settings: updatedSettings } : l))
  }

  async function handleLogoChange(location, file) {
    // The file input's accept="image/png" is only a picker hint, not
    // enforcement - re-check the actual file before uploading anything.
    if (file.type !== 'image/png') {
      showToast('Only PNG logos are supported.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Logo must be under 5MB.', 'error')
      return
    }

    setUploadingLogoId(location.id)
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `logos/${location.id}/${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('form-uploads').upload(path, file)
    if (uploadError) {
      setUploadingLogoId(null)
      showToast('Could not upload the logo: ' + uploadError.message, 'error')
      return
    }

    const { data } = supabase.storage.from('form-uploads').getPublicUrl(path)
    await saveLocationSettings(location, { logoUrl: data.publicUrl })
    setUploadingLogoId(null)
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
    setDuplicateSourceId(null)
    setLocationNameInput(template.name)
    setShowAddModal(true)
  }

  function openDuplicateModal(location) {
    setDuplicateSourceId(location.id)
    setLocationNameInput(`${location.settings?.locationName || location.name} (Copy)`)
    setShowAddModal(true)
  }

  async function confirmAddLocation(e) {
    e.preventDefault()
    if (!locationNameInput.trim()) return
    setCreating(true)
    try {
      const form = duplicateSourceId
        ? await duplicateLocationForm({ session, sourceFormId: duplicateSourceId, locationName: locationNameInput })
        : await createLocationForm({ session, template, locationName: locationNameInput })
      showToast(`"${form.name}" ${duplicateSourceId ? 'duplicated' : 'created'}, customize it now.`, 'success')
      setShowAddModal(false)
      navigate(locationDestination(template, form.id))
    } catch (err) {
      showToast(`Could not ${duplicateSourceId ? 'duplicate' : 'create'} this location: ` + err.message, 'error')
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

      {/* The full page title/location count/"Manage Locations" header is
          gone (the nav bar's compact mobile title already shows the
          template name, see PageTitleContext.jsx, and Duplicate/Delete now
          live on each card's own ⋮ menu) - but dropping it entirely left no
          visible way back to All Businesses, since the mobile nav bar's
          hamburger reads as "menu", not "back". This compact link covers
          that without reintroducing the full header. */}
      <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', display: 'inline-block', marginBottom: '0.8rem' }}>
        ← All Businesses
      </Link>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
        {locations.map(location => (
          <LocationTile
            key={location.id}
            location={location}
            color={color}
            uploading={uploadingLogoId === location.id}
            onManage={() => navigate(locationDestination(template, location.id))}
            onDuplicate={() => openDuplicateModal(location)}
            onDelete={() => requestDeleteLocation(location.id)}
            onLogoChange={(file) => handleLogoChange(location, file)}
            onLogoRemove={() => saveLocationSettings(location, { logoUrl: null })}
          />
        ))}
        <AddLocationTile onClick={openAddModal} />
      </div>

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
            <h3 style={{ margin: '0 0 0.4rem' }}>{duplicateSourceId ? 'Name this duplicate' : 'Name this location'}</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              {duplicateSourceId
                ? 'A new, independent copy with the same menu and setup - no records or orders carry over.'
                : `A new, independent "${template.name}" - its own menu and its own orders.`}
            </p>
            <form onSubmit={confirmAddLocation}>
              <input
                type="text" required autoFocus value={locationNameInput}
                onChange={(e) => setLocationNameInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" disabled={creating}>{creating ? (duplicateSourceId ? 'Duplicating...' : 'Creating...') : (duplicateSourceId ? 'Duplicate' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateLocations
