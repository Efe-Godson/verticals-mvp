// Place at: src/report/builder/DatasetTableModal.jsx
// The whole dataset behind the builder as a plain table: every submission
// as a row, every analysable field as a column, with each column's type
// shown in the header. Opened from the workspace top bar ("Data ▤") - not
// tied to any one visual (ViewDataModal is the per-visual version).
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

export default function DatasetTableModal({ form, submissions, onClose }) {
  const [q, setQ] = useState('')

  // Every field the report engine can actually work with - same list the
  // Data rail and the config panel use.
  const fields = useMemo(() => listFields(form || { fields: [] }), [form])

  const rows = useMemo(() => {
    const all = submissions || []
    if (!q.trim()) return all
    const needle = q.trim().toLowerCase()
    return all.filter(s =>
      fields.some(f => String(formatCell(s.data[f.id], f) ?? '').toLowerCase().includes(needle)),
    )
  }, [submissions, fields, q])

  const shown = rows.slice(0, ROW_CAP)

  return (
    <Modal
      size="full"
      onClose={onClose}
      title="Dataset"
      bodyStyle={{ padding: '0.8rem 1.1rem 1.1rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <div style={{ fontWeight: 700 }}>{form?.name || 'Dataset'}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
          {(submissions || []).length.toLocaleString()} record{(submissions || []).length === 1 ? '' : 's'} · {fields.length} field{fields.length === 1 ? '' : 's'}
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Filter rows…"
          style={{ marginLeft: 'auto', padding: '0.35rem 0.55rem', fontSize: '0.82rem', minWidth: 180 }}
        />
      </div>

      {fields.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>This form has no analysable fields yet.</p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 0, maxHeight: '68vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'right' }}>#</th>
                  <th style={th}>Submitted</th>
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
                  <tr key={s.id}>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--color-muted)' }}>{i + 1}</td>
                    <td style={td}>{new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    {fields.map(f => (
                      <td key={f.id} style={td} title={String(formatCell(s.data[f.id], f) ?? '')}>
                        {formatCell(s.data[f.id], f)}
                      </td>
                    ))}
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td style={td} colSpan={fields.length + 2}>No matching rows.</td></tr>
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
