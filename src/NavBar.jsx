import SupportNote from './components/SupportNote'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { useCurrentPageTitle, useCurrentPageBack, useCurrentPageOptions, useDesktopHeader } from './PageTitleContext'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import ArrowLeftIcon from './ArrowLeftIcon'
import MobileBottomNav from './MobileBottomNav'
import useIsMobile from './hooks/useIsMobile'
import useAppUpdate from './hooks/useAppUpdate'
import VerticalsLogo from './components/VerticalsLogo'
import AppUpdateModal from './components/AppUpdateModal'
import { LayoutGrid, FlaskConical, Trash2, SquarePen, Wallet, Sparkles, Settings, X, RefreshCw } from 'lucide-react'

// Same icon spec PosSidePanel.jsx's nav rows use, so the two menus read as
// one visual language.
const NAV_ICON = { size: 18, strokeWidth: 1.8 }

const MENU_SECTION_LABEL_STYLE = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.55)', margin: '0 0 0.4rem',
}

// One tappable row in the menu sheet - reuses .pos-nav-item (index.css),
// the same icon+label row PosSidePanel.jsx's slide-out panel uses, so this
// menu and that one read as the same component rather than two different
// nav styles in the app. A navigational Link when `to` is given, otherwise a
// button (Recycle Bin opens a dialog instead of routing); `disabled` renders
// a row that looks like the others but doesn't navigate or respond to taps
// yet (see "Delete Account" below).
function MenuRow({ to, onClick, active, badge, disabled, icon: Icon, children }) {
  if (disabled) {
    return (
      <div className="pos-nav-item" aria-disabled="true" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
        <Icon {...NAV_ICON} aria-hidden="true" />
        <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
      </div>
    )
  }
  const inner = (
    <>
      <Icon {...NAV_ICON} aria-hidden="true" />
      <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
      {badge > 0 && (
        <span style={{
          background: 'rgba(255, 255, 255, 0.22)', color: '#fff', fontSize: '0.72rem', fontWeight: 700,
          borderRadius: '999px', padding: '0.1rem 0.45rem', minWidth: '1.3rem', textAlign: 'center', flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
    </>
  )
  const className = active ? 'pos-nav-item is-active' : 'pos-nav-item'
  return to
    ? <Link to={to} className={className} onClick={onClick}>{inner}</Link>
    : <button type="button" className={className} onClick={onClick}>{inner}</button>
}

function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
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
  const { setDesktopHeaderTarget } = useDesktopHeader()
  const isMobile = useIsMobile(768)
  const { updating, updateApp } = useAppUpdate()
  const isReportDetail = /^\/form\/[^/]+\/report\/?$/.test(location.pathname)

  const isAdmin = session?.user?.id === TEMPLATE_ADMIN_USER_ID
  const displayName = session?.user?.user_metadata?.full_name || ''
  const initials = (displayName || session?.user?.email || '?').trim().slice(0, 1).toUpperCase()

  // Manually extract the form ID from paths like /form/abc-123/records
  const match = location.pathname.match(/^\/form\/([^/]+)/)
  const id = match ? match[1] : null
  const isFormContext = !!id
  // Home's own title would just read "Home" again right under the same
  // word in the bottom tab bar - the account circle (same avatar the
  // desktop row's dropdown uses) is a more useful thing to put there
  // instead, one tap from Profile without detouring through the hamburger
  // sheet.
  const isHome = location.pathname === '/'

  // The actual per-workflow Records/Report page (/form/:id/records,
  // /form/:id/report) - once it's loaded, it always has its own Options menu
  // (see usePageOptions in Records.jsx/Report.jsx), so Menu never falls back
  // to showing there. The bare picker (/records, /reports, no form in
  // context yet - RecordsHome.jsx/Reports.jsx) has no Options of its own and
  // gets the normal Menu + Back treatment instead, same as any other page.
  const isRecordsOrReportsDetailRoute = /^\/form\/[^/]+\/(records|report)$/.test(location.pathname)

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
          <Link to="/" style={{ display: 'flex', alignItems: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
            <VerticalsLogo height={22} />
          </Link>

          {!isReportDetail && <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.9rem' }}>
            <Link to="/" style={{ color: location.pathname === '/' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Home</Link>
            <Link to="/reports" style={{ color: location.pathname === '/reports' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Reports</Link>
            <Link to="/templates" style={{ color: location.pathname === '/templates' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Templates</Link>
            {isAdmin && (
              <Link to="/lab" style={{ color: location.pathname === '/lab' ? 'var(--color-primary)' : 'var(--color-muted)' }}>Lab</Link>
            )}
          </div>}

          {isFormContext && !isReportDetail && (
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

        {isReportDetail && !isMobile && (
          <div className="compact-topbar-page-controls" style={{ flex: 1, minWidth: 0 }} ref={setDesktopHeaderTarget} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!isReportDetail && linkedForms.length > 0 && (
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
                    title="Reload the app and clear its cache - use this if something looks out of date"
                    onClick={() => { setAccountMenuOpen(false); updateApp() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left',
                      border: 'none', background: 'transparent', padding: '0.5rem 0.6rem', fontSize: '0.85rem',
                    }}
                  >
                    <RefreshCw size={15} strokeWidth={1.8} aria-hidden="true" />
                    Update app
                  </button>
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.3rem 0' }} />
                  <button
                    className="secondary"
                    onClick={() => { setAccountMenuOpen(false); supabase.auth.signOut(); navigate('/') }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                      padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: '#c0392b'
                    }}
                  >
                    Log out
                  </button>
                  <SupportNote />
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Compact bar: hidden on desktop, shown below 768px instead of the
          row above. Menu/Options now leads on the left and Back trails on
          the right - matching CompactTopBar.jsx's own [menu] Title ...
          (back) convention for the Payroll/Expenses side-panel flows, which
          used to put these two in the opposite spots from everywhere else
          in the app. Back is a hierarchical "one level up" control (only for
          pages that registered a destination via usePageBack, e.g.
          TemplateLocations.jsx -> "/") - it means something different from
          the persistent Home/Records/Reports tabs below (see
          MobileBottomNav.jsx): this is "back to where I came from", not
          "jump to a top-level section". The hamburger opens the same bottom
          sheet the old Menu tab used to - Menu is secondary/admin surface
          (Templates, Lab, Recycle Bin, account), so it doesn't belong at
          equal weight with Home/Records/Reports in the primary tab bar
          below. */}
      <div className="navbar-mobile-row">
        {/* Icon + page title as one tight left-anchored group - the title
            reads as labelling the icon's page/section, not as a separate
            right-pinned element with a big empty gap before it. Back (when
            the page has one) is the only thing pinned to the far right. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          {/* A page with its own Options menu (Report.jsx/Records.jsx, once
              loaded) gets that button here INSTEAD OF the hamburger, not
              alongside it - one button, not two. Every other page (Home, the
              Records/Reports picker, Templates, ...) falls back to the
              regular Menu hamburger. */}
          {pageOptions ? (
            <button
              type="button"
              onClick={pageOptions.onClick}
              aria-label="Page options"
              style={{
                width: '38px', height: '38px', flexShrink: 0, marginLeft: '-0.3rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer', padding: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : isRecordsOrReportsDetailRoute ? null : (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              style={{
                width: '38px', height: '38px', flexShrink: 0, marginLeft: '-0.3rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer', padding: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          {!isHome && (
            <span style={{
              fontWeight: 'bold', fontSize: '1rem', minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {mobileBrand}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, marginLeft: 'auto', flexShrink: 0 }}>
          {isHome && (
            <Link
              to="/account"
              aria-label="Account"
              style={{
                width: '26px', height: '26px', borderRadius: '50%', background: 'var(--color-primary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, textDecoration: 'none',
              }}
            >
              {initials}
            </Link>
          )}
          {pageBack && (
            <Link
              to={pageBack.to}
              aria-label={pageBack.label ? `Back to ${pageBack.label}` : 'Back'}
              style={{
                width: '38px', height: '38px', flexShrink: 0, marginRight: '-0.3rem', color: 'var(--color-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ArrowLeftIcon size={20} />
            </Link>
          )}
        </div>
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

      {/* Menu panel: same slide-in-from-the-left surface/row language as
          PosSidePanel.jsx's mobile menu (blue surface, white .pos-nav-item
          rows), but a partial-width drawer rather than covering the whole
          screen - the backdrop above stays visible at the edge so this still
          reads as a panel over the page, not a full navigation away from it.
          Tap the backdrop or ✕ to close. */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 151,
          width: 'min(82vw, 340px)',
          background: 'var(--color-primary)', color: 'white',
          transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
          boxShadow: '2px 0 12px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', fontSize: '0.9rem',
        }}
      >
        <div style={{
          // minHeight: 0 overrides a flex item's default min-height:auto -
          // without it this couldn't shrink to fit the viewport once the
          // link list is long enough, so overflowY below would never kick in.
          flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
          padding: 'calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom))',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Menu</span>
          <button
            onClick={() => setMenuOpen(false)} aria-label="Close menu"
            style={{
              width: '44px', height: '44px', marginRight: '-0.5rem', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0,
            }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Home/Records/Reports live in the persistent bottom tab bar now
            (see MobileBottomNav.jsx) - not repeated here too. */}
        <div style={MENU_SECTION_LABEL_STYLE}>Workspace</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <MenuRow to="/templates" icon={LayoutGrid} active={location.pathname === '/templates'} onClick={() => setMenuOpen(false)}>Templates</MenuRow>
          {isAdmin && (
            <MenuRow to="/lab" icon={FlaskConical} active={location.pathname === '/lab'} onClick={() => setMenuOpen(false)}>Lab</MenuRow>
          )}
          {binTrigger && (
            <MenuRow icon={Trash2} badge={binTrigger.count} onClick={() => { setMenuOpen(false); binTrigger.onOpen() }}>Recycle Bin</MenuRow>
          )}
          <MenuRow icon={RefreshCw} onClick={() => { setMenuOpen(false); updateApp() }}>Update app</MenuRow>
        </div>

        {/* Records/Report are deliberately not repeated here either - the
            bottom tab bar's Records/Reports already jump straight into
            this same form's records/report when there's one in context. */}
        {isFormContext && (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '0.9rem 0 0.7rem' }} />
            <div style={MENU_SECTION_LABEL_STYLE}>This Form</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <MenuRow to={`/form/${id}/edit`} icon={SquarePen} active={location.pathname.includes('/edit')} onClick={() => setMenuOpen(false)}>Builder</MenuRow>
              {isPayrollForm && <MenuRow to={`/form/${id}/payroll`} icon={Wallet} active={location.pathname.includes('/payroll')} onClick={() => setMenuOpen(false)}>Payroll</MenuRow>}
              <MenuRow to={`/form/${id}/ai-analyst`} icon={Sparkles} active={location.pathname.includes('/ai-analyst')} onClick={() => setMenuOpen(false)}>AI Analyst</MenuRow>
              <MenuRow to={`/form/${id}/settings`} icon={Settings} active={location.pathname.includes('/settings')} onClick={() => setMenuOpen(false)}>Settings</MenuRow>
              {linkedForms.map(f => (
                <Link key={f.id} to={`/form/${f.id}/records`} style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', padding: '0.4rem 0 0.4rem 0.6rem' }} onClick={() => setMenuOpen(false)}>
                  → {f.name}
                </Link>
              ))}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '0.9rem 0 0.7rem' }} />
        <div style={MENU_SECTION_LABEL_STYLE}>Account</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <MenuRow to="/account" icon={Settings} onClick={() => setMenuOpen(false)}>Profile</MenuRow>
          <SupportNote />
        </div>

        </div>
      </div>
      <AppUpdateModal open={updating} />
    </div>
  )
}

export default NavBar