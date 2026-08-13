// Place at: src/LabSidePanel.jsx
// Slide-out nav for the Lab area, mirroring PosSidePanel.jsx's hamburger +
// overlay + slide-out shape. Only mounted on Lab-only pages (Home.jsx and,
// eventually, the Templates admin view), not app-wide - the regular app's
// NavBar already covers everything else. Adds a search box PosSidePanel
// doesn't need: with only 3 entries a simple substring filter is enough,
// no fuzzy matching or scoring required.
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const ENTRIES = [
  { label: 'Lab Dashboard', to: '/lab' },
  { label: 'Templates', to: '/templates' },
  { label: '🎲 Quiz', to: '/lab/quiz' },
]

function LabSidePanel() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = ENTRIES.filter(e => e.label.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Lab menu"
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700 }}>Lab</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ✕
          </button>
        </div>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            width: '100%', marginBottom: '1rem', background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)', color: 'white',
          }}
        />

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {filtered.length === 0 && (
            <span style={{ fontSize: '0.85rem', opacity: 0.7, padding: '0.5rem' }}>No matches</span>
          )}
          {filtered.map(entry => (
            <Link
              key={entry.to}
              to={entry.to}
              onClick={() => setOpen(false)}
              style={{
                color: 'white', textDecoration: 'none', padding: '0.65rem 0.5rem', borderRadius: '6px', fontSize: '0.9rem',
                background: location.pathname === entry.to ? 'rgba(255,255,255,0.15)' : 'transparent',
              }}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}

export default LabSidePanel
