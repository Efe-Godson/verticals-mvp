// Place at: src/PosSidePanel.jsx
// Shared hamburger + slide-out panel for the restaurant/POS flow, so the
// same "Order Screen / Add Products / Inventory / Records / Settings" navigation is
// pinned across every page of that flow (order screen, records, settings,
// edit), not just the main order-taking page. Each destination other than
// the order screen itself opens with ?focus=1 so it renders without the
// app's NavBar (see App.jsx's isFocusMode).
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import { getOrCreateShortLink } from './shortLinks'
import ArrowLeftIcon from './ArrowLeftIcon'

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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ background: 'var(--color-surface)', padding: '1.2rem', width: '480px', maxWidth: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Share Link</h3>
          <button type="button" className="secondary" onClick={onClose} style={{ padding: '0.25rem 0.6rem' }}>✕</button>
        </div>
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
      </div>
    </div>
  )
}

// Generic nav for any template's form, not just cart/POS ones - Templates'
// "Manage" opens whichever page fits the template with ?panel=1, which
// starts this open instead of collapsed.
function PosSidePanel({ formId, hasCartField = false, bottomBarPresent = false }) {
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(searchParams.get('panel') === '1')
  const [shareLinkUrl, setShareLinkUrl] = useState(null)
  const { staffFormId } = useAuth()
  // Staff accounts get Order Screen/View Form, Add Products, Records, and
  // Reports - Settings and Admin stay owner-only (see AdminStaff.jsx and
  // StaffScopedRoute in App.jsx, which enforce this server- and route-side
  // too, this is just the matching UI). Report.jsx itself further caps what
  // date range staff can see there.
  const isStaff = !!staffFormId

  // Where "back" goes: a template's own Locations page if this form is one
  // of its locations, straight to All Businesses otherwise (bundle
  // templates like Employees+Salary Events have no Locations page of their
  // own - there's only ever the one form - so those skip straight there too).
  const [backTo, setBackTo] = useState(null) // { label, to } | null

  useEffect(() => {
    let cancelled = false
    async function resolveBackLink() {
      const { data: form } = await supabase.from('forms').select('settings').eq('id', formId).single()
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

  // Prefers a short /s/:code link (see shortLinks.js) over the plain
  // /form/:id URL - same destination, PublicForm.jsx's order screen, either
  // way (see App.jsx's isPublicForm), just easier to read out or retype.
  // Falls back to the full link if the short-link table/insert hiccups, so
  // sharing still works either way. Copies straight away (no separate
  // button press needed for the common case), then opens ShareLinkModal as
  // visible confirmation + a manual re-copy.
  async function openShareLink() {
    setOpen(false)
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

  // This panel replaces the app's NavBar entirely on every page it appears
  // on (see App.jsx's isFocusMode/isPublicForm), so without this there's no
  // way back at all - only deeper into this one form. Staff accounts only
  // have this one form (StaffScopedRoute bounces them straight back), so
  // the link would be a no-op for them.
  const exitLink = isStaff ? null : backTo

  return (
    <>
      <button
        type="button"
        // Skipped when the host page already pins its own bottom bar there
        // (Retail's deferCheckout order screen and its Back/Place Order
        // row - see PublicForm.jsx) - re-anchoring to the bottom on mobile
        // would land this right on top of that bar instead of clear of it.
        className={bottomBarPresent ? undefined : 'pos-menu-button'}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: 'fixed', top: '1rem', left: '1rem', zIndex: 150,
          width: '42px', height: '42px', padding: 0, borderRadius: '8px',
          background: 'var(--color-primary)', color: 'white', border: 'none',
          display: open ? 'none' : 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer'
        }}
      >
        <span style={{ width: '20px', height: '2px', background: 'white', borderRadius: '1px' }} />
        <span style={{ width: '20px', height: '2px', background: 'white', borderRadius: '1px' }} />
        <span style={{ width: '20px', height: '2px', background: 'white', borderRadius: '1px' }} />
      </button>

      {/* Same right-hand back-button placement as NavBar.jsx's compact
          mobile bar (see PageTitleContext.jsx's usePageBack) - moved here
          from a text link inside the drawer, so getting back to Locations
          doesn't need opening the menu first, and to save room in the
          drawer's own link list. */}
      {exitLink && (
        <Link
          to={exitLink.to}
          className={bottomBarPresent ? undefined : 'pos-back-button'}
          aria-label={`Back to ${exitLink.label}`}
          title={exitLink.label}
          style={{
            position: 'fixed', top: '1rem', right: '1rem', zIndex: 150,
            width: '38px', height: '38px', background: 'transparent', border: 'none',
            color: 'var(--color-primary)',
            display: open ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeftIcon size={26} />
        </Link>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }}
        />
      )}

      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: '200px',
          background: 'var(--color-primary)', color: 'white', zIndex: 151,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease', padding: '1rem', boxShadow: '2px 0 12px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontWeight: 700 }}>Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ✕
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {links.map(link => (
            link.onClick ? (
              <button
                key={link.label}
                type="button"
                onClick={link.onClick}
                style={{
                  color: 'white', textDecoration: 'none', padding: '0.65rem 0.5rem', borderRadius: '6px',
                  fontSize: '0.9rem', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer'
                }}
              >
                {link.label}
              </button>
            ) : (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setOpen(false)}
                style={{ color: 'white', textDecoration: 'none', padding: '0.65rem 0.5rem', borderRadius: '6px', fontSize: '0.9rem' }}
              >
                {link.label}
              </Link>
            )
          ))}
        </nav>
      </div>

      {shareLinkUrl && <ShareLinkModal url={shareLinkUrl} onClose={() => setShareLinkUrl(null)} />}
    </>
  )
}

export default PosSidePanel
