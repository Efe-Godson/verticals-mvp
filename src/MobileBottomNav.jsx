// Place at: src/MobileBottomNav.jsx
// Persistent mobile tab bar - Home/Records/Reports, the app's three
// top-level sections kept in one thumb-reachable row. Menu now lives as a
// hamburger in the compact top bar instead of a fourth tab here (see
// NavBar.jsx's navbar-mobile-row) - it's a secondary/admin surface
// (Templates, Lab, Recycle Bin, account), not a primary destination, so it
// doesn't belong at equal weight with Home/Records/Reports.
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function HomeIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 001 1h4v-6h2v6h4a1 1 0 001-1v-9" />
    </svg>
  )
}

function RecordsIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3.5A1.5 1.5 0 0110.5 2h3A1.5 1.5 0 0115 3.5V4" />
      <path d="M8.5 10h7M8.5 14h7M8.5 18h4" />
    </svg>
  )
}

function ReportsIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V12M10 20V6M16 20v-8M3 20h18" />
    </svg>
  )
}

function NavItem({ as: As = Link, active, label, ariaLabel, icon, ...rest }) {
  return (
    <As
      aria-label={ariaLabel || label}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem',
        flex: '1 1 0', minWidth: 0, height: '100%', padding: '0.3rem 0.2rem',
        color: active ? 'var(--color-primary)' : 'var(--color-muted)',
        background: 'transparent', border: 'none', textDecoration: 'none', cursor: 'pointer',
      }}
      {...rest}
    >
      <span style={{ position: 'relative', display: 'flex' }}>
        {/* Small pill above the icon instead of coloring the whole tile -
            a fully green active tab reads as heavier than this deserves
            (see index.css's dropdown/card conventions - accent color marks
            a selection, it doesn't repaint the container). */}
        {active && (
          <span style={{
            position: 'absolute', top: '-7px', left: '50%', transform: 'translateX(-50%)',
            width: '16px', height: '3px', borderRadius: '999px', background: 'var(--color-primary)',
          }} />
        )}
        {icon}
      </span>
      <span style={{ fontSize: '0.68rem', fontWeight: 600, lineHeight: 1 }}>{label}</span>
    </As>
  )
}

function MobileBottomNav() {
  const location = useLocation()
  const { staffFormId } = useAuth()

  // Same form-id extraction NavBar.jsx already does for its own desktop
  // links - reused here so Records/Reports jump back into whichever form
  // you're currently looking at instead of always landing on the chooser.
  const formMatch = location.pathname.match(/^\/form\/([^/]+)/)
  const currentFormId = formMatch ? formMatch[1] : null
  // Staff only ever have the one form (StaffScopedRoute enforces this
  // route-side too) - no chooser page makes sense for them, so fall back
  // straight to it instead of '/records' or '/reports'.
  const contextFormId = currentFormId || staffFormId
  const recordsTo = contextFormId ? `/form/${contextFormId}/records` : '/records'
  const reportsTo = contextFormId ? `/form/${contextFormId}/report` : '/reports'

  const isHome = location.pathname === '/'
  const isRecords = location.pathname === '/records' || /\/form\/[^/]+\/records$/.test(location.pathname)
  const isReports = location.pathname === '/reports' || /\/form\/[^/]+\/report$/.test(location.pathname)

  return (
    <nav className="navbar-bottom-bar" aria-label="Primary navigation">
      <NavItem to="/" active={isHome} icon={<HomeIcon />} label="Home" />
      <NavItem to={recordsTo} active={isRecords} icon={<RecordsIcon />} label="Records" ariaLabel="Open Records" />
      <NavItem to={reportsTo} active={isReports} icon={<ReportsIcon />} label="Reports" ariaLabel="Open Reports" />
    </nav>
  )
}

export default MobileBottomNav
