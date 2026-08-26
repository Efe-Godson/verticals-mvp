import { useEffect, useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { useCurrentPageTitle, useCurrentPageBack, useCurrentPageOptions } from './PageTitleContext'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import ArrowLeftIcon from './ArrowLeftIcon'
import MobileBottomNav from './MobileBottomNav'

// Sheet drag-to-dismiss: how far down (px) a drag has to travel before
// releasing counts as "close" rather than snapping back open.
const SHEET_CLOSE_THRESHOLD = 80

const MENU_SECTION_LABEL_STYLE = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--color-muted)', margin: '0 0 0.4rem',
}

// One tappable row in the menu sheet - a navigational Link when `to` is
// given, otherwise a button (Recycle Bin opens a dialog instead of routing).
// Every row gets a trailing chevron and an optional count badge (Recycle
// Bin), so Templates/Lab/Recycle Bin/Profile/Builder/etc. all read the same
// way instead of some looking tappable and others not.
function MenuRow({ to, onClick, active, badge, children }) {
  const style = {
    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
    padding: '0.7rem 0', color: active ? 'var(--color-primary)' : 'var(--color-text)',
    background: 'transparent', border: 'none', textAlign: 'left', textDecoration: 'none',
    fontSize: '0.92rem', cursor: 'pointer',
  }
  const inner = (
    <>
      <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
      {badge > 0 && (
        <span style={{
          background: 'var(--color-border)', color: 'var(--color-text)', fontSize: '0.72rem', fontWeight: 700,
          borderRadius: '999px', padding: '0.1rem 0.45rem', minWidth: '1.3rem', textAlign: 'center', flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
      <span style={{ color: 'var(--color-muted)', fontSize: '1rem', flexShrink: 0 }}>›</span>
    </>
  )
  return to
    ? <Link to={to} style={style} onClick={onClick}>{inner}</Link>
    : <button type="button" style={style} onClick={onClick}>{inner}</button>
}

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
  const pageOptions = useCurrentPageOptions()

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

  // Every page reachable from the bottom bar's Records/Reports tabs - both
  // the picker (/records, /reports, no form in context yet) and the actual
  // per-workflow page (/form/:id/records, /form/:id/report). Menu never
  // falls back to showing here, even on the picker where there's no
  // Options menu to show instead - Options-or-nothing, since Menu is meant
  // to only be reachable from Home now (see the pageOptions ternary below).
  const isRecordsOrReportsRoute = /^\/(records|reports)$|^\/form\/[^/]+\/(records|report)$/.test(location.pathname)

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
          "back to where I came from", not "jump to a top-level section".
          The hamburger on the right opens the same bottom sheet the old
          Menu tab used to - Menu is secondary/admin surface (Templates,
          Lab, Recycle Bin, account), so it doesn't belong at equal weight
          with Home/Records/Reports in the primary tab bar below. */}
      <div className="navbar-mobile-row">
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}>
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
          <span style={{
            fontWeight: 'bold', fontSize: '1rem', flex: '1 1 auto', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {mobileBrand}
          </span>
        </div>
        {/* A page with its own Options menu (Report.jsx/Records.jsx) gets
            that button here INSTEAD OF the hamburger, not alongside it -
            one top-right button, not two. Menu (Templates/Lab/Recycle
            Bin/Account) is reachable from Home's hamburger; every page under
            Records/Reports trades that slot for Options instead (or nothing,
            on the picker pages that have no Options of their own yet -
            never falling back to Menu there, see isRecordsOrReportsRoute
            above), since Home is one tap away on the bottom bar regardless. */}
        {pageOptions ? (
          <button
            type="button"
            onClick={pageOptions.onClick}
            aria-label="Page options"
            style={{
              width: '44px', height: '44px', flexShrink: 0, marginRight: '-0.4rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer', padding: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.9" />
              <circle cx="12" cy="12" r="1.9" />
              <circle cx="19" cy="12" r="1.9" />
            </svg>
          </button>
        ) : isRecordsOrReportsRoute ? null : (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            style={{
              width: '44px', height: '44px', flexShrink: 0, marginRight: '-0.4rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer', padding: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Fixed bottom tab bar - Home/Records/Reports, see
          MobileBottomNav.jsx. Only ever shown alongside navbar-mobile-row
          above (same breakpoint), see the matching CSS in index.css. */}
      <MobileBottomNav />

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Menu</span>
          <button
            onClick={() => setMenuOpen(false)} aria-label="Close menu"
            style={{
              width: '44px', height: '44px', marginRight: '-0.5rem', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Home/Records/Reports live in the persistent bottom tab bar now
            (see MobileBottomNav.jsx) - not repeated here too. */}
        <div style={MENU_SECTION_LABEL_STYLE}>Workspace</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <MenuRow to="/templates" active={location.pathname === '/templates'} onClick={() => setMenuOpen(false)}>Templates</MenuRow>
          {isAdmin && (
            <MenuRow to="/lab" active={location.pathname === '/lab'} onClick={() => setMenuOpen(false)}>Lab</MenuRow>
          )}
          {binTrigger && (
            <MenuRow badge={binTrigger.count} onClick={() => { setMenuOpen(false); binTrigger.onOpen() }}>Recycle Bin</MenuRow>
          )}
        </div>

        {/* Records/Report are deliberately not repeated here either - the
            bottom tab bar's Records/Reports already jump straight into
            this same form's records/report when there's one in context. */}
        {isFormContext && (
          <>
            <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0' }} />
            <div style={MENU_SECTION_LABEL_STYLE}>This Form</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <MenuRow to={`/form/${id}/edit`} active={location.pathname.includes('/edit')} onClick={() => setMenuOpen(false)}>Builder</MenuRow>
              {isPayrollForm && <MenuRow to={`/form/${id}/payroll`} active={location.pathname.includes('/payroll')} onClick={() => setMenuOpen(false)}>Payroll</MenuRow>}
              <MenuRow to={`/form/${id}/ai-analyst`} active={location.pathname.includes('/ai-analyst')} onClick={() => setMenuOpen(false)}>AI Analyst</MenuRow>
              <MenuRow to={`/form/${id}/settings`} active={location.pathname.includes('/settings')} onClick={() => setMenuOpen(false)}>Settings</MenuRow>
              {linkedForms.map(f => (
                <Link key={f.id} to={`/form/${f.id}/records`} style={{ color: 'var(--color-muted)', fontSize: '0.88rem', padding: '0.4rem 0' }} onClick={() => setMenuOpen(false)}>
                  → {f.name}
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Account actions live only in the desktop avatar dropdown above
            768px - folded into the sheet here since that dropdown's
            trigger button is part of the now-hidden desktop row. */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0' }} />
        <div style={MENU_SECTION_LABEL_STYLE}>Account</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.3rem 0 0.5rem' }}>
          <span style={{
            width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName || session?.user?.email}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Account</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <MenuRow to="/account" onClick={() => setMenuOpen(false)}>Profile</MenuRow>
        </div>
        <button
          onClick={() => { setMenuOpen(false); supabase.auth.signOut() }}
          style={{
            background: 'transparent', border: 'none', padding: '0.7rem 0 0', marginTop: '0.3rem',
            textAlign: 'left', color: '#c0392b', fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Log out
        </button>

        <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.9rem 0 0.6rem' }} />

        {/* Quiet watermark closing out the sheet. */}
        <div style={{
          fontSize: '0.78rem', fontWeight: 700, fontStyle: 'italic', color: 'var(--color-muted)',
          letterSpacing: '0.02em',
        }}>
          Verticals
        </div>
        </div>
      </div>
    </div>
  )
}

export default NavBar