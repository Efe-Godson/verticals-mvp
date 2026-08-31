// Place at: src/report/builder/ConfigPanel.jsx
// Right rail (bottom half): binds the selected visual's fields + query.
// Metric / Dimension / Aggregation / Secondary / Sort / Top N / Granularity
// / Filters, plus pivot (Rows/Cols/Values/%) and scatter (X/Y) sub-config.
import { dimensionFields, measureFields, cartFields, listFields } from '../engine'
import { AGGREGATIONS } from '../engine/aggregate'
import { DATE_GRANULARITIES } from '../engine/dateBuckets'
import { CATALOGUE_BY_TYPE } from './catalogue'

const lbl = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', margin: '0.7rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' }
const inp = { width: '100%', fontSize: '0.85rem' }

function Sel({ label, value, onChange, children }) {
  return (
    <label>
      <span style={lbl}>{label}</span>
      <select style={inp} value={value ?? ''} onChange={e => onChange(e.target.value || null)}>{children}</select>
    </label>
  )
}

export default function ConfigPanel({ visual, form, datasets = [], onDataset, onQuery, onVisual, onViewData, onPromote, onDemote }) {
  if (!visual) {
    return <div style={{ padding: '1rem', color: 'var(--color-muted)', fontSize: '0.83rem' }}>Select a visual on the canvas to configure it.</div>
  }
  const spec = CATALOGUE_BY_TYPE[visual.type] || {}
  const q = visual.query || {}
  const dims = dimensionFields(form)
  const measures = measureFields(form)
  const carts = cartFields(form)
  const allFields = listFields(form)
  const isPivot = visual.type === 'pivot'
  const isScatter = visual.type === 'scatter'
  const isScalar = spec.kind === 'scalar'
  const isRecords = visual.type === 'table'
  const needsSecondary = !!spec.needsSecondary
  const metricField = allFields.find(f => f.id === q.metric)
  const metricIsCart = metricField?.role === 'cart'

  function setMetric(id) {
    const f = allFields.find(x => x.id === id)
    const patch = { metric: id || null }
    if (!id) patch.aggregation = 'count'
    else if (f?.role === 'cart') { patch.aggregation = 'sum'; patch.cartMode = q.cartMode || 'revenue' }
    else if (q.aggregation === 'count') patch.aggregation = 'sum'
    onQuery(patch)
  }

  return (
    <div style={{ padding: '0.7rem 0.9rem 1.4rem', overflowY: 'auto' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Configure</div>

      <label>
        <span style={lbl}>Title</span>
        <input style={inp} type="text" value={visual.title} onChange={e => onVisual({ title: e.target.value })} />
      </label>

      {datasets.length > 1 && onDataset && (
        <label>
          <span style={lbl}>Dataset</span>
          <select
            style={inp}
            value={visual.datasetId || 'orders'}
            onChange={e => onDataset(e.target.value)}
          >
            {datasets.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
      )}

      {isScatter ? (
        <>
          <Sel label="X axis (number)" value={q.scatterX} onChange={v => onQuery({ scatterX: v })}>
            <option value="">Choose…</option>
            {measures.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Sel>
          <Sel label="Y axis (number)" value={q.scatterY} onChange={v => onQuery({ scatterY: v })}>
            <option value="">Choose…</option>
            {measures.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Sel>
          <Sel label="Point label (optional)" value={q.dimension} onChange={v => onQuery({ dimension: v })}>
            <option value="">None</option>
            {dims.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Sel>
        </>
      ) : isRecords ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
          Shows the raw submissions after the workspace and visual filters. Add filters below to narrow it.
        </p>
      ) : (
        <>
          <Sel label="Metric" value={q.metric} onChange={setMetric}>
            <option value="">Count of records</option>
            {measures.length > 0 && <optgroup label="Numbers">{measures.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>}
            {carts.length > 0 && <optgroup label="Orders">{carts.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>}
          </Sel>

          {metricIsCart && (
            <Sel label="Order metric" value={q.cartMode} onChange={v => onQuery({ cartMode: v })}>
              <option value="revenue">Revenue (incl. delivery)</option>
              <option value="qty">Items sold</option>
            </Sel>
          )}

          {q.metric && !metricIsCart && (
            <Sel label="Aggregation" value={q.aggregation} onChange={v => onQuery({ aggregation: v })}>
              {AGGREGATIONS.filter(a => a.value !== 'count').map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Sel>
          )}
          {metricIsCart && (
            <Sel label="Aggregation" value={q.aggregation} onChange={v => onQuery({ aggregation: v })}>
              {['sum', 'avg', 'min', 'max', 'median'].map(a => <option key={a} value={a}>{AGGREGATIONS.find(x => x.value === a).label}</option>)}
            </Sel>
          )}

          {isPivot ? (
            <>
              <Sel label="Rows" value={(q.rows || [])[0]} onChange={v => onQuery({ rows: v ? [v] : [] })}>
                <option value="">Choose…</option>
                {dims.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Sel>
              <Sel label="Columns" value={(q.cols || [])[0]} onChange={v => onQuery({ cols: v ? [v] : [] })}>
                <option value="">None</option>
                {dims.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Sel>
              <Sel label="Show as" value={q.percentMode || ''} onChange={v => onQuery({ percentMode: v || null })}>
                <option value="">Values</option>
                <option value="row">% of row total</option>
                <option value="col">% of column total</option>
                <option value="grand">% of grand total</option>
              </Sel>
            </>
          ) : !isScalar && (
            <>
              <Sel label="Dimension" value={q.dimension} onChange={v => onQuery({ dimension: v })}>
                <option value="">Choose…</option>
                {dims.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Sel>

              {(needsSecondary || q.secondaryDimension) && (
                <Sel label={needsSecondary ? 'Series (secondary dimension)' : 'Break down by (optional)'} value={q.secondaryDimension} onChange={v => onQuery({ secondaryDimension: v })}>
                  <option value="">None</option>
                  {dims.filter(f => f.id !== q.dimension).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </Sel>
              )}

              {form?.fields?.find(f => f.id === q.dimension)?.type === 'date' && (
                <Sel label="Date granularity" value={q.dateGranularity} onChange={v => onQuery({ dateGranularity: v })}>
                  {DATE_GRANULARITIES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </Sel>
              )}

              <Sel label="Sort" value={q.sort} onChange={v => onQuery({ sort: v })}>
                <option value="metric-desc">Metric — high to low</option>
                <option value="metric-asc">Metric — low to high</option>
                <option value="label-asc">Label — A to Z</option>
                <option value="label-desc">Label — Z to A</option>
              </Sel>

              <Sel label="Top N" value={q.topN ? String(q.topN) : ''} onChange={v => onQuery({ topN: v ? Number(v) : null })}>
                <option value="">All</option>
                <option value="5">Top 5</option>
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
              </Sel>
            </>
          )}
        </>
      )}

      {visual.type === 'progress' && (
        <label>
          <span style={lbl}>Target</span>
          <input style={inp} type="number" value={visual.display?.target || ''} onChange={e => onVisual({ display: { ...visual.display, target: e.target.value } })} />
        </label>
      )}

      {!isScalar && !isRecords && !isScatter && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.8rem', fontSize: '0.8rem' }}>
          <input type="checkbox" checked={visual.display?.legend !== false} onChange={e => onVisual({ display: { ...visual.display, legend: e.target.checked } })} />
          Show legend
        </label>
      )}

      <VisualFilters visual={visual} form={form} onVisual={onVisual} />

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button className="secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={onViewData}>View Data</button>
        {visual.reportVisibility
          ? <button className="secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={onDemote}>Remove from Reports</button>
          : <button style={{ flex: 1, fontSize: '0.8rem' }} onClick={onPromote}>Promote to Reports</button>}
      </div>
    </div>
  )
}

function VisualFilters({ visual, form, onVisual }) {
  const fields = listFields(form).filter(f => f.role === 'dimension' || f.role === 'measure')
  const filters = visual.filters || []
  function add() {
    const f = fields[0]
    if (!f) return
    onVisual({ filters: [...filters, { fieldId: f.id, op: f.role === 'measure' ? 'gt' : 'in', value: '' }] })
  }
  function set(i, patch) { onVisual({ filters: filters.map((x, idx) => idx === i ? { ...x, ...patch } : x) }) }
  function del(i) { onVisual({ filters: filters.filter((_, idx) => idx !== i) }) }

  return (
    <div style={{ marginTop: '0.9rem' }}>
      <span style={lbl}>Filters (this visual only)</span>
      {filters.map((f, i) => {
        const field = fields.find(x => x.id === f.fieldId)
        const isNum = field?.role === 'measure'
        return (
          <div key={i} style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.35rem', alignItems: 'center' }}>
            <select style={{ flex: 1, fontSize: '0.78rem' }} value={f.fieldId} onChange={e => set(i, { fieldId: e.target.value })}>
              {fields.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <select style={{ fontSize: '0.78rem' }} value={f.op} onChange={e => set(i, { op: e.target.value })}>
              {isNum ? <><option value="gt">&gt;</option><option value="lt">&lt;</option><option value="gte">≥</option><option value="lte">≤</option></>
                : <><option value="in">is</option><option value="not">is not</option><option value="contains">contains</option></>}
            </select>
            <input style={{ width: 70, fontSize: '0.78rem' }} value={f.value} onChange={e => set(i, { value: e.target.value })} />
            <button className="secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }} onClick={() => del(i)}>✕</button>
          </div>
        )
      })}
      {fields.length > 0 && <button className="secondary" style={{ fontSize: '0.76rem', padding: '0.25rem 0.5rem' }} onClick={add}>+ Filter</button>}
    </div>
  )
}
