// Place at: src/PosSidePanel.jsx
// Shared hamburger + slide-out panel for the restaurant/POS flow, so the
// same "Order Screen / Add Products / Inventory / Records / Settings"
// navigation is pinned across every page of that flow. Each destination
// other than the order screen opens with ?focus=1 so it renders without the
// app's NavBar (see App.jsx's isFocusMode).
//
// Desktop: opening the panel PUSHES the page content across (body gets a
// left gutter) rather than covering it with a dark overlay, and it can be
// PINNED so it stays open across navigation (remembered per browser). The
// nav item for the page you're on is painted the page background colour so
// it reads as physically joined to the content beside it.
// Mobile: stays a temporary overlay with a backdrop - a left gutter would
// crush a phone.
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import Modal from './components/Modal'
import { getOrCreateShortLink } from './shortLinks'
import ArrowLeftIcon from './ArrowLeftIcon'
import CompactTopBar from './components/CompactTopBar'
import useIsMobile from './hooks/useIsMobile'
import {
  ShoppingCart, CirclePlus, Package, ClipboardList,
  ChartNoAxesColumnIncreasing, Settings, ShieldCheck, Share2, ChevronLeft,
  LayoutDashboard, FileText, SquarePen,
} from 'lucide-react'

// One shared spec so every nav icon matches (see the design brief).
const NAV_ICON = { size: 18, strokeWidth: 1.8 }

const PANEL_WIDTH = 210
const PIN_KEY = 'pos-panel-pinned'

// Docked open is the default on desktop; only an explicit collapse (stored
// as '0') keeps it shut.
function readPinned() {
  try { return localStorage.getItem(PIN_KEY) !== '0' } catch { return true }
}

// A single-row "here's your link" strip: the link's already on the
// clipboard by the time this opens (see openShareLink below), this is just
// visible confirmation plus a manual re-copy for whenever the silent
// clipboard write doesn't land (blocked permission, non-secure context).
function ShareLinkModal({ url, onClose }) {
  const { showToast } = useToast()

  function copyAgain() {
    navigator.clipboard.writeText(url)
    showToast('Link copied!', 'success')
  }

  return (
    <Modal size="md" onClose={onClose} title="Share Link" closeLabel="✕">
      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '0 0 0.7rem' }}>
        Copied to your clipboard - opens straight to the order screen, just like customers see it.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          readOnly value={url} onFocus={(e) => e.target.select()}
          style={{ flex: 1, minWidth: 0, padding: '0.5rem', fontSize: '0.85rem' }}
        />
        <button type="button" onClick={copyAgain} style={{ flexShrink: 0 }}>Copy</button>
      </div>
    </Modal>
  )
}

// Generic nav for any template's form, not just cart/POS ones - Templates'
// "Manage" opens whichever page fits the template with ?panel=1, which
// starts this open instead of collapsed.
// bottomBarPresent: kept for callers (PublicForm.jsx's deferCheckout order
// screen) - no longer changes anything here now that the top bar treatment
// (see `topBar` below) is universal on mobile rather than conditional on it.
function PosSidePanel({ formId, hasCartField: hasCartFieldProp, bottomBarPresent: _bottomBarPresent = false, startCollapsed = false }) {
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const isMobile = useIsMobile(768)
  // When mounted app-wide (see App.jsx) the caller no longer passes this, so
  // resolve it from the form itself; an explicit prop still wins.
  const [fetchedHasCart, setFetchedHasCart] = useState(false)
  const hasCartField = hasCartFieldProp ?? fetchedHasCart

  // `startCollapsed` (a plain data-collection form opened by its owner):
  // the panel is admin chrome that shouldn't greet a form-first page docked
  // open - it stays tucked away behind the hamburger until asked for, and
  // doesn't touch the shared pinned pref that the POS/order flow relies on.
  // `?panel=1` (Templates' "Manage") still forces it open.
  const forcedOpen = searchParams.get('panel') === '1'
  const [pinned, setPinned] = useState(() => startCollapsed ? false : readPinned())
  const [open, setOpen] = useState(() => forcedOpen || (!startCollapsed && readPinned() && !isMobile))
  const [shareLinkUrl, setShareLinkUrl] = useState(null)
  const [formName, setFormName] = useState('')
  const [templateSlug, setTemplateSlug] = useState(null)
  const { staffFormId } = useAuth()
  const isStaff = !!staffFormId

  // Pinning is desktop-only; on a phone the panel is always a temporary
  // overlay so it never eats the (already tight) content width.
  const docked = pinned && !isMobile
  const visible = open || docked
  // The compact top bar is a desktop thing - it stays put whether the panel
  // is docked (bar starts after it) or collapsed (bar spans full width, with
  // a hamburger to bring the panel back).
  const showTopBar = !isMobile

  // Push the page across on desktop while the panel is showing. body padding
  // doesn't move position:fixed children, so the panel itself stays put at
  // the left edge and only the content shifts.
  useEffect(() => {
    if (isMobile) { document.body.classList.remove('pos-panel-docked'); return }
    document.body.classList.toggle('pos-panel-docked', visible)
    return () => document.body.classList.remove('pos-panel-docked')
  }, [visible, isMobile])

  // Reserve room for the compact top bar (position:fixed, so body padding
  // moves the content under it without moving the bar - same trick as
  // .pos-panel-docked).
  useEffect(() => {
    document.body.classList.toggle('compact-topbar', showTopBar)
    return () => document.body.classList.remove('compact-topbar')
  }, [showTopBar])

  // Where "back" goes: a template's own Locations page if this form is one
  // of its locations, straight to All Businesses otherwise.
  const [backTo, setBackTo] = useState(null) // { label, to } | null

  useEffect(() => {
    let cancelled = false
    async function resolveBackLink() {
      const { data: form } = await supabase.from('forms').select('name, settings, fields').eq('id', formId).single()
      if (!cancelled) {
        setFormName(form?.name || '')
        setTemplateSlug(form?.settings?.templateSlug || null)
        if (Array.isArray(form?.fields)) setFetchedHasCart(form.fields.some(f => f.type === 'cart'))
      }
      const slug = form?.settings?.templateSlug
      if (!slug) { if (!cancelled) setBackTo({ label: 'All Businesses', to: '/' }); return }

      const { data: template } = await supabase.from('templates').select('bundle').eq('slug', slug).maybeSingle()
      if (cancelled) return
      setBackTo(template?.bundle?.length > 0
        ? { label: 'All Businesses', to: '/' }
        : { label: 'Locations', to: `/templates/${slug}/locations` })
    }
    resolveBackLink()
    return () => { cancelled = true }
  }, [formId])

  async function openShareLink() {
    if (!docked) setOpen(false)
    let url = `${window.location.origin}/form/${formId}`
    try {
      const code = await getOrCreateShortLink(formId)
      url = `${window.location.origin}/s/${code}`
    } catch {
      // Falls through to the full-length link above.
    }
    navigator.clipboard.writeText(url)
    setShareLinkUrl(url)
  }

  function togglePin() {
    setPinned(prev => {
      const next = !prev
      try { localStorage.setItem(PIN_KEY, next ? '1' : '0') } catch { /* private mode */ }
      setOpen(next) // collapsing also closes; expanding re-opens
      return next
    })
  }

  // Collapse after navigating, unless it's pinned open.
  function handleNavClick() {
    if (!docked) setOpen(false)
  }

  const isExpense = templateSlug === 'expenses'

  const links = isExpense ? [
    { label: 'Overview', to: `/form/${formId}/expenses`, icon: LayoutDashboard },
    { label: 'Add Expense', to: `/form/${formId}/expenses?add=1`, icon: CirclePlus },
    { label: 'Records', to: `/form/${formId}/records?focus=1`, icon: ClipboardList },
    { label: 'Reports', to: `/form/${formId}/report?focus=1`, icon: ChartNoAxesColumnIncreasing },
    ...(isStaff ? [] : [{ label: 'Settings', to: `/form/${formId}/settings?focus=1`, icon: Settings }]),
  ] : [
    hasCartField
      ? { label: 'Order Screen', to: `/form/${formId}`, icon: ShoppingCart }
      : { label: 'View Form', to: `/form/${formId}`, icon: FileText },
    ...(hasCartField
      ? [
          { label: 'Add Products', to: `/form/${formId}/edit?focus=1`, icon: CirclePlus },
          { label: 'Inventory', to: `/form/${formId}/inventory?focus=1`, icon: Package },
        ]
      : isStaff ? [] : [{ label: 'Edit Form', to: `/form/${formId}/edit?focus=1`, icon: SquarePen }]),
    { label: 'Records', to: `/form/${formId}/records?focus=1`, icon: ClipboardList },
    { label: 'Reports', to: `/form/${formId}/report?focus=1`, icon: ChartNoAxesColumnIncreasing },
    ...(isStaff ? [] : [
      { label: 'Settings', to: `/form/${formId}/settings?focus=1`, icon: Settings },
      { label: 'Admin', to: `/form/${formId}/admin?focus=1`, icon: ShieldCheck },
    ]),
    // Share the public link - useful for any form, not just cart ones.
    ...(isStaff ? [] : [{ label: 'Share Link', onClick: openShareLink, icon: Share2 }]),
  ]

  const exitLink = isStaff ? null : backTo

  // Mobile: one full-width top bar (menu left, back right, a hairline
  // border underneath) - the same toolbar language NavBar.jsx's own compact
  // mobile bar uses, standard across every template now. Two separate
  // floating circles read as clutter by comparison. Desktop keeps the
  // floating circular buttons (bottomBarPresent no longer changes this).
  const topBar = isMobile

  return (
    <>
      {topBar && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 149,
          height: 'calc(52px + env(safe-area-inset-top))',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
        }} />
      )}

      {showTopBar && (
        <CompactTopBar
          title={formName}
          onMenu={docked ? undefined : togglePin}
          exitLink={exitLink}
          leftOffset={docked ? PANEL_WIDTH : 0}
          {...(hasCartFieldProp !== undefined
            // PublicForm's order screen: a plain .page (max-width 800, 1.5rem
            // side padding). Focus-mode pages (AppShell) use .pos-flow .page.
            ? { contentMax: '800px', padX: 'clamp(0.9rem, 4vw, 1.5rem)' }
            : { contentMax: 'min(1600px, 100%)', padX: 'clamp(1rem, 4vw, 4.5rem)' })}
        />
      )}

      {isMobile && (
      <button
        type="button"
        className={topBar ? undefined : 'pos-menu-button'}
        onClick={() => { if (isMobile) setOpen(true); else if (!pinned) togglePin() }}
        aria-label="Open menu"
        style={topBar ? {
          position: 'fixed', top: 'env(safe-area-inset-top)', left: '0.4rem', zIndex: 150,
          width: '44px', height: '52px', padding: 0, border: 'none',
          background: 'transparent', color: 'var(--color-primary)',
          display: visible ? 'none' : 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer',
        } : {
          position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', left: '1rem', zIndex: 150,
          width: '44px', height: '44px', padding: 0, borderRadius: '8px',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          // A flat colour square pasted at the very corner read as glued-on;
          // the same lift DarkModeToggle's FAB uses gives it some depth off
          // the page instead.
          boxShadow: 'var(--shadow)',
          display: visible ? 'none' : 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer',
        }}
      >
        <span style={{ width: '20px', height: '2px', background: topBar ? 'var(--color-primary)' : 'white', borderRadius: '1px' }} />
        <span style={{ width: '20px', height: '2px', background: topBar ? 'var(--color-primary)' : 'white', borderRadius: '1px' }} />
        <span style={{ width: '20px', height: '2px', background: topBar ? 'var(--color-primary)' : 'white', borderRadius: '1px' }} />
      </button>
      )}

      {exitLink && isMobile && (
        <Link
          to={exitLink.to}
          className={topBar ? undefined : 'pos-back-button'}
          aria-label={`Back to ${exitLink.label}`}
          title={exitLink.label}
          style={topBar ? {
            position: 'fixed', top: 'env(safe-area-inset-top)', right: '0.4rem', zIndex: 160,
            width: '44px', height: '52px', background: 'transparent', border: 'none',
            color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          } : {
            // Always on screen - above the drawer/backdrop so it stays
            // reachable even while the menu is open or pinned.
            position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', right: '1rem', zIndex: 160,
            width: '44px', height: '44px', borderRadius: '50%',
            // Was a bare icon with nothing behind it - a proper surface +
            // border + shadow (same FAB treatment as the hamburger/
            // DarkModeToggle) so it reads as a button, not decoration
            // floating flat over whatever's underneath it.
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeftIcon size={22} />
        </Link>
      )}

      {/* Backdrop only on mobile, where the panel genuinely covers the page.
          On desktop it pushes the content aside instead (pinned or not), so
          there's nothing to dim. */}
      {open && isMobile && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }}
        />
      )}

      <div
        style={{
          // On a phone this is a full-screen menu, not a partial slide-out
          // panel - the ~210px drawer over a dimmed page reads as cramped
          // app chrome; full width gives the nav room and a clear "you're
          // in the menu now" state. Desktop/tablet keep the docked panel.
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: isMobile ? '100vw' : `${PANEL_WIDTH}px`,
          maxWidth: '100vw',
          background: 'var(--color-primary)', color: 'white', zIndex: 151,
          transform: visible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
          padding: 'calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom))',
          // No shadow on desktop - a shadow at the content seam reads as a
          // gap and stops the active tab blending into the page.
          boxShadow: isMobile ? '2px 0 12px rgba(0,0,0,0.2)' : 'none',
          borderRight: 'none',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.4rem' }}>
          <span style={{ fontWeight: 700 }}>Menu</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
            {!isMobile && (
              <button
                type="button"
                onClick={togglePin}
                aria-label="Collapse menu"
                title="Collapse menu"
                style={{
                  background: 'transparent', border: 'none', color: 'white', cursor: 'pointer',
                  lineHeight: 0, padding: '0.3rem', borderRadius: '6px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronLeft size={20} strokeWidth={2.25} />
              </button>
            )}
            {isMobile && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.2rem' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {links.map(link => {
            const Icon = link.icon
            if (link.onClick) {
              return (
                <button key={link.label} type="button" onClick={link.onClick} className="pos-nav-item">
                  <Icon {...NAV_ICON} aria-hidden="true" />
                  <span>{link.label}</span>
                </button>
              )
            }
            const targetPath = link.to.split('?')[0]
            const isActive = pathname === targetPath
            return (
              <Link
                key={link.label}
                to={link.to}
                onClick={handleNavClick}
                aria-current={isActive ? 'page' : undefined}
                className={isActive ? 'pos-nav-item is-active' : 'pos-nav-item'}
              >
                <Icon {...NAV_ICON} aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {shareLinkUrl && <ShareLinkModal url={shareLinkUrl} onClose={() => setShareLinkUrl(null)} />}
    </>
  )
}

export default PosSidePanel
