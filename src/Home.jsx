import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import ConfirmDialog from './ConfirmDialog'

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

// Approximate the same hues used by the .form-state-badge CSS classes, for
// the card's left accent border — adjust these if they drift from the
// actual badge colors defined in your stylesheet.
const STATUS_ACCENT = {
  draft: '#d97706',
  published: '#16a34a',
  paused: '#6b7280',
  archived: '#9ca3af',
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
  const [forms, setForms] = useState([])
  const [demoForm, setDemoForm] = useState(null)
  const [responseCounts, setResponseCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('verticals_view_mode') || 'grid')
  const [demoCollapsed, setDemoCollapsed] = useState(() => localStorage.getItem('verticals_demo_collapsed') === 'true')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    async function loadForms() {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('user_id', session.user.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        setError('Could not load forms: ' + error.message)
      } else {
        setForms(data)

        // One batched query for all forms' response counts, instead of a
        // separate count query per card — cheaper and avoids a waterfall
        // of requests as the number of forms grows.
        const formIds = data.map(f => f.id)
        if (formIds.length > 0) {
          const { data: subsData, error: subsError } = await supabase
            .from('submissions')
            .select('form_id')
            .in('form_id', formIds)

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

  function changeViewMode(mode) {
    setViewMode(mode)
    localStorage.setItem('verticals_view_mode', mode)
  }

  function toggleDemoCollapsed() {
    const next = !demoCollapsed
    setDemoCollapsed(next)
    localStorage.setItem('verticals_demo_collapsed', String(next))
  }

  function copyLink(formId) {
    const url = `${window.location.origin}/form/${formId}`
    navigator.clipboard.writeText(url)
    alert('Form link copied!')
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
    setConfirmDeleteId(formId)
  }

  async function confirmDelete() {
    const formId = confirmDeleteId
    setConfirmDeleteId(null)
    const { error } = await supabase.from('forms').delete().eq('id', formId)
    if (!error) {
      setForms(forms.filter(f => f.id !== formId))
    }
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

  const sharedProps = { togglePin, publishForm, setFormStatus, duplicateForm, copyLink, requestDelete, responseCounts }
  const formPendingDelete = forms.find(f => f.id === confirmDeleteId)

  return (
    <div className="page">
      <style>{`
        .form-grid-card { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        .form-grid-card:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.10); border-color: var(--color-primary); }
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

      {!loading && demoForm && (
        <div style={{ marginTop: '2.5rem' }}>
          <div
            onClick={toggleDemoCollapsed}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}
            title={demoCollapsed ? 'Expand' : 'Collapse'}
          >
            <span style={{
              display: 'inline-block', fontSize: '0.7rem', color: 'var(--color-muted)',
              transform: demoCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s'
            }}>
              ▾
            </span>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Try a Demo
            </h3>
          </div>

          {!demoCollapsed && (
            <>
              <p style={{ margin: '0 0 0.9rem 0', color: 'var(--color-muted)', fontSize: '0.9rem', maxWidth: '520px' }}>
                Explore a fully built example form with real submissions, see what records and reports look like once a form has been collecting data for a while.
              </p>
              <div className="card" style={{
                padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.05rem' }}>{demoForm.name}</div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {demoForm.fields?.length || 0} field{demoForm.fields?.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Link to={`/form/${demoForm.id}/records`}><button className="secondary">View Records</button></Link>
                  <Link to={`/form/${demoForm.id}/report`}><button className="secondary">View Report</button></Link>
                  <Link to={`/form/${demoForm.id}`}><button>Open Form</button></Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete this form?"
          message={`This will permanently delete "${formPendingDelete?.name || 'this form'}" and all of its records. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}

function ListView({ pageForms, togglePin, publishForm, setFormStatus, duplicateForm, copyLink, requestDelete, openMenuId, setOpenMenuId, menuRef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      {pageForms.map(form => (
        <div key={form.id} className="card form-state-card" style={{
          padding: '0.95rem 1.2rem', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem'
        }}>
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
                  {form.status === 'draft' && <MenuItem danger onClick={() => requestDelete(form.id)}>Delete</MenuItem>}
                  {form.status === 'published' && <MenuItem onClick={() => { setFormStatus(form.id, 'paused'); setOpenMenuId(null) }}>Pause</MenuItem>}
                  {form.status === 'published' && <MenuItem onClick={() => { setFormStatus(form.id, 'archived'); setOpenMenuId(null) }}>Archive</MenuItem>}
                  {form.status === 'paused' && <MenuItem onClick={() => { setFormStatus(form.id, 'archived'); setOpenMenuId(null) }}>Archive</MenuItem>}
                  {form.status === 'archived' && <MenuItem danger onClick={() => requestDelete(form.id)}>Delete permanently</MenuItem>}
                  <MenuItem onClick={() => duplicateForm(form)}>Duplicate</MenuItem>
                  <MenuItem onClick={() => { togglePin(form.id, form.pinned); setOpenMenuId(null) }}>{form.pinned ? 'Unpin' : 'Pin'}</MenuItem>
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
                  {(form.status === 'draft' || form.status === 'archived') && <MenuItem danger onClick={() => requestDelete(form.id)}>{form.status === 'archived' ? 'Delete permanently' : 'Delete'}</MenuItem>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function GridView({ pageForms, togglePin, publishForm, setFormStatus, duplicateForm, copyLink, requestDelete, responseCounts, openMenuId, setOpenMenuId, menuRef }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '1rem'
    }}>
      {pageForms.map(form => (
        <div key={form.id} className="card form-state-card form-grid-card" style={{
          padding: '0.9rem', display: 'flex', flexDirection: 'column',
          gap: '0.5rem', position: 'relative', height: '100%',
          borderLeft: `3px solid ${STATUS_ACCENT[form.status] || STATUS_ACCENT.draft}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
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
                  {(form.status === 'draft' || form.status === 'archived') && <MenuItem danger onClick={() => requestDelete(form.id)}>{form.status === 'archived' ? 'Delete permanently' : 'Delete'}</MenuItem>}
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
      ))}
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