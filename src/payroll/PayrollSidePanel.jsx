// Place at: src/payroll/PayrollSidePanel.jsx
// POS-style slide-out for the Payroll environment: a fixed hamburger + a
// left drawer that navigates between Payments / Staff / Events. Same visual
// pattern as src/PosSidePanel.jsx. Payroll runs as its own contained
// environment, so the app NavBar is trimmed right down (see NavBar.jsx) and
// this is the section nav.
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'

const SECTIONS = [
  { to: '', label: 'Payments', end: true },
  { to: 'staff', label: 'Staff' },
  { to: 'events', label: 'Events' },
]

export default function PayrollSidePanel({ formId }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open payroll menu"
        style={{
          position: 'fixed', top: 'calc(3.4rem + env(safe-area-inset-top))', left: '0.9rem', zIndex: 140,
          width: 44, height: 44, padding: 0, borderRadius: 8,
          background: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer',
          display: open ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}
      >
        <span style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
        <span style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
        <span style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }} />
      )}

      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 210,
        background: 'var(--color-primary)', color: 'white', zIndex: 151,
        transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s ease',
        padding: 'calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom))',
        boxShadow: '2px 0 12px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
          <span style={{ fontWeight: 700 }}>Payroll</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', padding: 0 }}>
            ✕
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {SECTIONS.map(s => (
            <NavLink
              key={s.to || 'payments'}
              to={s.to ? `/form/${formId}/payroll/${s.to}` : `/form/${formId}/payroll`}
              end={s.end}
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                color: 'white', textDecoration: 'none', padding: '0.7rem 0.6rem', borderRadius: 6, fontSize: '0.92rem',
                fontWeight: isActive ? 700 : 400,
                background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
              })}
            >
              {s.label}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/"
          onClick={() => setOpen(false)}
          style={{ marginTop: 'auto', color: 'rgba(255,255,255,0.85)', textDecoration: 'none', padding: '0.7rem 0.6rem', fontSize: '0.85rem' }}
        >
          ← All businesses
        </Link>
      </div>
    </>
  )
}
