import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'
import HomeRecycleBinDialog from './HomeRecycleBinDialog'
import { useRecycleBinTrigger } from './RecycleBinContext'

const PAGE_SIZE = 8

const FORM_STATE = {
  draft: { label: 'Draft', tone: 'draft' },
  published: { label: 'Live', tone: 'live' },
  paused: { label: 'Paused', tone: 'paused' },
  archived: { label: 'Archived', tone: 'archived' },
}

function getFormState(status) {
  return FORM_STATE[status] || FORM_STATE.draft
}

function FormStateBadge({ status }) {
  const state = getFormState(status)
  return <span className={`form-state-badge ${state.tone}`}>{state.label}</span>
}

function FormMeta({ form }) {
  return (
    <div className="form-card-meta">
      <span>{form.fields?.length || 0} field{form.fields?.length !== 1 ? 's' : ''}</span>
      <span>Created {new Date(form.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
    </div>
  )
}



function PinIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9a9a9a"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.4-1.4A2 2 0 0 1 17 14.2V9a5 5 0 0 0-10 0v5.2a2 2 0 0 1-.6 1.4L5 17z" />
    </svg>
  )
}

function FieldsIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function CalendarIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

// Response-count breakpoints: which action is most useful to a form owner
// changes as a form matures, so the primary button on published cards
// adapts instead of always being the same static link.
function getContextualAction(formId, responseCounts) {
  const count = responseCounts[formId] || 0
  if (count === 0) return 'copyLink'
  if (count < 10) return 'records'
  return 'reports'
}

function Home() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const { setTrigger } = useRecycleBinTrigger()
  const [forms, setForms] = useState([])
  const [demoForm, setDemoForm] = useState(null)
  const [responseCounts, setResponseCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('verticals_view_mode') || 'grid')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [pendingConfirm, setPendingConfirm] = useState(null) // { type: 'moveToBin', formId } | { type: 'bulkMoveToBin' } | { type: 'permanentDelete', formId } | { type: 'emptyBin' }
  const [selectedFormIds, setSelectedFormIds] = useState([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [trashedForms, setTrashedForms] = useState([])
  const [loadingBin, setLoadingBin] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    async function loadForms() {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })

      const { count: trashCount } = await supabase
        .from('forms')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .not('deleted_at', 'is', null)
      setBinCount(trashCount || 0)

      if (error) {
        setError('Could not load forms: ' + error.message)
      } else {
        // Secondary forms created as part of a bundle template (e.g.
        // Salary Events, alongside its primary Employees form) carry
        // settings.primaryFormId and are reached from the primary form's
        // context instead of cluttering the main list as their own cards.
        const visibleForms = data.filter(f => !f.settings?.primaryFormId)
        setForms(visibleForms)

        // One batched query for all forms' response counts, instead of a
        // separate count query per card, cheaper and avoids a waterfall
        // of requests as the number of forms grows.
        const formIds = visibleForms.map(f => f.id)
        if (formIds.length > 0) {
          const { data: subsData, error: subsError } = await supabase
            .from('submissions')
            .select('form_id')
            .in('form_id', formIds)
            .is('deleted_at', null)

          if (!subsError && subsData) {
            const counts = {}
            subsData.forEach(s => { counts[s.form_id] = (counts[s.form_id] || 0) + 1 })
            setResponseCounts(counts)
          }
        }

        // Only fetch the demo form separately if the user doesn't already
        // own it themselves (avoids showing it twice).
        const ownedDemo = data.find(f => f.is_demo)
        if (ownedDemo) {
          setDemoForm(ownedDemo)
        } else {
          const { data: demoData, error: demoError } = await supabase
            .from('forms')
            .select('*')
            .eq('is_demo', true)
            .maybeSingle()

          if (!demoError && demoData) {
            setDemoForm(demoData)
          }
        }
      }
      setLoading(false)
    }
    loadForms()
  }, [session])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  // Publishes the bin's open handler + count to NavBar, which renders the
  // actual button. NavBar isn't a descendant of Home, so it can't call
  // openBin() directly. Clear the trigger on unmount so the button
  // disappears once you navigate away from a page that owns a bin.
  useEffect(() => {
    setTrigger({ onOpen: openBin, count: binCount })
    return () => setTrigger(null)
  }, [binCount])

  function changeViewMode(mode) {
    setViewMode(mode)
    localStorage.setItem('verticals_view_mode', mode)
  }

  function copyLink(formId) {
    const url = `${window.location.origin}/form/${formId}`
    navigator.clipboard.writeText(url)
    showToast('Form link copied!', 'success')
  }

  async function publishForm(formId) {
    const { error } = await supabase.from('forms').update({ status: 'published' }).eq('id', formId)
    if (!error) {
      setForms(forms.map(f => f.id === formId ? { ...f, status: 'published' } : f))
    }
  }

  async function setFormStatus(formId, status) {
    const { error } = await supabase.from('forms').update({ status }).eq('id', formId)
    if (!error) {
      setForms(current => current.map(form => form.id === formId ? { ...form, status } : form))
    }
  }

  async function duplicateForm(form) {
    const { data, error } = await supabase.from('forms').insert([{
      name: `${form.name} (Copy)`, fields: form.fields, status: 'draft', user_id: session.user.id,
    }]).select().single()
    if (!error && data) {
      setForms(current => [data, ...current])
    }
    setOpenMenuId(null)
  }

  async function togglePin(formId, currentlyPinned) {
    const { error } = await supabase.from('forms').update({ pinned: !currentlyPinned }).eq('id', formId)
    if (!error) {
      setForms(forms.map(f => f.id === formId ? { ...f, pinned: !currentlyPinned } : f))
    }
  }

  function requestDelete(formId) {
    setOpenMenuId(null)
    setPendingConfirm({ type: 'moveToBin', formId })
  }

  function requestBulkDelete() {
    if (selectedFormIds.length === 0) return
    setPendingConfirm({ type: 'bulkMoveToBin' })
  }

  function toggleSelectForm(formId) {
    setSelectedFormIds(current => current.includes(formId) ? current.filter(id => id !== formId) : [...current, formId])
  }

  function enterSelectionMode() {
    setOpenMenuId(null)
    setSelectionMode(true)
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedFormIds([])
  }

  async function moveFormsToBin(formIds) {
    const { data, error } = await supabase
      .from('forms')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', formIds)
      .select('id')

    if (error) {
      showToast('Could not delete: ' + error.message, 'error')
      return
    }
    const deletedIds = (data || []).map(d => d.id)
    if (deletedIds.length === 0) {
      showToast('These forms could not be deleted, you may not have permission to remove them.', 'error')
      return
    }
    setForms(current => current.filter(f => !deletedIds.includes(f.id)))
    setSelectedFormIds(current => current.filter(id => !deletedIds.includes(id)))
    setBinCount(count => count + deletedIds.length)
    showToast(deletedIds.length === 1 ? 'Form moved to Recycle Bin.' : `${deletedIds.length} forms moved to Recycle Bin.`, 'success')
  }

  async function openBin() {
    setShowBin(true)
    setLoadingBin(true)
    const { data, error } = await supabase
      .from('forms').select('*')
      .eq('user_id', session.user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (!error) setTrashedForms(data || [])
    setLoadingBin(false)
  }

  async function restoreForm(formId) {
    const { data, error } = await supabase
      .from('forms')
      .update({ deleted_at: null })
      .eq('id', formId)
      .select()
      .single()

    if (error) {
      showToast('Could not restore form: ' + error.message, 'error')
      return
    }
    setTrashedForms(current => current.filter(f => f.id !== formId))
    setForms(current => [data, ...current])
    setBinCount(count => Math.max(0, count - 1))
    showToast('Form restored.', 'success')
  }

  function requestPermanentDelete(formId) {
    setPendingConfirm({ type: 'permanentDelete', formId })
  }

  async function performPermanentDelete(formId) {
    const { error } = await supabase.from('forms').delete().eq('id', formId)
    if (error) {
      showToast('Could not permanently delete: ' + error.message, 'error')
      return
    }
    setTrashedForms(current => current.filter(f => f.id !== formId))
    setBinCount(count => Math.max(0, count - 1))
    showToast('Form permanently deleted.', 'success')
  }

  function requestEmptyBin() {
    if (trashedForms.length === 0) return
    setPendingConfirm({ type: 'emptyBin' })
  }

  async function performEmptyBin() {
    const ids = trashedForms.map(f => f.id)
    const { error } = await supabase.from('forms').delete().in('id', ids)
    if (error) {
      showToast('Could not empty the bin: ' + error.message, 'error')
      return
    }
    setTrashedForms([])
    setBinCount(0)
    showToast('Recycle Bin emptied.', 'success')
  }

  function handleConfirm() {
    const confirm = pendingConfirm
    setPendingConfirm(null)
    if (!confirm) return
    if (confirm.type === 'moveToBin') moveFormsToBin([confirm.formId])
    else if (confirm.type === 'bulkMoveToBin') moveFormsToBin(selectedFormIds)
    else if (confirm.type === 'permanentDelete') performPermanentDelete(confirm.formId)
    else if (confirm.type === 'emptyBin') performEmptyBin()
  }

  const visible = forms.filter(form =>
    form.name.toLowerCase().includes(searchText.toLowerCase())
  )

  const pinnedForms = visible.filter(f => f.pinned)
  const unpinnedForms = visible.filter(f => !f.pinned)

  const totalPages = Math.max(1, Math.ceil(unpinnedForms.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageForms = unpinnedForms.slice(startIndex, startIndex + PAGE_SIZE)

  const sharedProps = {
    togglePin, publishForm, setFormStatus, duplicateForm, copyLink, requestDelete, responseCounts,
    selectedFormIds, toggleSelectForm, selectionMode, enterSelectionMode,
  }
  const formPendingDelete = forms.find(f => f.id === pendingConfirm?.formId)

  return (
    <div className="page">
      <style>{`
        .form-grid-card { transition: border-color 0.15s ease, background-color 0.15s ease; }
        .form-grid-card:hover { border-color: var(--color-primary); }
        .form-grid-card.selected { border-color: var(--color-primary); background: var(--color-primary-soft); }
        .form-list-row { transition: background-color 0.15s ease; }
        .form-list-row:hover { background: var(--color-bg); }
        .form-list-row:last-child { border-bottom: none !important; }
      `}</style>

      <div className="toolbar-row" style={{ justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Your Forms</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <button
              onClick={() => changeViewMode('list')}
              className={viewMode === 'list' ? '' : 'secondary'}
              style={{ borderRadius: 0, border: 'none', padding: '0.5rem 0.8rem' }}
              title="List view"
            >
              ☰
            </button>
            <button
              onClick={() => changeViewMode('grid')}
              className={viewMode === 'grid' ? '' : 'secondary'}
              style={{ borderRadius: 0, border: 'none', padding: '0.5rem 0.8rem' }}
              title="Grid view"
            >
              ▦
            </button>
          </div>
          <Link to="/create">
            <button>+ New Form</button>
          </Link>
        </div>
      </div>

      {!loading && demoForm && (
        <div className="card" style={{ padding: '1.2rem 1.5rem', marginBottom: '1.5rem', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <PinIcon size={13} />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Try Demo</span>
          </div>
          <p style={{ margin: '0 0 0.9rem 0', color: 'var(--color-muted)', fontSize: '0.88rem' }}>
            Explore "{demoForm.name}", a fully built example with real submissions, so you can see what records and reports look like once a form has been collecting data for a while.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to={`/form/${demoForm.id}/records`}><button className="secondary">View Records</button></Link>
            <Link to={`/form/${demoForm.id}/report`}><button>View Report</button></Link>
            <Link to={`/form/${demoForm.id}`}><button className="secondary">Open Form</button></Link>
          </div>
        </div>
      )}

      {selectionMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem',
          padding: '0.6rem 1rem', background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius)'
        }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedFormIds.length} selected</span>
          <button className="secondary" style={{ color: '#c0392b' }} disabled={selectedFormIds.length === 0} onClick={requestBulkDelete}>
            Delete Selected
          </button>
          <button className="secondary" onClick={exitSelectionMode}>Cancel</button>
        </div>
      )}

      {loading && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && forms.length === 0 && (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <p>You haven't created any forms yet.</p>
          <Link to="/create"><button style={{ marginTop: '0.5rem' }}>Create your first form</button></Link>
        </div>
      )}

      {!loading && forms.length > 0 && (
        <>
          <input
            type="text"
            placeholder="Search forms..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1) }}
            style={{ width: '100%', maxWidth: '280px', marginBottom: '1.2rem' }}
          />

          {visible.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No forms match "{searchText}".</p>
          ) : (
            <>
              {pinnedForms.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem' }}>
                    <PinIcon size={13} />
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Pinned
                    </h3>
                  </div>
                  {viewMode === 'list' ? (
                    <ListView
                      pageForms={pinnedForms}
                      {...sharedProps}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      menuRef={menuRef}
                    />
                  ) : (
                    <GridView
                      pageForms={pinnedForms}
                      {...sharedProps}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      menuRef={menuRef}
                    />
                  )}
                </div>
              )}

              {unpinnedForms.length > 0 && (
                <div>
                  {pinnedForms.length > 0 && (
                    <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '0.95rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      All Forms
                    </h3>
                  )}
                  {viewMode === 'list' ? (
                    <ListView
                      pageForms={pageForms}
                      {...sharedProps}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      menuRef={menuRef}
                    />
                  ) : (
                    <GridView
                      pageForms={pageForms}
                      {...sharedProps}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      menuRef={menuRef}
                    />
                  )}

                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                      <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                        Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, unpinnedForms.length)} of {unpinnedForms.length}
                      </span>
                      <button className="secondary" disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}>
                        Previous
                      </button>
                      <span style={{ fontSize: '0.9rem' }}>Page {safePage} of {totalPages}</span>
                      <button className="secondary" disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {showBin && (
        <HomeRecycleBinDialog
          forms={trashedForms}
          loading={loadingBin}
          onRestore={restoreForm}
          onPermanentDelete={requestPermanentDelete}
          onEmptyBin={requestEmptyBin}
          onClose={() => setShowBin(false)}
        />
      )}

      {pendingConfirm && (
        <ConfirmDialog
          title={
            pendingConfirm.type === 'moveToBin' ? 'Move this form to the Recycle Bin?' :
            pendingConfirm.type === 'bulkMoveToBin' ? 'Move selected forms to the Recycle Bin?' :
            pendingConfirm.type === 'emptyBin' ? 'Empty Recycle Bin?' :
            'Permanently delete this form?'
          }
          message={
            pendingConfirm.type === 'moveToBin'
              ? `"${formPendingDelete?.name || 'This form'}" will move to the Recycle Bin. You can restore it later.`
              : pendingConfirm.type === 'bulkMoveToBin'
              ? `${selectedFormIds.length} form${selectedFormIds.length !== 1 ? 's' : ''} will move to the Recycle Bin. You can restore them later.`
              : pendingConfirm.type === 'emptyBin'
              ? `Permanently delete all ${trashedForms.length} form(s) in the bin, along with their records? This cannot be undone.`
              : 'This will permanently delete this form and all of its records. This cannot be undone.'
          }
          confirmLabel={pendingConfirm.type === 'moveToBin' || pendingConfirm.type === 'bulkMoveToBin' ? 'Move to Bin' : 'Delete'}
          danger={pendingConfirm.type !== 'moveToBin' && pendingConfirm.type !== 'bulkMoveToBin'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}

function ListView({ pageForms, togglePin, publishForm, setFormStatus, duplicateForm, copyLink, requestDelete, selectedFormIds, toggleSelectForm, selectionMode, enterSelectionMode, openMenuId, setOpenMenuId, menuRef }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {pageForms.map(form => {
        const selected = selectedFormIds.includes(form.id)
        return (
        <div key={form.id} className="form-state-card form-list-row" style={{
          padding: '0.75rem 1.1rem', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem',
          borderBottom: '1px solid var(--color-border)',
          background: selected ? 'var(--color-primary-soft)' : 'transparent'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            {selectionMode && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleSelectForm(form.id)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {form.pinned && (
                <span title="Pinned"><PinIcon /></span>
              )}
              <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>{form.name}</span>
              <FormStateBadge status={form.status} />
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              {form.fields?.length || 0} field{form.fields?.length !== 1 ? 's' : ''} · Created {new Date(form.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            </div>
          </div>

          {/* Desktop: full row of individual action buttons */}
          <div className="list-actions-desktop" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            {form.status === 'draft' && (
              <button onClick={() => publishForm(form.id)}>Publish</button>
            )}
            {form.status === 'draft' ? (
              <>
                <Link to={`/form/${form.id}/edit`}><button className="secondary">Edit</button></Link>
                <Link to={`/form/${form.id}`}><button className="secondary">Preview</button></Link>
              </>
            ) : form.status === 'published' ? (
              <>
                <button className="secondary" onClick={() => copyLink(form.id)}>Copy Link</button>
                <Link to={`/form/${form.id}`}><button className="secondary">View Form</button></Link>
                <Link to={`/form/${form.id}/records`}><button className="secondary">Records</button></Link>
                <Link to={`/form/${form.id}/report`}><button className="secondary">Reports</button></Link>
              </>
            ) : form.status === 'paused' ? (
              <>
                <button onClick={() => setFormStatus(form.id, 'published')}>Resume</button>
                <Link to={`/form/${form.id}`}><button className="secondary">View Form</button></Link>
                <Link to={`/form/${form.id}/records`}><button className="secondary">Records</button></Link>
                <Link to={`/form/${form.id}/report`}><button className="secondary">Reports</button></Link>
                <Link to={`/form/${form.id}/edit`}><button className="secondary">Edit</button></Link>
              </>
            ) : (
              <>
                <Link to={`/form/${form.id}/records`}><button className="secondary">View Records</button></Link>
                <Link to={`/form/${form.id}/report`}><button className="secondary">Reports</button></Link>
                <button className="secondary" onClick={() => setFormStatus(form.id, 'paused')}>Restore</button>
              </>
            )}

            <div style={{ position: 'relative' }} ref={openMenuId === `d-${form.id}` ? menuRef : null}>
              <button
                className="secondary"
                onClick={() => setOpenMenuId(openMenuId === `d-${form.id}` ? null : `d-${form.id}`)}
                title="More options"
              >
                ⋮
              </button>

              {openMenuId === `d-${form.id}` && (
                <div className="dropdown-panel" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                  background: 'white', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  zIndex: 20, minWidth: '120px', overflow: 'hidden'
                }}>
                  {form.status === 'published' && <MenuItem onClick={() => { setFormStatus(form.id, 'paused'); setOpenMenuId(null) }}>Pause</MenuItem>}
                  {(form.status === 'published' || form.status === 'paused') && <MenuItem onClick={() => { setFormStatus(form.id, 'archived'); setOpenMenuId(null) }}>Archive</MenuItem>}
                  <MenuItem onClick={() => duplicateForm(form)}>Duplicate</MenuItem>
                  <MenuItem onClick={() => { togglePin(form.id, form.pinned); setOpenMenuId(null) }}>{form.pinned ? 'Unpin' : 'Pin'}</MenuItem>
                  <MenuItem onClick={enterSelectionMode}>Select</MenuItem>
                  <MenuItem danger onClick={() => requestDelete(form.id)}>Delete</MenuItem>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: just the primary action plus an overflow menu for everything else */}
          <div className="list-actions-mobile" style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            {form.status === 'draft' ? (
              <button style={{ flex: 1 }} onClick={() => publishForm(form.id)}>Publish</button>
            ) : form.status === 'paused' ? (
              <button style={{ flex: 1 }} onClick={() => setFormStatus(form.id, 'published')}>Resume</button>
            ) : form.status === 'archived' ? (
              <button className="secondary" style={{ flex: 1 }} onClick={() => setFormStatus(form.id, 'paused')}>Restore</button>
            ) : (
              <span style={{ flex: 1, color: 'var(--color-muted)', fontSize: '0.82rem', alignSelf: 'center' }}>Live and accepting responses</span>
            )}

            <div style={{ position: 'relative' }} ref={openMenuId === `m-${form.id}` ? menuRef : null}>
              <button
                className="secondary"
                onClick={() => setOpenMenuId(openMenuId === `m-${form.id}` ? null : `m-${form.id}`)}
                title="More options"
              >
                ⋮
              </button>

              {openMenuId === `m-${form.id}` && (
                <div className="dropdown-panel" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                  background: 'white', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  zIndex: 20, minWidth: '150px', overflow: 'hidden'
                }}>
                  <Link to={`/form/${form.id}/edit`} style={{ display: 'block' }}>
                    <MenuItem>Edit</MenuItem>
                  </Link>
                  <Link to={`/form/${form.id}`} style={{ display: 'block' }}>
                    <MenuItem>View Form</MenuItem>
                  </Link>
                  <MenuItem onClick={() => { copyLink(form.id); setOpenMenuId(null) }}>Copy Link</MenuItem>
                  <Link to={`/form/${form.id}/records`} style={{ display: 'block' }}>
                    <MenuItem>Records</MenuItem>
                  </Link>
                  <Link to={`/form/${form.id}/report`} style={{ display: 'block' }}>
                    <MenuItem>Reports</MenuItem>
                  </Link>
                  <MenuItem onClick={() => { togglePin(form.id, form.pinned); setOpenMenuId(null) }}>
                    {form.pinned ? 'Unpin' : 'Pin'}
                  </MenuItem>
                  {form.status === 'published' && <MenuItem onClick={() => { setFormStatus(form.id, 'paused'); setOpenMenuId(null) }}>Pause</MenuItem>}
                  {(form.status === 'published' || form.status === 'paused') && <MenuItem onClick={() => { setFormStatus(form.id, 'archived'); setOpenMenuId(null) }}>Archive</MenuItem>}
                  <MenuItem onClick={() => duplicateForm(form)}>Duplicate</MenuItem>
                  <MenuItem onClick={enterSelectionMode}>Select</MenuItem>
                  <MenuItem danger onClick={() => requestDelete(form.id)}>Delete</MenuItem>
                </div>
              )}
            </div>
          </div>
        </div>
        )
      })}
    </div>
  )
}

function GridView({ pageForms, togglePin, publishForm, setFormStatus, duplicateForm, copyLink, requestDelete, responseCounts, selectedFormIds, toggleSelectForm, selectionMode, enterSelectionMode, openMenuId, setOpenMenuId, menuRef }) {
  return (
    <div className="form-grid" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '1rem'
    }}>
      {pageForms.map(form => {
        const selected = selectedFormIds.includes(form.id)
        return (
        <div
          key={form.id}
          className={`form-state-card form-grid-card${selected ? ' selected' : ''}`}
          style={{
            padding: '0.9rem', display: 'flex', flexDirection: 'column',
            gap: '0.5rem', position: 'relative', height: '100%',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 0, boxShadow: 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              {selectionMode && (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelectForm(form.id)}
                />
              )}
              {form.pinned && (
                <span title="Pinned"><PinIcon size={12} /></span>
              )}
              <div style={{
                fontWeight: '700', fontSize: '1rem', lineHeight: 1.25,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {form.name}
              </div>
            </div>

            <div style={{ position: 'relative', flexShrink: 0 }} ref={openMenuId === form.id ? menuRef : null}>
              <button
                className="secondary"
                onClick={() => setOpenMenuId(openMenuId === form.id ? null : form.id)}
                style={{ padding: '0.2rem 0.5rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ⋮
              </button>

              {openMenuId === form.id && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                  background: 'white', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  zIndex: 20, minWidth: '150px', overflow: 'hidden'
                }}>
                  {form.status === 'draft' && (
                    <MenuItem onClick={() => { publishForm(form.id); setOpenMenuId(null) }}>Publish</MenuItem>
                  )}
                  <MenuItem onClick={() => { togglePin(form.id, form.pinned); setOpenMenuId(null) }}>
                    {form.pinned ? 'Unpin' : 'Pin'}
                  </MenuItem>
                  <Link to={`/form/${form.id}/edit`} style={{ display: 'block' }}>
                    <MenuItem>Edit</MenuItem>
                  </Link>
                  <MenuItem onClick={() => { copyLink(form.id); setOpenMenuId(null) }}>Copy Link</MenuItem>
                  <Link to={`/form/${form.id}/records`} style={{ display: 'block' }}>
                    <MenuItem>Records</MenuItem>
                  </Link>
                  <Link to={`/form/${form.id}/report`} style={{ display: 'block' }}>
                    <MenuItem>Reports</MenuItem>
                  </Link>
                  <Link to={`/form/${form.id}`} style={{ display: 'block' }}>
                    <MenuItem>View Form</MenuItem>
                  </Link>
                  {form.status === 'published' && <MenuItem onClick={() => { setFormStatus(form.id, 'paused'); setOpenMenuId(null) }}>Pause</MenuItem>}
                  {(form.status === 'published' || form.status === 'paused') && <MenuItem onClick={() => { setFormStatus(form.id, 'archived'); setOpenMenuId(null) }}>Archive</MenuItem>}
                  <MenuItem onClick={() => duplicateForm(form)}>Duplicate</MenuItem>
                  <MenuItem onClick={enterSelectionMode}>Select</MenuItem>
                  <MenuItem danger onClick={() => requestDelete(form.id)}>Delete</MenuItem>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'inline-flex' }}>
            <span style={{ padding: '0.15rem 0.5rem' }} className={`form-state-badge ${getFormState(form.status).tone}`}>
              {getFormState(form.status).label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-muted)', fontSize: '0.78rem' }}>
            <FieldsIcon size={11} />
            {form.fields?.length || 0} field{form.fields?.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-muted)', fontSize: '0.72rem' }}>
            <CalendarIcon size={11} />
            {new Date(form.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
            {form.status === 'draft' && <button style={{ width: '100%' }} onClick={() => publishForm(form.id)}>Publish</button>}
            {form.status === 'paused' && <button style={{ width: '100%' }} onClick={() => setFormStatus(form.id, 'published')}>Resume</button>}
            {form.status === 'archived' && <button className="secondary" style={{ width: '100%' }} onClick={() => setFormStatus(form.id, 'paused')}>Restore</button>}

            {form.status === 'published' && (() => {
              const action = getContextualAction(form.id, responseCounts)
              if (action === 'copyLink') {
                return <button style={{ width: '100%' }} onClick={() => copyLink(form.id)}>Copy Link</button>
              }
              if (action === 'records') {
                return <Link to={`/form/${form.id}/records`}><button style={{ width: '100%' }}>Records</button></Link>
              }
              return <Link to={`/form/${form.id}/report`}><button style={{ width: '100%' }}>Reports</button></Link>
            })()}
          </div>
        </div>
        )
      })}
    </div>
  )
}

function MenuItem({ children, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.6rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer',
        color: danger ? '#c0392b' : 'inherit'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
  )
}

export default Home