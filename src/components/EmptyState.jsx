// The "loaded, but there's nothing here" state (Universal Loading States
// brief §8). Distinct from loading (skeleton) and error (ErrorState) - never
// show this while a request is still in flight.
//
//   <EmptyState
//     title="No records yet"
//     message="Records submitted through this template will appear here."
//     action={<button onClick={add}>Add Record</button>}
//   />
//
// `icon` defaults to a flat empty-tray outline (same hand-drawn line-icon
// style as ArrowLeftIcon / ErrorState's AlertIcon) so every empty state
// looks consistent even when the caller doesn't pass one. Pass `icon={null}`
// to opt out entirely.
function DefaultEmptyIcon({ size = 34 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3.5 10 6 4h12l2.5 6" />
      <path d="M3.5 10h17v8.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M9 10v1.5a3 3 0 0 0 6 0V10" />
    </svg>
  )
}

// For a "nothing matches your filters/search" state, as opposed to "there's
// genuinely no data yet" (DefaultEmptyIcon) - same line weight/style.
export function SearchOffIcon({ size = 34 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.2" y1="15.2" x2="20" y2="20" />
    </svg>
  )
}

export default function EmptyState({ icon, title, message, action, style }) {
  const resolvedIcon = icon === undefined ? <DefaultEmptyIcon /> : icon
  return (
    <div
      className="card"
      style={{
        padding: '2.25rem 1.5rem', textAlign: 'center', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: '0.5rem', ...style,
      }}
    >
      {resolvedIcon && <div style={{ color: 'var(--color-muted)', marginBottom: '0.2rem' }}>{resolvedIcon}</div>}
      {title && <div style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</div>}
      {message && (
        <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.9rem', maxWidth: '32ch' }}>
          {message}
        </p>
      )}
      {action && <div style={{ marginTop: '0.9rem' }}>{action}</div>}
    </div>
  )
}
