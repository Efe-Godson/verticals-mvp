// Place at: src/report/builder/VisualCatalog.jsx
// Right rail (top half): the catalogue. Click a tile -> a blank visual of
// that type lands on the canvas and becomes selected.
import { CATALOGUE } from './catalogue'

function Glyph({ type }) {
  const s = { width: 22, height: 22, display: 'block' }
  const stroke = 'currentColor'
  if (['number', 'kpi', 'comparison', 'progress'].includes(type)) return <svg style={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke={stroke} strokeWidth="2" /><path d="M7 12h6" stroke={stroke} strokeWidth="2" strokeLinecap="round" /></svg>
  if (type.toLowerCase().includes('bar')) return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke={stroke} strokeWidth="2" strokeLinecap="round" /></svg>
  if (['line', 'multiLine', 'area', 'stackedArea'].includes(type)) return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M3 17l5-6 4 3 6-8" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 21h18" stroke={stroke} strokeWidth="2" strokeLinecap="round" /></svg>
  if (type === 'pie' || type === 'donut') return <svg style={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="2" /><path d="M12 4v8l6 4" stroke={stroke} strokeWidth="2" /></svg>
  if (type === 'scatter') return <svg style={s} viewBox="0 0 24 24" fill="none"><circle cx="7" cy="15" r="1.6" fill={stroke} /><circle cx="12" cy="9" r="1.6" fill={stroke} /><circle cx="17" cy="13" r="1.6" fill={stroke} /><path d="M3 21h18" stroke={stroke} strokeWidth="2" strokeLinecap="round" /></svg>
  return <svg style={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke={stroke} strokeWidth="2" /><path d="M3 9h18M9 4v16" stroke={stroke} strokeWidth="2" /></svg>
}

export default function VisualCatalog({ onAdd }) {
  return (
    <div style={{ padding: '0.8rem 0.9rem' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
        Visualisations
      </div>
      {CATALOGUE.map(group => (
        <div key={group.group} style={{ marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', marginBottom: '0.35rem' }}>{group.group}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
            {group.items.map(it => (
              <button key={it.type} className="secondary" onClick={() => onAdd(it.type)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.55rem 0.3rem', fontSize: '0.72rem', lineHeight: 1.2, textAlign: 'center', color: 'var(--color-text)' }}>
                <Glyph type={it.type} />
                {it.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
