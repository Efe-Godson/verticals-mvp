// Place at: src/report/focus/AboutThisVisual.jsx
// Brief §20: transparency about how a visual is calculated, kept subtle -
// collapsed by default so it never competes with the chart/table above it.
export default function AboutThisVisual({ description, meta }) {
  if (!description && (!meta || meta.length === 0)) return null
  return (
    <details style={{ marginTop: '1.2rem', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-text)' }}>About this visual</summary>
      <div style={{ marginTop: '0.5rem' }}>
        {description && <p style={{ margin: '0 0 0.6rem' }}>{description}</p>}
        {meta && meta.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '1rem', rowGap: '0.3rem' }}>
            {meta.map(m => (
              <div key={m.label} style={{ display: 'contents' }}>
                <span>{m.label}</span>
                <span style={{ color: 'var(--color-text)' }}>{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}
