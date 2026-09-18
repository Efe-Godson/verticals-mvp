import SupportNote from './components/SupportNote'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Home, ClipboardList, ChartNoAxesColumnIncreasing, LayoutGrid, FlaskConical, User, CreditCard, Trash2, RefreshCw, LogOut, ChevronLeft } from 'lucide-react'
import { useAuth } from './AuthContext'
import { useRecycleBinTrigger } from './RecycleBinContext'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import { supabase } from './supabaseClient'
import CompactTopBar from './components/CompactTopBar'
import VerticalsLogo from './components/VerticalsLogo'
import { useCurrentPageTitle } from './PageTitleContext'
import { LAB_ENTRIES } from './LabSidePanel'
import useAppUpdate from './hooks/useAppUpdate'
import AppUpdateModal from './components/AppUpdateModal'

const PIN_KEY = 'verticals-home-panel-open'

export default function HomeSidePanel() {
  const { session } = useAuth()
  const { trigger: binTrigger } = useRecycleBinTrigger()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(PIN_KEY) !== '0' } catch { return true }
  })
  const { updating, updateApp } = useAppUpdate()

  useEffect(() => {
    document.body.classList.toggle('pos-panel-docked', open)
    document.body.classList.add('compact-topbar')
    return () => document.body.classList.remove('pos-panel-docked', 'compact-topbar')
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(PIN_KEY, next ? '1' : '0') } catch { /* Storage may be unavailable. */ }
  }

  const links = [
    { label: 'Home', to: '/', icon: Home },
    { label: 'Records', to: '/records', icon: ClipboardList },
    { label: 'Reports', to: '/reports', icon: ChartNoAxesColumnIncreasing },
    { label: 'Templates', to: '/templates', icon: LayoutGrid },
    ...(session?.user?.id === TEMPLATE_ADMIN_USER_ID ? [{ label: 'Lab', to: '/lab', icon: FlaskConical }] : []),
  ]

  // Home/Records/Reports/Templates/Lab never call usePageTitle() themselves,
  // so this stays empty there and the static label below covers them - but
  // a page that DOES set one (e.g. TemplateLocations.jsx's template name)
  // needs to win, or every such page read as "Home" here regardless of
  // which one it actually was.
  const dynamicTitle = useCurrentPageTitle()
  const title = dynamicTitle || links.find(link => link.to === pathname)?.label || 'Home'

  return (
    <>
      <CompactTopBar title={title} leftOffset={open ? 210 : 0} onMenu={open ? undefined : toggle} />
      <aside aria-label="Main navigation" inert={!open} style={{
        position: 'fixed', inset: '0 auto 0 0', width: 210, maxWidth: '100vw', zIndex: 151,
        background: 'var(--color-primary)', color: 'white',
        transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease',
        padding: 'calc(1rem + env(safe-area-inset-top)) 1rem 1rem',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <Link to="/" aria-label="Verticals home" style={{ color: 'white' }}><VerticalsLogo height={24} /></Link>
          <button type="button" onClick={toggle} aria-label="Collapse menu" style={{ background: 'transparent', border: 0, color: 'white', padding: '0.3rem', display: 'flex' }}>
            <ChevronLeft size={20} />
          </button>
        </div>
        <nav aria-label="Workspace" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {links.map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to} className={to === pathname ? 'pos-nav-item is-active' : 'pos-nav-item'} aria-current={to === pathname ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </nav>
        {pathname === '/lab' && session?.user?.id === TEMPLATE_ADMIN_USER_ID && (
          <nav aria-label="Lab tools" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: '1rem', paddingTop: '0.7rem' }}>
            {LAB_ENTRIES.filter(entry => !['/lab', '/templates'].includes(entry.to)).map(entry => (
              <Link key={entry.to} to={entry.to} className="pos-nav-item">{entry.label}</Link>
            ))}
          </nav>
        )}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', margin: '1rem 0 0.7rem' }} />
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7, marginBottom: '0.5rem' }}>Account</div>
        <Link to="/account" className="pos-nav-item"><User size={18} aria-hidden="true" /><span>Profile</span></Link>
        <Link to="/billing" className="pos-nav-item"><CreditCard size={18} aria-hidden="true" /><span>Pricing &amp; Usage</span></Link>
        {binTrigger && <button type="button" className="pos-nav-item" onClick={binTrigger.onOpen}><Trash2 size={18} aria-hidden="true" /><span>Recycle Bin{binTrigger.count > 0 ? ' (' + binTrigger.count + ')' : ''}</span></button>}
        <button type="button" className="pos-nav-item" onClick={updateApp}><RefreshCw size={18} aria-hidden="true" /><span>Update app</span></button>
        <button type="button" className="pos-nav-item" onClick={async () => { await supabase.auth.signOut(); navigate('/') }}><LogOut size={18} aria-hidden="true" /><span>Log out</span></button>
        <SupportNote />
      </aside>
      <AppUpdateModal open={updating} />
    </>
  )
}
