// Place at: src/ErrorState.jsx
// Replaces raw red <p>{error}</p>/<div style={{color:'red'}}> page-level
// error text with a consistent, on-theme block: a flat alert-circle icon
// (same hand-drawn line-icon style as the rest of the app) plus the
// message, in a card instead of bare text. onRetry is optional - only pass
// it for an error worth re-attempting (a failed fetch), not a permanent one
// ("this form doesn't exist").
function AlertIcon({ size = 22 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="var(--status-critical)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <line x1="12" y1="16.2" x2="12" y2="16.21" />
    </svg>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="page">
      <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.7rem', maxWidth: '480px' }}>
        <AlertIcon />
        <div>
          <p style={{ margin: 0 }}>{message}</p>
          {onRetry && (
            <button type="button" className="secondary" onClick={onRetry} style={{ marginTop: '0.7rem' }}>
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
