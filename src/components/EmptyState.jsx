// The "loaded, but there's nothing here" state (Universal Loading States
// brief §8). Distinct from loading (skeleton) and error (ErrorState) - never
// show this while a request is still in flight.
//
//   <EmptyState
//     title="No records yet"
//     message="Records submitted through this template will appear here."
//     action={<button onClick={add}>Add Record</button>}
//   />
export default function EmptyState({ icon, title, message, action, style }) {
  return (
    <div
      className="card"
      style={{
        padding: '2.25rem 1.5rem', textAlign: 'center', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: '0.5rem', ...style,
      }}
    >
      {icon && <div style={{ color: 'var(--color-muted)', marginBottom: '0.2rem' }}>{icon}</div>}
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
