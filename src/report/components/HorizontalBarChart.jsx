// Place at: src/report/components/HorizontalBarChart.jsx
//
// Horizontal bar list. Each row: label — bar — value (and optional percent).
// Pass `bare` to skip the surrounding card (used when the caller already
// provides its own card/heading, e.g. CategoryReport, DateReport).
function HorizontalBarChart({ title, data, bare = false, formatValue = (v) => v.toLocaleString(), maxBars = 10 }) {
  const shown = (data || []).slice(0, maxBars)
  const maxValue = Math.max(...shown.map(d => d.count), 1)

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {shown.length === 0 && <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>No data yet.</p>}
      {shown.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div
            title={d.label}
            style={{
              width: '110px', flexShrink: 0, fontSize: '0.82rem', color: '#444',
              textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}
          >
            {d.label}
          </div>
          <div style={{ flex: 1, background: '#f2f2f2', borderRadius: '4px', height: '20px', position: 'relative' }}>
            <div style={{
              width: `${Math.max((d.count / maxValue) * 100, 2)}%`,
              height: '100%', background: 'var(--color-primary, #0070f3)', borderRadius: '4px'
            }} />
          </div>
          <div style={{ minWidth: '90px', flexShrink: 0, fontSize: '0.8rem', color: '#666', textAlign: 'right' }}>
            {formatValue(d.count)}{d.percent !== undefined ? ` (${d.percent}%)` : ''}
          </div>
        </div>
      ))}
    </div>
  )

  if (bare) {
    return (
      <div>
        {title && (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
            {title}
          </div>
        )}
        {content}
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #eee', borderRadius: '10px', padding: '1.1rem 1.3rem' }}>
      {title && (
        <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          {title}
        </div>
      )}
      {content}
    </div>
  )
}

export default HorizontalBarChart
