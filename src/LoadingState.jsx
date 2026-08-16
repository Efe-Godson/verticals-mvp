// Place at: src/LoadingState.jsx
// One flat, on-theme spinner instead of the plain "Loading..." text every
// page used to roll its own version of - same hand-drawn line-icon style as
// the rest of the app (see templateVisuals.jsx/SparkleIcon.jsx), not a
// browser default or a third-party spinner. LoadingSpinner is the icon
// alone, for inline use (next to a button's own label, a small in-page
// section); LoadingState wraps it in the same className="page" block every
// page-level loading check already used, so swapping one in is a drop-in
// replacement for `<div className="page">Loading...</div>`.
export function LoadingSpinner({ size = 20, color = 'currentColor' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'verticals-spin 0.7s linear infinite', flexShrink: 0 }}
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  )
}

export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-muted)' }}>
      <LoadingSpinner color="var(--color-primary)" />
      <span>{label}</span>
    </div>
  )
}

// Covers a field (a textarea being read by AI, say) with a moving
// theme-tinted band instead of just relabeling the submit button - the
// person's eye is on what they just pasted, not the button, while the
// model reads it. Parent needs position: 'relative' so this fills it.
export function ExtractingOverlay({ label = 'Reading...' }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'var(--radius)',
      background: 'linear-gradient(90deg, var(--color-primary-soft) 25%, var(--color-surface) 37%, var(--color-primary-soft) 63%)',
      backgroundSize: '400% 100%', animation: 'verticals-shimmer 1.4s ease infinite',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    }}>
      <LoadingSpinner color="var(--color-primary)" />
      <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
    </div>
  )
}
