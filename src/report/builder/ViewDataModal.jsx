// Place at: src/report/builder/ViewDataModal.jsx
// Brief §9: every visual keeps a direct line to its data. Two tabs -
// Aggregated Data (the numbers behind the chart, with % / rank / vs-mean)
// and Source Records (the raw rows that produced them).
import { useState } from 'react'
import Modal from '../../components/Modal'
import { formatCell } from '../../records/recordsUiKit'
import { valueFormatter, formatPercent, formatNumber } from './format'

const th = { textAlign: 'left', padding: '0.5rem 0.7rem', fontSize: '0.76rem', color: 'var(--color-muted)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--color-surface)' }
const td = { padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }

export default function ViewDataModal({ visual, result, form, submissions, onClose }) {
  const [tab, setTab] = useState('agg')
  const fmt = valueFormatter(result)
  const rows = result?.perRow || result?.rows || []
  const sourceIds = new Set(result?.sourceSubmissionIds || [])
  const sourceRows = (submissions || []).filter(s => sourceIds.has(s.id))
  const fields = (form?.fields || []).filter(f => f.type !== 'section' && f.type !== 'fileupload').slice(0, 14)

  return (
    <Modal size="xl" onClose={onClose} title={`${visual.title} — Data`} bodyStyle={{ padding: '0.8rem 1.1rem 1.1rem' }}>
      <div>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          <button className={tab === 'agg' ? '' : 'secondary'} style={{ fontSize: '0.8rem' }} onClick={() => setTab('agg')}>Aggregated Data</button>
          <button className={tab === 'src' ? '' : 'secondary'} style={{ fontSize: '0.8rem' }} onClick={() => setTab('src')}>Source Records ({sourceRows.length})</button>
        </div>

        <div className="table-wrap" style={{ marginTop: 0 }}>
          {tab === 'agg' ? (
            result?.matrix?.colLabels?.length ? (
              <MatrixView matrix={result.matrix} fmt={result.matrix.percentMode ? (v) => formatPercent(v) : fmt} />
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
                <thead><tr>
                  <th style={th}>Group</th><th style={{ ...th, textAlign: 'right' }}>Value</th>
                  <th style={{ ...th, textAlign: 'right' }}>% Total</th><th style={{ ...th, textAlign: 'right' }}>vs Mean</th><th style={{ ...th, textAlign: 'right' }}>Rank</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key || i}>
                      <td style={td}>{r.label}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(r.value)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{formatPercent(r.percentOfTotal || 0)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{(r.pctDiffFromMean || 0) >= 0 ? '+' : ''}{formatPercent(r.pctDiffFromMean || 0)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{r.rank ?? '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td style={td} colSpan={5}>No aggregated rows.</td></tr>}
                </tbody>
                {rows.length > 0 && (
                  <tfoot><tr>
                    <td style={{ ...td, fontWeight: 700 }}>Total</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(result.total || 0)}</td>
                    <td style={td} colSpan={3} />
                  </tr></tfoot>
                )}
              </table>
            )
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' }}>
              <thead><tr>
                <th style={th}>Submitted</th>
                {fields.map(f => <th key={f.id} style={th}>{f.label}</th>)}
              </tr></thead>
              <tbody>
                {sourceRows.slice(0, 300).map(s => (
                  <tr key={s.id}>
                    <td style={td}>{new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    {fields.map(f => <td key={f.id} style={td}>{formatCell(s.data[f.id], f)}</td>)}
                  </tr>
                ))}
                {sourceRows.length === 0 && <tr><td style={td} colSpan={fields.length + 1}>No source records.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        {tab === 'agg' && result?.population && (
          <div style={{ padding: '0.6rem 0 0', fontSize: '0.76rem', color: 'var(--color-muted)' }}>
            Population: {formatNumber(result.population.count)} values · mean {fmt(result.population.mean)} · median {fmt(result.population.median)} · min {fmt(result.population.min)} · max {fmt(result.population.max)}
          </div>
        )}
      </div>
    </Modal>
  )
}

function MatrixView({ matrix, fmt }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }}>
      <thead><tr>
        <th style={th} />
        {matrix.colLabels.map(c => <th key={c} style={{ ...th, textAlign: 'right' }}>{c}</th>)}
        <th style={{ ...th, textAlign: 'right' }}>Total</th>
      </tr></thead>
      <tbody>
        {matrix.rowLabels.map(r => (
          <tr key={r}>
            <td style={{ ...td, fontWeight: 600 }}>{r}</td>
            {matrix.colLabels.map(c => <td key={c} style={{ ...td, textAlign: 'right' }}>{fmt(matrix.cells[r]?.[c] || 0)}</td>)}
            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(matrix.rowTotals[r] || 0)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr>
        <td style={{ ...td, fontWeight: 700 }}>Total</td>
        {matrix.colLabels.map(c => <td key={c} style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(matrix.colTotals[c] || 0)}</td>)}
        <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{fmt(matrix.grandTotal || 0)}</td>
      </tr></tfoot>
    </table>
  )
}
