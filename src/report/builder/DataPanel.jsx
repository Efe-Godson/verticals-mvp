// Place at: src/report/builder/DataPanel.jsx
// Left rail: the selected dataset (this form) and its fields, tagged with
// type so the config panel and the eye can tell dimensions from measures.
import { listFields, fieldTypeLabel } from '../engine'

const BADGE = {
  number: { bg: 'var(--chart-series-1)', fg: '#fff' },
  date: { bg: 'var(--chart-series-3)', fg: '#fff' },
  category: { bg: 'var(--chart-series-7)', fg: '#fff' },
  order: { bg: 'var(--chart-series-2)', fg: '#fff' },
  text: { bg: 'var(--color-border)', fg: 'var(--color-muted)' },
}

export default function DataPanel({ form, datasetLabel, datasets = [], onPickDataset }) {
  const fields = listFields(form)
  const activeId = datasets.find(d => d.label === datasetLabel)?.id
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '0.9rem 1rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Data</div>
        {datasets.length > 1 && onPickDataset ? (
          <select
            value={activeId || 'orders'}
            onChange={e => onPickDataset(e.target.value)}
            style={{ width: '100%', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.2rem' }}
          >
            {datasets.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        ) : (
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.15rem' }}>{datasetLabel || form?.name || 'Dataset'}</div>
        )}
        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
          {fields.length} fields
          {datasets.length > 1 && !onPickDataset && ' · select a visual to switch dataset'}
        </div>
      </div>
      <div style={{ overflowY: 'auto', padding: '0.5rem 0.6rem', flex: 1 }}>
        {fields.map(f => {
          const t = fieldTypeLabel(f)
          const c = BADGE[t] || BADGE.text
          return (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
              padding: '0.4rem 0.5rem', borderRadius: 6, fontSize: '0.83rem',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
              <span style={{
                flexShrink: 0, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.03em', padding: '0.1rem 0.4rem', borderRadius: 999,
                background: c.bg, color: c.fg,
              }}>{t}</span>
            </div>
          )
        })}
        {fields.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem', padding: '0.5rem' }}>This form has no analysable fields.</div>}
      </div>
    </div>
  )
}
