import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import ConfirmDialog from './ConfirmDialog'

const PAGE_SIZE = 8



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

function Home() {
  const { session } = useAuth()
  const [forms, setForms] = useState([])
  const [demoForm, setDemoForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('verticals_view_mode') || 'list')
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

  const sharedProps = { togglePin, publishForm, copyLink, requestDelete }
  const formPendingDelete = forms.find(f => f.id === confirmDeleteId)

  return (
    <div className="page">
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

function ListView({ pageForms, togglePin, publishForm, copyLink, requestDelete, openMenuId, setOpenMenuId, menuRef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      {pageForms.map(form => (
        <div key={form.id} className="card" style={{
          padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {form.pinned && (
                <span title="Pinned"><PinIcon /></span>
              )}
              <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>{form.name}</span>
              <span style={{
                fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                background: form.status === 'published' ? '#e6f4ea' : '#fff4e5',
                color: form.status === 'published' ? '#1a7f37' : '#966300'
              }}>
                {form.status === 'published' ? 'Published' : 'Draft'}
              </span>
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
            <button className="secondary" onClick={() => togglePin(form.id, form.pinned)}>
              {form.pinned ? 'Unpin' : 'Pin'}
            </button>
            <Link to={`/form/${form.id}/edit`}><button className="secondary">Edit</button></Link>
            <button className="secondary" onClick={() => copyLink(form.id)}>Copy Link</button>
            <Link to={`/form/${form.id}/records`}><button className="secondary">Records</button></Link>
            <Link to={`/form/${form.id}/report`}><button className="secondary">Report</button></Link>
            <Link to={`/form/${form.id}`}><button>Open</button></Link>

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
                  <MenuItem danger onClick={() => requestDelete(form.id)}>Delete</MenuItem>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: just the primary action plus an overflow menu for everything else */}
          <div className="list-actions-mobile" style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <Link to={`/form/${form.id}`} style={{ flex: 1 }}><button style={{ width: '100%' }}>Open</button></Link>

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
                    <MenuItem>Report</MenuItem>
                  </Link>
                  <MenuItem danger onClick={() => requestDelete(form.id)}>Delete</MenuItem>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function GridView({ pageForms, togglePin, publishForm, copyLink, requestDelete, openMenuId, setOpenMenuId, menuRef }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '1rem'
    }}>
      {pageForms.map(form => (
        <div key={form.id} className="card" style={{
          padding: '1rem', display: 'flex', flexDirection: 'column',
          gap: '0.5rem', position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative' }} ref={openMenuId === form.id ? menuRef : null}>
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
                    <MenuItem>Report</MenuItem>
                  </Link>
                  <Link to={`/form/${form.id}`} style={{ display: 'block' }}>
                    <MenuItem>Open</MenuItem>
                  </Link>
                  <MenuItem danger onClick={() => requestDelete(form.id)}>Delete</MenuItem>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {form.pinned && (
              <span title="Pinned"><PinIcon size={12} /></span>
            )}
            <div style={{ fontWeight: '600', fontSize: '0.95rem', lineHeight: 1.3 }}>{form.name}</div>
          </div>

          <span style={{
            fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '4px', alignSelf: 'flex-start',
            background: form.status === 'published' ? '#e6f4ea' : '#fff4e5',
            color: form.status === 'published' ? '#1a7f37' : '#966300'
          }}>
            {form.status === 'published' ? 'Published' : 'Draft'}
          </span>

          <div style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>
            {form.fields?.length || 0} field{form.fields?.length !== 1 ? 's' : ''}
          </div>
          <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
            {new Date(form.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
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