import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { useCurrentPageTitle, useCurrentPageBack } from './PageTitleContext'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'

function NavBar() {
  const location = useLocation()
  const { session } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [linkedMenuOpen, setLinkedMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [isPayrollForm, setIsPayrollForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [linkedForms, setLinkedForms] = useState([]) // sibling forms in the same bundle, excluding self
  const { trigger: binTrigger } = useRecycleBinTrigger()
  const pageTitle = useCurrentPageTitle()
  const pageBack = useCurrentPageBack()

  // Edge-swipe-to-open, the same gesture iOS/Android drawers use: a touch
  // starting within EDGE_ZONE px of the left edge that moves right past
  // OPEN_THRESHOLD before it moves more vertically than horizontally (so it
  // doesn't fight a normal vertical scroll that happens to start near the
  // edge) opens the drawer. Document-level listeners since the point is
  // opening it from wherever you're reading, not just from the compact bar
  // itself - only armed while the drawer is closed, so it can't interfere
  // with touches inside the open drawer (its own ✕/backdrop/links close it).
  useEffect(() => {
    if (menuOpen) return
    const EDGE_ZONE = 24
    const OPEN_THRESHOLD = 60
    let startX = null
    let startY = null
    let armed = false

    function onTouchStart(e) {
      const touch = e.touches[0]
      armed = !!touch && touch.clientX <= EDGE_ZONE
      if (armed) { startX = touch.clientX; startY = touch.clientY }
    }

    function onTouchMove(e) {
      if (!armed) return
      const touch = e.touches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.abs(dy) > Math.abs(dx)) { armed = false; return }
      if (dx > OPEN_THRESHOLD) { setMenuOpen(true); armed = false }
    }

    function onTouchEnd() { armed = false }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [menuOpen])

  const isAdmin = session?.user?.id === TEMPLATE_ADMIN_USER_ID
  const displayName = session?.user?.user_metadata?.full_name || ''
  const initials = (displayName || session?.user?.email || '?').trim().slice(0, 1).toUpperCase()

  // Manually extract the form ID from paths like /form/abc-123/records
  const match = location.pathname.match(/^\/form\/([^/]+)/)
  const id = match ? match[1] : null
  const isFormContext = !!id

  // Lightweight settings-only lookup per form navigation, cheap enough not
  // to be worth a shared context for a couple of booleans/a short list.
  // Only Employees forms (Staff Payment Tracker) get a Payroll tab; any
  // form that's part of a bundle template (primary or secondary) gets a
  // Linked Forms menu, since secondary forms are hidden from Home's list
  // and this is otherwise the only way back to them.
  useEffect(() => {
    let cancelled = false
    if (!id) { setIsPayrollForm(false); setLinkedForms([]); setFormName(''); return }

    async function load() {
      const { data: current } = await supabase.from('forms').select('id, name, settings').eq('id', id).single()
      if (cancelled || !current) return
      setIsPayrollForm(current.settings?.payrollRole === 'employees')
      setFormName(current.name)

      const groupPrimaryId = current.settings?.primaryFormId || current.id
      const [{ data: primary }, { data: siblings }] = await Promise.all([
        groupPrimaryId !== current.id
          ? supabase.from('forms').select('id, name').eq('id', groupPrimaryId).is('deleted_at', null).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('forms').select('id, name').eq('settings->>primaryFormId', groupPrimaryId).is('deleted_at', null),
      ])
      if (cancelled) return

      const group = [primary, ...(siblings || [])].filter(f => f && f.id !== current.id)
      setLinkedForms(group)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  function linkColor(segment) {
    return location.pathname.includes(segment) ? 'var(--color-primary)' : 'var(--color-muted)'
  }

  // The compact mobile bar shows what you're actually looking at (a
  // business's name, a template's name) instead of just the app's own
  // brand name whenever there's something more specific to show - falls
  // back to "Verticals" on pages that never set one (Home, login, etc).
  // Form context wins when both are set, since it's the more specific of
  // the two (a form nested inside e.g. Templates' own registered title).
  const mobileBrand = (isFormContext && formName) || pageTitle || 'Verticals'

  return (
    <div style={{ background: 'white', borderBottom: '1px solid var(--color-border)' }}>
      {/* Full bar: the logo, every link inline, both dropdown buttons - this
          is a desktop layout (a row of horizontal text links plus a 30px
          avatar circle just doesn't fit a phone width) and is hidden below
          768px in favor of .navbar-mobile-row below, not just collapsed
          into a hamburger while staying visible itself. */}
      <div className="navbar-desktop-row" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        padding: '0.8rem 1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.05rem', flexShrink: 0 }}>Verticals</Link>

          <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.9rem' }}>
            <Link to="/" style={{ color: location.pathname === '/' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Home</Link>
            <Link to="/reports" style={{ color: location.pathname === '/reports' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Reports</Link>
            <Link to="/templates" style={{ color: location.pathname === '/templates' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Templates</Link>
            {isAdmin && (
              <Link to="/lab" style={{ color: location.pathname === '/lab' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Lab</Link>
            )}
          </div>

          {isFormContext && (
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
              <Link to="/" style={{ color: 'var(--color-muted)' }}>Home</Link>
              <Link to={`/form/${id}/edit`} style={{ color: linkColor('/edit') }}>Builder</Link>
              <Link to={`/form/${id}/records`} style={{ color: linkColor('/records') }}>Records</Link>
              <Link to={`/form/${id}/report`} style={{ color: linkColor('/report') }}>Report</Link>
              {isPayrollForm && <Link to={`/form/${id}/payroll`} style={{ color: linkColor('/payroll') }}>Payroll</Link>}
              <Link to={`/form/${id}/ai-analyst`} style={{ color: linkColor('/ai-analyst') }}>AI Analyst</Link>
              <Link to={`/form/${id}/settings`} style={{ color: linkColor('/settings') }}>Settings</Link>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {linkedForms.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button className="secondary" onClick={() => setLinkedMenuOpen(!linkedMenuOpen)}>
                Linked Forms ▾
              </button>
              {linkedMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setLinkedMenuOpen(false)} />
                  <div className="dropdown-panel" style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                    background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '180px', overflow: 'hidden', padding: 0
                  }}>
                    {linkedForms.map(f => (
                      <Link
                        key={f.id}
                        to={`/form/${f.id}/records`}
                        onClick={() => setLinkedMenuOpen(false)}
                        style={{ display: 'block', padding: '0.55rem 0.9rem', fontSize: '0.85rem', color: 'inherit' }}
                      >
                        {f.name}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              title="Account menu"
              aria-label="Account menu"
              style={{
                width: '30px', height: '30px', borderRadius: '50%', background: 'var(--color-primary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, padding: 0,
                outline: accountMenuOpen ? '2px solid var(--color-primary)' : 'none',
                outlineOffset: '2px'
              }}
            >
              {initials}
            </button>

            {accountMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setAccountMenuOpen(false)} />
                <div className="dropdown-panel" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                  background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '170px', overflow: 'hidden', padding: '0.3rem'
                }}>
                  <Link
                    to="/account"
                    onClick={() => setAccountMenuOpen(false)}
                    style={{ display: 'block', padding: '0.5rem 0.6rem', fontSize: '0.85rem', borderRadius: '6px', color: 'var(--color-text)' }}
                  >
                    Profile
                  </Link>
                  {binTrigger && (
                    <button
                      className="secondary"
                      onClick={() => { setAccountMenuOpen(false); binTrigger.onOpen() }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                        padding: '0.5rem 0.6rem', fontSize: '0.85rem'
                      }}
                    >
                      Recycle Bin{binTrigger.count > 0 ? ` (${binTrigger.count})` : ''}
                    </button>
                  )}
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.3rem 0' }} />
                  <button
                    className="secondary"
                    onClick={() => { setAccountMenuOpen(false); supabase.auth.signOut() }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                      padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: '#c0392b'
                    }}
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Compact bar: hidden on desktop, shown below 768px instead of the
          row above - just enough to open the drawer and know what app
          you're in, not a shrunk copy of the desktop nav. */}
      <div className="navbar-mobile-row">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          style={{
            width: '38px', height: '38px', padding: 0, borderRadius: '8px',
            background: 'var(--color-primary)', color: 'white', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '3px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <span style={{ width: '17px', height: '2px', background: 'white', borderRadius: '1px' }} />
          <span style={{ width: '17px', height: '2px', background: 'white', borderRadius: '1px' }} />
          <span style={{ width: '17px', height: '2px', background: 'white', borderRadius: '1px' }} />
        </button>
        <Link to="/" style={{ fontWeight: 'bold', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mobileBrand}
        </Link>

        {/* Right-hand back control - only for pages one level below the top
            that registered a destination via usePageBack (e.g.
            TemplateLocations.jsx -> "/"). The hamburger opens the general
            nav drawer, not "back", so a page like that needs its own way
            out beyond the drawer's own Home link. */}
        {pageBack && (
          <Link
            to={pageBack.to}
            aria-label={pageBack.label ? `Back to ${pageBack.label}` : 'Back'}
            style={{
              marginLeft: 'auto', flexShrink: 0, fontSize: '1.4rem', fontWeight: 800,
              color: 'var(--color-text)', lineHeight: 1, padding: '0.2rem',
            }}
          >
            ←
          </Link>
        )}
      </div>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }}
        />
      )}

      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: '250px', zIndex: 151,
          background: 'white', boxShadow: '2px 0 12px rgba(0,0,0,0.2)',
          transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease',
          padding: '1rem', overflowY: 'auto', fontSize: '0.9rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Verticals</span>
          <button
            onClick={() => setMenuOpen(false)} aria-label="Close menu"
            style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link to="/" style={{ color: location.pathname === '/' ? 'var(--color-primary)' : 'var(--color-text)' }} onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/reports" style={{ color: location.pathname === '/reports' ? 'var(--color-primary)' : 'var(--color-text)' }} onClick={() => setMenuOpen(false)}>Reports</Link>
          <Link to="/templates" style={{ color: location.pathname === '/templates' ? 'var(--color-primary)' : 'var(--color-text)' }} onClick={() => setMenuOpen(false)}>Templates</Link>
          {isAdmin && (
            <Link to="/lab" style={{ color: location.pathname === '/lab' ? 'var(--color-primary)' : 'var(--color-text)' }} onClick={() => setMenuOpen(false)}>Lab</Link>
          )}
          {binTrigger && (
            <button
              onClick={() => { setMenuOpen(false); binTrigger.onOpen() }}
              style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: 'var(--color-text)', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              Recycle Bin{binTrigger.count > 0 ? ` (${binTrigger.count})` : ''}
            </button>
          )}

          {isFormContext && (
            <>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.2rem 0' }} />
              <Link to={`/form/${id}/edit`} style={{ color: linkColor('/edit') }} onClick={() => setMenuOpen(false)}>Builder</Link>
              <Link to={`/form/${id}/records`} style={{ color: linkColor('/records') }} onClick={() => setMenuOpen(false)}>Records</Link>
              <Link to={`/form/${id}/report`} style={{ color: linkColor('/report') }} onClick={() => setMenuOpen(false)}>Report</Link>
              {isPayrollForm && <Link to={`/form/${id}/payroll`} style={{ color: linkColor('/payroll') }} onClick={() => setMenuOpen(false)}>Payroll</Link>}
              <Link to={`/form/${id}/ai-analyst`} style={{ color: linkColor('/ai-analyst') }} onClick={() => setMenuOpen(false)}>AI Analyst</Link>
              <Link to={`/form/${id}/settings`} style={{ color: linkColor('/settings') }} onClick={() => setMenuOpen(false)}>Settings</Link>
              {linkedForms.map(f => (
                <Link key={f.id} to={`/form/${f.id}/records`} style={{ color: 'var(--color-muted)' }} onClick={() => setMenuOpen(false)}>
                  → {f.name}
                </Link>
              ))}
            </>
          )}

          {/* Account actions live only in the desktop avatar dropdown above
              768px - folded into the drawer here since that dropdown's
              trigger button is part of the now-hidden desktop row. */}
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.2rem 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
            <span style={{
              width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-primary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </span>
            Account
          </div>
          <Link to="/account" style={{ color: 'var(--color-text)' }} onClick={() => setMenuOpen(false)}>Profile</Link>
          <button
            onClick={() => { setMenuOpen(false); supabase.auth.signOut() }}
            style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: '#c0392b', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

export default NavBar