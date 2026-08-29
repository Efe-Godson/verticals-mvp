// Contextual progress for a long-running operation (Universal Loading
// States brief §3D): AI analysis, big report/export, bulk import, payroll
// run. A checklist of named steps - done / active / pending - NOT a fake
// percentage bar (only show a bar when real progress is known).
//
//   <ProgressState
//     title="Generating report"
//     steps={[
//       { label: 'Reading records', state: 'done' },
//       { label: 'Calculating metrics', state: 'done' },
//       { label: 'Building visualisations', state: 'active' },
//       { label: 'Preparing report', state: 'pending' },
//     ]}
//   />
import { LoadingSpinner } from '../LoadingState'

function Mark({ state }) {
  if (state === 'done') {
    return <span style={{ color: 'var(--status-good)', fontWeight: 700 }} aria-hidden="true">✓</span>
  }
  if (state === 'active') {
    return <LoadingSpinner size={15} color="var(--color-primary)" />
  }
  return <span style={{ color: 'var(--color-border)' }} aria-hidden="true">○</span>
}

export default function ProgressState({ title, steps = [], note, style }) {
  const active = steps.find(s => s.state === 'active')
  return (
    <div
      className="card"
      style={{ padding: '1.15rem 1.3rem', maxWidth: '420px', ...style }}
      role="status"
      aria-live="polite"
    >
      {title && <div style={{ fontWeight: 700, marginBottom: '0.7rem' }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.9rem',
              color: s.state === 'pending' ? 'var(--color-muted)' : 'var(--color-text)',
            }}
          >
            <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}><Mark state={s.state} /></span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      {(note || active) && (
        <p style={{ margin: '0.8rem 0 0', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          {note || `${active.label}…`}
        </p>
      )}
    </div>
  )
}
