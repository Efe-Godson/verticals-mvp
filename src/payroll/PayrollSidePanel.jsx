// Place at: src/payroll/PayrollSidePanel.jsx
// Payroll runs as its own contained environment - the app NavBar is hidden
// on /form/:id/payroll* (see App.jsx's isPayrollEnv). This is the whole
// nav for it: a fixed hamburger + left slide-out drawer and a fixed back
// arrow, exactly like the restaurant/retail POS flow (src/PosSidePanel.jsx).
// The drawer holds the three payroll sections up top, then the same
// "jump to the rest of this form" options the POS panel carries.
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import ArrowLeftIcon from '../ArrowLeftIcon'

const SECTIONS = [
  { to: '', label: 'Payments', end: true },
  { to: 'staff', label: 'Staff' },
  { to: 'events', label: 'Events' },
]

export default function PayrollSidePanel({ formId }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const sectionTo = (s) => (s.to ? `/form/${formId}/payroll/${s.to}` : `/form/${formId}/payroll`)

  // Same "rest of this form" destinations the POS side panel pins, so you
  // can get to Records / Reports / Settings without leaving payroll first.
  // ?focus=1 keeps them out of the app NavBar (see App.jsx's isFocusMode).
  const MORE = [
    { label: 'Records', to: `/form/${formId}/records?focus=1` },
    { label: 'Reports', to: `/form/${formId}/report?focus=1` },
    { label: 'Settings', to: `/form/${formId}/settings?focus=1` },
  ]

  return (
    <>
      <button
        type="button"
        className="pos-menu-button"
        onClick={() => setOpen(true)}
        aria-label="Open payroll menu"
        style={{
          position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', left: '1rem', zIndex: 150,
          width: 44, height: 44, padding: 0, borderRadius: 8,
          background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer',
          display: open ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}
      >
        <span style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
        <span style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
        <span style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
      </button>

      <Link
        to="/"
        className="pos-back-button"
        aria-label="Back to all businesses"
        title="All businesses"
        style={{
          position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', right: '1rem', zIndex: 150,
          width: 44, height: 44, background: 'transparent', border: 'none', color: 'var(--color-primary)',
          display: open ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ArrowLeftIcon size={26} />
      </Link>

      {open && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }} />
      )}

      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 210,
        background: 'var(--color-primary)', color: 'white', zIndex: 151,
        transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease',
        padding: 'calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom))',
        boxShadow: '2px 0 12px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
          <span style={{ fontWeight: 700 }}>Payroll</span>
          <button type="button" onClick={close} aria-label="Close menu"
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', padding: 0 }}>
            ✕
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {SECTIONS.map(s => (
            <NavLink
              key={s.to || 'payments'}
              to={sectionTo(s)}
              end={s.end}
              onClick={close}
              style={({ isActive }) => ({
                color: 'white', textDecoration: 'none', padding: '0.7rem 0.6rem', borderRadius: 6, fontSize: '0.92rem',
                fontWeight: isActive ? 700 : 400,
                background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
              })}
            >
              {s.label}
            </NavLink>
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.22)', margin: '0.55rem 0.2rem' }} />

          {MORE.map(link => (
            <Link
              key={link.label}
              to={link.to}
              onClick={close}
              style={{ color: 'white', textDecoration: 'none', padding: '0.7rem 0.6rem', borderRadius: 6, fontSize: '0.92rem' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          to="/"
          onClick={close}
          style={{ marginTop: 'auto', color: 'rgba(255,255,255,0.85)', textDecoration: 'none', padding: '0.7rem 0.6rem', fontSize: '0.85rem' }}
        >
          ← All businesses
        </Link>
      </div>
    </>
  )
}
