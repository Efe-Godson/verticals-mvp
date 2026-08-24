import { useEffect, useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { useCurrentPageTitle, useCurrentPageBack } from './PageTitleContext'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import ArrowLeftIcon from './ArrowLeftIcon'
import MobileBottomNav from './MobileBottomNav'

// Sheet drag-to-dismiss: how far down (px) a drag has to travel before
// releasing counts as "close" rather than snapping back open.
const SHEET_CLOSE_THRESHOLD = 80

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

  // Swipe-down-to-close on the mobile menu sheet (see the drag-handle strip
  // below) - dragY is the live offset while a finger's down, reset once it's
  // released either way. Plain refs/DOM writes for the live drag instead of
  // state, so a fast drag doesn't fight React's render cycle; dragging only
  // flips a state bit (to turn the CSS transition off while live-tracking).
  const [dragging, setDragging] = useState(false)
  const dragStartY = useRef(null)
  const sheetRef = useRef(null)

  function handleSheetDragStart(e) {
    dragStartY.current = e.touches[0].clientY
    setDragging(true)
  }
  function handleSheetDragMove(e) {
    if (dragStartY.current == null || !sheetRef.current) return
    const delta = Math.max(0, e.touches[0].clientY - dragStartY.current)
    sheetRef.current.style.transform = `translateY(${delta}px)`
  }
  function handleSheetDragEnd(e) {
    if (dragStartY.current == null || !sheetRef.current) return
    const delta = Math.max(0, (e.changedTouches[0]?.clientY ?? dragStartY.current) - dragStartY.current)
    dragStartY.current = null
    setDragging(false)
    sheetRef.current.style.transform = ''
    if (delta > SHEET_CLOSE_THRESHOLD) setMenuOpen(false)
  }

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
    <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
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
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
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
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
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
          row above. Back is a hierarchical "one level up" control (only for
          pages that registered a destination via usePageBack, e.g.
          TemplateLocations.jsx -> "/") - it stays paired with the title up
          here, since it means something different from the persistent
          Home/Records/Reports tabs below (see MobileBottomNav.jsx): this is
          "back to where I came from", not "jump to a top-level section". */}
      <div className="navbar-mobile-row">
        {pageBack && (
          <Link
            to={pageBack.to}
            aria-label={pageBack.label ? `Back to ${pageBack.label}` : 'Back'}
            style={{
              width: '44px', height: '44px', flexShrink: 0, color: 'var(--color-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '-0.4rem',
            }}
          >
            <ArrowLeftIcon size={22} />
          </Link>
        )}
        <span style={{ fontWeight: 'bold', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mobileBrand}
        </span>
      </div>

      {/* Fixed bottom tab bar - Menu/Home/Records/Reports, see
          MobileBottomNav.jsx. Only ever shown alongside navbar-mobile-row
          above (same breakpoint), see the matching CSS in index.css. */}
      <MobileBottomNav onOpenMenu={() => setMenuOpen(true)} />

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }}
        />
      )}

      {/* Menu sheet: slides up from the bottom rather than in from the side
          - the Menu tab that opens it lives at the bottom now too, so a
          bottom sheet reads as "grew out of the button you tapped" instead
          of arriving from an unrelated edge. Drag the handle down (or tap
          the backdrop/✕) to close. */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 151, maxHeight: '80vh',
          background: 'var(--color-surface)', boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
          borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
          transform: menuOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: dragging ? 'none' : 'transform 0.25s ease',
          display: 'flex', flexDirection: 'column', fontSize: '0.9rem',
        }}
      >
        <div
          onTouchStart={handleSheetDragStart}
          onTouchMove={handleSheetDragMove}
          onTouchEnd={handleSheetDragEnd}
          style={{ padding: '0.6rem 0 0.3rem', display: 'flex', justifyContent: 'center', touchAction: 'none', flexShrink: 0 }}
        >
          <span style={{ width: '36px', height: '4px', borderRadius: '999px', background: 'var(--color-border)' }} />
        </div>

        <div style={{
          // minHeight: 0 overrides a flex item's default min-height:auto -
          // without it, this couldn't actually shrink to fit the sheet's own
          // maxHeight cap once the link list is long enough, so overflowY
          // below would never get the chance to kick in (the sheet would
          // just clip past 80vh with no way to scroll to the rest).
          flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 1rem calc(1rem + env(safe-area-inset-bottom))',
        }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.8rem' }}>
          <button
            onClick={() => setMenuOpen(false)} aria-label="Close menu"
            style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Home/Records/Reports live in the persistent bottom tab bar now
            (see MobileBottomNav.jsx) - not repeated here too. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

          {/* Records/Report are deliberately not repeated here either - the
              bottom tab bar's Records/Reports already jump straight into
              this same form's records/report when there's one in context. */}
          {isFormContext && (
            <>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.2rem 0' }} />
              <Link to={`/form/${id}/edit`} style={{ color: linkColor('/edit') }} onClick={() => setMenuOpen(false)}>Builder</Link>
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
              768px - folded into the sheet here since that dropdown's
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

          {/* Quiet watermark closing out the list, rather than a heading up
              top - the compact bar's own title already identifies the app
              before the sheet is even open. */}
          <div style={{
            fontSize: '0.78rem', fontWeight: 700, fontStyle: 'italic', color: 'var(--color-muted)',
            letterSpacing: '0.02em', marginTop: '0.5rem',
          }}>
            Verticals
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default NavBar