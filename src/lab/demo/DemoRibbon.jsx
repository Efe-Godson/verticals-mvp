// A slim conversion bar pinned to the bottom of the screen while the Lab
// demo is active (sessionStorage flag set by DemoExperience.jsx). It rides
// along across every page so "Create account / Log in" is always one tap
// away. Mounted once in App.jsx's AppShell; self-hides when the flag is off.
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export const DEMO_FLAG = 'verticals_demo'

function readFlag() {
  try { return sessionStorage.getItem(DEMO_FLAG) === '1' } catch { return false }
}

export default function DemoRibbon() {
  const location = useLocation()
  const navigate = useNavigate()

  // Re-checked on every route change (this component re-renders with
  // AppShell) - the flag is usually set moments before the first navigation
  // into the demo, and cleared by "Exit demo" below, which also navigates.
  const active = readFlag()

  useEffect(() => {
    document.body.classList.toggle('demo-ribbon-on', active)
    return () => document.body.classList.remove('demo-ribbon-on')
  }, [active, location.pathname])

  if (!active) return null

  function exit() {
    try { sessionStorage.removeItem(DEMO_FLAG) } catch { /* ignore */ }
    navigate('/lab')
  }

  return (
    <div
      role="region"
      aria-label="Verticals demo"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
        padding: `0.55rem clamp(0.8rem, 4vw, 1.6rem) calc(0.55rem + env(safe-area-inset-bottom))`,
        background: 'var(--color-primary)', color: '#fff',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.18)',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: '0.88rem', marginRight: 'auto' }}>
        You&apos;re exploring the Verticals demo
      </span>
      <button
        type="button" onClick={exit}
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
      >
        Exit demo
      </button>
      <Link to="/login">
        <button type="button" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.7)', color: '#fff', fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}>
          Log in
        </button>
      </Link>
      <Link to="/signup">
        <button type="button" style={{ background: '#fff', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.82rem', padding: '0.35rem 0.9rem' }}>
          Create account
        </button>
      </Link>
    </div>
  )
}
