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
import useIsMobile from './hooks/useIsMobile'

const PANEL_WIDTH = 210
const PIN_KEY = 'pos-panel-pinned'

function readPinned() {
  try { return localStorage.getItem(PIN_KEY) === '1' } catch { return false }
}

// Flat line thumbtack, matching ArrowLeftIcon / SparkleIcon. Tilts 45deg
// when the panel is pinned.
function PinIcon({ size = 16, pinned = false }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: pinned ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }}
    >
      <path d="M8 4h8M10 4l-1 8-3 2v1h12v-1l-3-2-1-8M12 18v3" />
    </svg>
  )
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
function PosSidePanel({ formId, hasCartField: hasCartFieldProp, bottomBarPresent = false }) {
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const isMobile = useIsMobile(768)
  // When mounted app-wide (see App.jsx) the caller no longer passes this, so
  // resolve it from the form itself; an explicit prop still wins.
  const [fetchedHasCart, setFetchedHasCart] = useState(false)
  const hasCartField = hasCartFieldProp ?? fetchedHasCart

  const [pinned, setPinned] = useState(readPinned)
  const [open, setOpen] = useState(() => searchParams.get('panel') === '1' || (readPinned() && !isMobile))
  const [shareLinkUrl, setShareLinkUrl] = useState(null)
  const { staffFormId } = useAuth()
  const isStaff = !!staffFormId

  // Pinning is desktop-only; on a phone the panel is always a temporary
  // overlay so it never eats the (already tight) content width.
  const docked = pinned && !isMobile
  const visible = open || docked

  // Push the page across on desktop while the panel is showing. body padding
  // doesn't move position:fixed children, so the panel itself stays put at
  // the left edge and only the content shifts.
  useEffect(() => {
    if (isMobile) { document.body.classList.remove('pos-panel-docked'); return }
    document.body.classList.toggle('pos-panel-docked', visible)
    return () => document.body.classList.remove('pos-panel-docked')
  }, [visible, isMobile])

  // Where "back" goes: a template's own Locations page if this form is one
  // of its locations, straight to All Businesses otherwise.
  const [backTo, setBackTo] = useState(null) // { label, to } | null

  useEffect(() => {
    let cancelled = false
    async function resolveBackLink() {
      const { data: form } = await supabase.from('forms').select('settings, fields').eq('id', formId).single()
      if (!cancelled && Array.isArray(form?.fields)) {
        setFetchedHasCart(form.fields.some(f => f.type === 'cart'))
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
      if (next) setOpen(true)
      return next
    })
  }

  // Collapse after navigating, unless it's pinned open.
  function handleNavClick() {
    if (!docked) setOpen(false)
  }

  const links = [
    { label: hasCartField ? 'Order Screen' : 'View Form', to: `/form/${formId}` },
    ...(hasCartField ? [{ label: 'Add Products', to: `/form/${formId}/edit?focus=1` }] : []),
    ...(hasCartField ? [{ label: 'Inventory', to: `/form/${formId}/inventory?focus=1` }] : []),
    { label: 'Records', to: `/form/${formId}/records?focus=1` },
    { label: 'Reports', to: `/form/${formId}/report?focus=1` },
    ...(isStaff ? [] : [
      { label: 'Settings', to: `/form/${formId}/settings?focus=1` },
      { label: 'Admin', to: `/form/${formId}/admin?focus=1` },
    ]),
    ...(hasCartField ? [{ label: 'Share Link', onClick: openShareLink }] : []),
  ]

  const exitLink = isStaff ? null : backTo

  const navItemBase = {
    display: 'block', textDecoration: 'none', padding: '0.65rem 0.75rem',
    borderRadius: '6px', fontSize: '0.9rem', border: 'none', background: 'transparent',
    textAlign: 'left', cursor: 'pointer', width: '100%',
  }
  // A smooth "pebble" - soft green gradient with a subtle sheen and lift.
  // Colours + dark-mode variant live in .pos-nav-active (index.css).
  const activeNavItem = {
    ...navItemBase,
    fontWeight: 600,
    borderRadius: '10px',
    paddingTop: '0.7rem',
    paddingBottom: '0.7rem',
  }

  return (
    <>
      <button
        type="button"
        className={bottomBarPresent ? undefined : 'pos-menu-button'}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', left: '1rem', zIndex: 150,
          width: '44px', height: '44px', padding: 0, borderRadius: '8px',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          display: visible ? 'none' : 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer',
        }}
      >
        <span style={{ width: '20px', height: '2px', background: 'white', borderRadius: '1px' }} />
        <span style={{ width: '20px', height: '2px', background: 'white', borderRadius: '1px' }} />
        <span style={{ width: '20px', height: '2px', background: 'white', borderRadius: '1px' }} />
      </button>

      {exitLink && (
        <Link
          to={exitLink.to}
          className={bottomBarPresent ? undefined : 'pos-back-button'}
          aria-label={`Back to ${exitLink.label}`}
          title={exitLink.label}
          style={{
            // Always on screen - above the drawer/backdrop so it stays
            // reachable even while the menu is open or pinned.
            position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', right: '1rem', zIndex: 160,
            width: '44px', height: '44px', background: 'transparent', border: 'none',
            color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeftIcon size={26} />
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
          position: 'fixed', top: 0, left: 0, bottom: 0, width: `${PANEL_WIDTH}px`,
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
                aria-label={pinned ? 'Unpin menu' : 'Pin menu open'}
                title={pinned ? 'Unpin menu' : 'Pin menu open'}
                style={{
                  background: pinned ? 'rgba(255,255,255,0.22)' : 'transparent',
                  border: 'none', color: 'white', cursor: 'pointer',
                  lineHeight: 1, padding: '0.3rem', borderRadius: '6px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <PinIcon pinned={pinned} />
              </button>
            )}
            {!docked && (
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

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {links.map(link => {
            if (link.onClick) {
              return (
                <button key={link.label} type="button" onClick={link.onClick} style={{ ...navItemBase, color: 'white' }}>
                  {link.label}
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
                className={isActive ? 'pos-nav-active' : undefined}
                style={isActive ? activeNavItem : { ...navItemBase, color: 'white' }}
              >
                {link.label}
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
