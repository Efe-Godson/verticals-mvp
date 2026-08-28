// Place at: src/report/builder/BuilderFilterBar.jsx
// Workspace-level exploration filters (brief §19): a date range plus ad-hoc
// dimension filters. These narrow every visual on the canvas; they do NOT
// touch the promoted Reports dashboard.
import { DATE_RANGE_OPTIONS } from '../helpers/dateRange'
import { dimensionFields } from '../engine'

export default function BuilderFilterBar({ form, filters, onChange }) {
  const dims = dimensionFields(form).filter(f => f.role === 'dimension')
  const dimFilters = filters.dimensionFilters || []

  function addDim() {
    if (!dims.length) return
    onChange({ dimensionFilters: [...dimFilters, { fieldId: dims[0].id, value: '' }] })
  }
  function setDim(i, patch) {
    onChange({ dimensionFilters: dimFilters.map((d, idx) => idx === i ? { ...d, ...patch } : d) })
  }
  function delDim(i) {
    onChange({ dimensionFilters: dimFilters.filter((_, idx) => idx !== i) })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <select style={{ fontSize: '0.82rem' }} value={filters.dateRange} onChange={e => onChange({ dateRange: e.target.value })}>
        {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {filters.dateRange === 'specific' && (
        <input type="date" style={{ fontSize: '0.82rem' }} value={filters.customStart || ''} onChange={e => onChange({ customStart: e.target.value })} />
      )}
      {filters.dateRange === 'custom' && (
        <>
          <input type="date" style={{ fontSize: '0.82rem' }} value={filters.customStart || ''} onChange={e => onChange({ customStart: e.target.value })} />
          <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>to</span>
          <input type="date" style={{ fontSize: '0.82rem' }} value={filters.customEnd || ''} onChange={e => onChange({ customEnd: e.target.value })} />
        </>
      )}

      {dimFilters.map((d, i) => {
        const field = form?.fields?.find(f => f.id === d.fieldId)
        const opts = field?.options || []
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--color-primary-soft)', borderRadius: 999, padding: '0.1rem 0.5rem' }}>
            <select style={{ fontSize: '0.78rem', border: 'none', background: 'transparent' }} value={d.fieldId} onChange={e => setDim(i, { fieldId: e.target.value, value: '' })}>
              {dims.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <select style={{ fontSize: '0.78rem', border: 'none', background: 'transparent' }} value={Array.isArray(d.value) ? d.value[0] : d.value} onChange={e => setDim(i, { value: e.target.value })}>
              <option value="">any</option>
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button className="secondary" style={{ padding: '0 0.25rem', fontSize: '0.72rem' }} onClick={() => delDim(i)}>✕</button>
          </span>
        )
      })}

      {dims.length > 0 && (
        <button className="secondary" style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem' }} onClick={addDim}>+ Filter</button>
      )}
    </div>
  )
}
