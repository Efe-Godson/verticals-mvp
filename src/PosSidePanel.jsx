// Place at: src/PosSidePanel.jsx
// Shared hamburger + slide-out panel for the restaurant/POS flow, so the
// same "Order Screen / Add Products / Records / Settings" navigation is
// pinned across every page of that flow (order screen, records, settings,
// edit), not just the main order-taking page. Each destination other than
// the order screen itself opens with ?focus=1 so it renders without the
// app's NavBar (see App.jsx's isFocusMode).
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'

// Generic nav for any template's form, not just cart/POS ones - Templates'
// "Manage" opens whichever page fits the template with ?panel=1, which
// starts this open instead of collapsed.
function PosSidePanel({ formId, hasCartField = false }) {
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(searchParams.get('panel') === '1')
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
      if (!slug) { if (!cancelled) setBackTo({ label: '← All Businesses', to: '/' }); return }

      const { data: template } = await supabase.from('templates').select('bundle').eq('slug', slug).maybeSingle()
      if (cancelled) return
      setBackTo(template?.bundle?.length > 0
        ? { label: '← All Businesses', to: '/' }
        : { label: '← Locations', to: `/templates/${slug}/locations` })
    }
    resolveBackLink()
    return () => { cancelled = true }
  }, [formId])

  const links = [
    { label: hasCartField ? 'Order Screen' : 'View Form', to: `/form/${formId}` },
    ...(hasCartField ? [{ label: 'Add Products', to: `/form/${formId}/edit?focus=1` }] : []),
    { label: 'Records', to: `/form/${formId}/records?focus=1` },
    { label: 'Reports', to: `/form/${formId}/report?focus=1` },
    ...(isStaff ? [] : [
      { label: 'Settings', to: `/form/${formId}/settings?focus=1` },
      { label: 'Admin', to: `/form/${formId}/admin?focus=1` },
    ]),
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

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }}
        />
      )}

      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: '240px',
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
          {exitLink && (
            <>
              <Link
                to={exitLink.to}
                onClick={() => setOpen(false)}
                style={{ color: 'white', textDecoration: 'none', padding: '0.65rem 0.5rem', borderRadius: '6px', fontSize: '0.9rem', opacity: 0.85 }}
              >
                {exitLink.label}
              </Link>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)', margin: '0.3rem 0' }} />
            </>
          )}
          {links.map(link => (
            <Link
              key={link.label}
              to={link.to}
              onClick={() => setOpen(false)}
              style={{ color: 'white', textDecoration: 'none', padding: '0.65rem 0.5rem', borderRadius: '6px', fontSize: '0.9rem' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}

export default PosSidePanel
