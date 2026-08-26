// Place at: src/DarkModeToggle.jsx
// A floating eye button, present on every app-shell page (see AppShell in
// App.jsx), that instantly flips between light and dark mode - the same
// applyThemeMode('light'|'dark') AccountPage.jsx's theme-mode picker uses,
// just reachable without a trip to Account settings. Deliberately only ever
// toggles between the two (never lands back on "system") - the point of a
// one-tap switch is a predictable flip, not a third state to cycle through.
import { useState } from 'react'
import { applyThemeMode, isDarkMode } from './theme'

function OpenEyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ClosedEyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.8 5.5 10 5.5 10-5.5 10-5.5" />
      <path d="M6.5 15.5 5 18M17.5 15.5 19 18M12 17.5V20" />
    </svg>
  )
}

function DarkModeToggle() {
  const [dark, setDark] = useState(isDarkMode)

  function toggle() {
    const next = !dark
    applyThemeMode(next ? 'dark' : 'light')
    setDark(next)
  }

  return (
    <button
      type="button"
      className="dark-mode-toggle"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed', right: '1rem', bottom: '1rem', zIndex: 130,
        width: '44px', height: '44px', borderRadius: '50%',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        color: 'var(--color-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow)', cursor: 'pointer', padding: 0,
      }}
    >
      {dark ? <ClosedEyeIcon /> : <OpenEyeIcon />}
    </button>
  )
}

export default DarkModeToggle
