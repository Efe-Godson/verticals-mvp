// Place at: src/report/focus/FocusRankingControl.jsx
// The "Top ▾  10 ▾" pair from the redesign brief (§7). Ranking never limits
// the underlying dataset - it only controls how many rows the chart above
// the full-results table shows.
const selStyle = {
  fontSize: '0.82rem', padding: '0.3rem 0.5rem', borderRadius: '6px',
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  color: 'var(--color-text)',
}

const PRESETS = [3, 5, 10, 20, 50]

export default function FocusRankingControl({ mode, n, onChange }) {
  const isPreset = n === null || PRESETS.includes(n)
  const nValue = n === null ? 'all' : (isPreset ? String(n) : 'custom')

  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <select style={selStyle} value={mode} onChange={e => onChange(e.target.value, n)}>
        <option value="top">Top</option>
        <option value="bottom">Bottom</option>
      </select>
      <select
        style={selStyle}
        value={nValue}
        onChange={e => {
          const v = e.target.value
          if (v === 'all') return onChange(mode, null)
          if (v === 'custom') return onChange(mode, n && !PRESETS.includes(n) ? n : 15)
          onChange(mode, Number(v))
        }}
      >
        {PRESETS.map(p => <option key={p} value={String(p)}>{p}</option>)}
        <option value="all">All</option>
        <option value="custom">Custom</option>
      </select>
      {nValue === 'custom' && (
        <input
          type="number" min={1} value={n || ''}
          onChange={e => onChange(mode, Math.max(1, Number(e.target.value) || 1))}
          style={{ ...selStyle, width: '4.5rem' }}
        />
      )}
    </div>
  )
}
