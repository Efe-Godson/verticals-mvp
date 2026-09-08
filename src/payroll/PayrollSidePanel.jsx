// Place at: src/payroll/PayrollSidePanel.jsx
// Payroll runs as its own contained environment - the app NavBar is hidden
// on /form/:id/payroll* (see App.jsx's isPayrollEnv). This is the whole
// nav for it.
//
//   >= 1024px : docked open by default (pushes the page content across, see
//               body.payroll-panel-docked in index.css). One control -
//               collapse / expand: collapsing slides it away and leaves a
//               single expand button in the corner. The choice is
//               remembered per browser.
//   < 1024px  : a fixed hamburger + left slide-out drawer + a fixed back
//               arrow, exactly like the restaurant/retail POS flow
//               (src/PosSidePanel.jsx).
import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Wallet, Users, CalendarClock, ClipboardList, ChartNoAxesColumnIncreasing, Settings, ArrowLeft, ChevronLeft } from 'lucide-react'
import useIsMobile from '../hooks/useIsMobile'
import ArrowLeftIcon from '../ArrowLeftIcon'
import CompactTopBar from '../components/CompactTopBar'

// Shared with PosSidePanel - one spec so every nav icon matches.
const NAV_ICON = { size: 18, strokeWidth: 1.8 }

// Keep in sync with body.payroll-panel-docked's padding-left in index.css.
const SIDEBAR_WIDTH = 210
const COLLAPSE_KEY = 'payroll-panel-collapsed'

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

const SECTIONS = [
  { to: '', label: 'Payments', end: true, icon: Wallet },
  { to: 'staff', label: 'Staff', icon: Users },
  { to: 'events', label: 'Events', icon: CalendarClock },
]

function currentSectionLabel(pathname) {
  if (/\/payroll\/staff(\/|$)/.test(pathname)) return 'Staff'
  if (/\/payroll\/events(\/|$)/.test(pathname)) return 'Events'
  return 'Payments'
}

export default function PayrollSidePanel({ formId }) {
  const { pathname } = useLocation()
  const sectionTitle = currentSectionLabel(pathname)
  const isDesktop = !useIsMobile(1024)
  // Below 768px: one full-width top bar (menu left, back right, a hairline
  // border underneath) instead of two floating circles - same treatment
  // PosSidePanel.jsx uses everywhere now.
  const topBar = useIsMobile(768)
  const [open, setOpen] = useState(false)              // mobile overlay drawer
  const [collapsed, setCollapsed] = useState(readCollapsed) // desktop only
  const close = () => setOpen(false)

  // Desktop: "docked" = pinned open and pushing the page across. That's the
  // default; collapsing hides it and shows just the expand button.
  const docked = isDesktop && !collapsed
  const showDrawer = docked || open

  useEffect(() => {
    document.body.classList.toggle('payroll-panel-docked', docked)
    return () => document.body.classList.remove('payroll-panel-docked')
  }, [docked])

  // The compact top bar (shared with PosSidePanel) stays on for all of
  // desktop - it starts after the panel when docked, spans full width with a
  // hamburger when collapsed. See body.compact-topbar in index.css.
  const showTopBar = isDesktop
  useEffect(() => {
    document.body.classList.toggle('compact-topbar', showTopBar)
    return () => document.body.classList.remove('compact-topbar')
  }, [showTopBar])

  function collapse() {
    setCollapsed(true)
    try { localStorage.setItem(COLLAPSE_KEY, '1') } catch { /* private mode */ }
  }
  function expand() {
    setCollapsed(false)
    try { localStorage.setItem(COLLAPSE_KEY, '0') } catch { /* private mode */ }
  }

  const sectionTo = (s) => (s.to ? `/form/${formId}/payroll/${s.to}` : `/form/${formId}/payroll`)

  // Same "rest of this form" destinations the POS side panel pins, so you
  // can get to Records / Reports / Settings without leaving payroll first.
  // ?focus=1 keeps them out of the app NavBar (see App.jsx's isFocusMode).
  const MORE = [
    { label: 'Records', to: `/form/${formId}/records?focus=1`, icon: ClipboardList },
    { label: 'Reports', to: `/form/${formId}/report?focus=1`, icon: ChartNoAxesColumnIncreasing },
    { label: 'Settings', to: `/form/${formId}/settings?focus=1`, icon: Settings },
  ]

  // The corner expand button: on a phone/tablet it opens the overlay drawer;
  // on desktop it un-collapses the docked panel. Hidden whenever the drawer
  // is already showing.
  const showHamburger = isDesktop ? collapsed : !open
  const onHamburger = () => (isDesktop ? expand() : setOpen(true))

  return (
    <>
      {showTopBar && (
        <CompactTopBar
          title={sectionTitle}
          onMenu={docked ? undefined : expand}
          exitLink={{ to: '/', label: 'All businesses' }}
          leftOffset={docked ? SIDEBAR_WIDTH : 0}
          contentMax="1000px"
          padX="clamp(1rem, 4vw, 1.5rem)"
        />
      )}

      {!docked && (
        <>
          {topBar && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 149,
              height: 'calc(52px + env(safe-area-inset-top))',
              background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
            }} />
          )}

          {!showTopBar && (
          <button
            type="button"
            className={topBar ? undefined : 'pos-menu-button'}
            onClick={onHamburger}
            aria-label="Open payroll menu"
            style={topBar ? {
              position: 'fixed', top: 'env(safe-area-inset-top)', left: '0.4rem', zIndex: 150,
              width: 44, height: 52, padding: 0, border: 'none',
              background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer',
              display: showHamburger ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            } : {
              position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', left: '1rem', zIndex: 150,
              width: 44, height: 44, padding: 0, borderRadius: 8,
              background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer',
              display: showHamburger ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <span style={{ width: 20, height: 2, background: topBar ? 'var(--color-primary)' : 'white', borderRadius: 1 }} />
            <span style={{ width: 20, height: 2, background: topBar ? 'var(--color-primary)' : 'white', borderRadius: 1 }} />
            <span style={{ width: 20, height: 2, background: topBar ? 'var(--color-primary)' : 'white', borderRadius: 1 }} />
          </button>
          )}

          {!isDesktop && (
            <>
              <Link
                to="/"
                className={topBar ? undefined : 'pos-back-button'}
                aria-label="Back to all businesses"
                title="All businesses"
                style={topBar ? {
                  position: 'fixed', top: 'env(safe-area-inset-top)', right: '0.4rem', zIndex: 150,
                  width: 44, height: 52, background: 'transparent', border: 'none', color: 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                } : {
                  position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', right: '1rem', zIndex: 150,
                  width: 44, height: 44, background: 'transparent', border: 'none', color: 'var(--color-primary)',
                  display: open ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ArrowLeftIcon size={26} />
              </Link>

              {/* Just the current section's name, centred on the same line as
                  the menu and back buttons. Not a switcher - the drawer is how
                  you move between sections. */}
              <span
                style={{
                  position: 'fixed', top: 'env(safe-area-inset-top)', left: 52, right: 52,
                  height: topBar ? 52 : 'auto', zIndex: 150,
                  display: open ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)',
                  pointerEvents: 'none', whiteSpace: 'nowrap',
                  ...(topBar ? {} : { top: 'calc(1rem + env(safe-area-inset-top))' }),
                }}
              >
                {sectionTitle}
              </span>
            </>
          )}

          {open && !isDesktop && (
            <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }} />
          )}
        </>
      )}

      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH,
        background: 'var(--color-primary)', color: 'white', zIndex: 151,
        transform: showDrawer ? 'translateX(0)' : 'translateX(-100%)',
        transition: docked ? 'none' : 'transform 0.2s ease',
        padding: 'calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom))',
        boxShadow: docked ? 'none' : '2px 0 12px rgba(0,0,0,0.2)',
        borderRight: docked ? '1px solid rgba(0,0,0,0.12)' : 'none',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
          <span style={{ fontWeight: 700 }}>Payroll</span>
          {isDesktop ? (
            <button
              type="button" onClick={collapse} aria-label="Collapse menu" title="Collapse menu"
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', lineHeight: 0, padding: '0.25rem', borderRadius: 6, display: 'inline-flex' }}
            >
              <ChevronLeft size={20} strokeWidth={2.25} />
            </button>
          ) : (
            <button type="button" onClick={close} aria-label="Close menu"
              style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', padding: 0 }}>
              ✕
            </button>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <NavLink
                key={s.to || 'payments'}
                to={sectionTo(s)}
                end={s.end}
                onClick={close}
                className={({ isActive }) => (isActive ? 'pos-nav-item is-active' : 'pos-nav-item')}
              >
                <Icon {...NAV_ICON} aria-hidden="true" />
                <span>{s.label}</span>
              </NavLink>
            )
          })}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.22)', margin: '0.55rem 0.2rem' }} />

          {MORE.map(link => {
            const Icon = link.icon
            return (
              <Link key={link.label} to={link.to} onClick={close} className="pos-nav-item">
                <Icon {...NAV_ICON} aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <Link
          to="/"
          onClick={close}
          className="pos-nav-item"
          style={{ marginTop: 'auto', fontSize: '0.85rem' }}
        >
          <ArrowLeft {...NAV_ICON} aria-hidden="true" />
          <span>All businesses</span>
        </Link>
      </div>
    </>
  )
}
