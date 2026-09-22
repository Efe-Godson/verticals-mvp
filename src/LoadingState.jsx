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

// Covers a field (a textarea being read by AI, say) with a progress bar
// instead of just relabeling the submit button - the person's eye is on
// what they just pasted, not the button, while the model reads it. Parent
// needs position: 'relative' so this fills it.
//
// There's no real progress signal from a single fetch (no streaming), so
// the fill is an "optimistic" animation: it eases up toward 90% over
// PROGRESS_DURATION and then just holds there via animation-fill-mode -
// it never claims to reach 100% until the real request actually resolves
// and this whole overlay unmounts.
const PROGRESS_DURATION = '9s'

export function ExtractingOverlay({ label = 'Reading...' }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'var(--radius)',
      background: 'var(--color-primary-soft)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.7rem',
      padding: '0 1.5rem',
    }}>
      <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
      <div style={{ width: '100%', maxWidth: '220px', height: '6px', borderRadius: '999px', background: 'var(--color-surface)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '999px', background: 'var(--color-primary)',
          animation: `verticals-progress-fill ${PROGRESS_DURATION} ease forwards`,
        }} />
      </div>
    </div>
  )
}
