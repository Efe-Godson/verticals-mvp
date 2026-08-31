// Place at: src/report/builder/DatasetTableModal.jsx
// Every dataset the builder can query (Orders, Sale line items, Products &
// Inventory, Customers) as a plain table - one row per record, one column
// per field, each column's type in the header. Opened from the workspace
// top bar ("Data ▤"). Per-visual "View Data" (ViewDataModal) is separate.
import { useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { formatCell } from '../../records/recordsUiKit'
import { listFields, fieldTypeLabel } from '../engine'

const ROW_CAP = 500

const TYPE_BADGE = {
  number: { bg: 'var(--chart-series-1)', fg: '#fff' },
  date: { bg: 'var(--chart-series-3)', fg: '#fff' },
  category: { bg: 'var(--chart-series-7)', fg: '#fff' },
  order: { bg: 'var(--chart-series-2)', fg: '#fff' },
  text: { bg: 'var(--color-border)', fg: 'var(--color-muted)' },
}

const th = {
  textAlign: 'left', padding: '0.5rem 0.7rem', fontSize: '0.74rem', color: 'var(--color-muted)',
  borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1,
}
const td = { padding: '0.4rem 0.7rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8rem', whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }

const cellText = (v, f) => {
  if (v === null || v === undefined || v === '') return '—'
  if (f.type === 'date') { const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  return formatCell(v, f)
}

export default function DatasetTableModal({ datasets = [], onClose }) {
  const list = datasets.length ? datasets : [{ id: 'orders', label: 'Orders', form: { fields: [] }, submissions: [] }]
  const [activeId, setActiveId] = useState(list[0].id)
  const [q, setQ] = useState('')

  const ds = list.find(d => d.id === activeId) || list[0]
  const fields = useMemo(() => listFields(ds.form || { fields: [] }), [ds])
  const rowsAll = ds.submissions || []

  const rows = useMemo(() => {
    if (!q.trim()) return rowsAll
    const needle = q.trim().toLowerCase()
    return rowsAll.filter(s => fields.some(f => String(cellText(s.data?.[f.id], f)).toLowerCase().includes(needle)))
  }, [rowsAll, fields, q])

  const shown = rows.slice(0, ROW_CAP)

  return (
    <Modal size="full" onClose={onClose} title="Data" bodyStyle={{ padding: '0.8rem 1.1rem 1.1rem' }}>
      {/* dataset tabs */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        {list.map(d => (
          <button
            key={d.id}
            className={d.id === activeId ? '' : 'secondary'}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
            onClick={() => { setActiveId(d.id); setQ('') }}
          >
            {d.label} <span style={{ opacity: 0.7 }}>· {(d.submissions || []).length}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
          {rowsAll.length.toLocaleString()} row{rowsAll.length === 1 ? '' : 's'} · {fields.length} field{fields.length === 1 ? '' : 's'}
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Filter rows…"
          style={{ marginLeft: 'auto', padding: '0.35rem 0.55rem', fontSize: '0.82rem', minWidth: 180 }}
        />
      </div>

      {fields.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>No fields in this dataset.</p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 0, maxHeight: '66vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'right' }}>#</th>
                  {fields.map(f => {
                    const t = fieldTypeLabel(f)
                    const c = TYPE_BADGE[t] || TYPE_BADGE.text
                    return (
                      <th key={f.id} style={th}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{f.label}</span>
                          <span style={{
                            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                            padding: '0.05rem 0.35rem', borderRadius: 999, background: c.bg, color: c.fg,
                          }}>{t}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.id ?? i}>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--color-muted)' }}>{i + 1}</td>
                    {fields.map(f => (
                      <td key={f.id} style={td} title={String(cellText(s.data?.[f.id], f))}>
                        {cellText(s.data?.[f.id], f)}
                      </td>
                    ))}
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td style={td} colSpan={fields.length + 1}>No matching rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > ROW_CAP && (
            <div style={{ fontSize: '0.76rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
              Showing the first {ROW_CAP.toLocaleString()} of {rows.length.toLocaleString()} rows.
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
