// Place at: src/report/builder/visuals/TableViz.jsx
// SummaryTableViz - the aggregated table the brief shows in §9/§22
// (label, value, % total, rank). DataTableViz - raw source rows.
import { formatCell } from '../../../records/recordsUiKit'
import { valueFormatter, formatPercent, formatNumber } from '../format'
import { EmptyViz } from './ChartFrame'

const th = { textAlign: 'left', padding: '0.5rem 0.7rem', fontSize: '0.78rem', color: 'var(--color-muted)', borderBottom: '2px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)', whiteSpace: 'nowrap' }
const td = { padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }
const stripedBg = 'var(--color-bg, #f8fafc)'

// Table publishing controls (Designer 2.0 Phase 2, FormatInspector.jsx's
// TableStyleFields) - striped/showHeader/hiddenFieldIds. Undefined
// tableStyle (every caller outside the Designer print placement, e.g. the
// interactive Report Builder canvas) means the defaults below, unchanged
// from pre-Phase-2 behavior.
export function SummaryTableViz({ result, tableStyle }) {
  const rows = result?.perRow || result?.rows || []
  if (!rows.length) return <EmptyViz />
  const fmt = valueFormatter(result)
  const dimName = 'Group'
  const striped = tableStyle?.striped !== false
  const showHeader = tableStyle?.showHeader !== false
  return (
    <div className="table-wrap" style={{ marginTop: 0, maxHeight: '100%' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.86rem' }}>
        {showHeader && (
          <thead>
            <tr>
              <th style={th}>{dimName}</th>
              <th style={{ ...th, textAlign: 'right' }}>Value</th>
              <th style={{ ...th, textAlign: 'right' }}>% Total</th>
              <th style={{ ...th, textAlign: 'right' }}>vs Mean</th>
              <th style={{ ...th, textAlign: 'right' }}>Rank</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key || i} style={striped && i % 2 === 1 ? { background: stripedBg } : undefined}>
              <td style={td}>{r.label}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(r.value)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{formatPercent(r.percentOfTotal || 0)}</td>
              <td style={{ ...td, textAlign: 'right', color: (r.diffFromMean || 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}>
                {(r.diffFromMean || 0) >= 0 ? '+' : ''}{formatPercent(r.pctDiffFromMean || 0)}
              </td>
              <td style={{ ...td, textAlign: 'right' }}>{r.rank ?? '-'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...td, fontWeight: 700 }}>Total</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(result.total || 0)}</td>
            <td style={td} colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function DataTableViz({ result, form, tableStyle }) {
  const records = result?.records || []
  if (!records.length) return <EmptyViz message="No records match." />
  const hidden = tableStyle?.hiddenFieldIds || []
  const fields = (form?.fields || [])
    .filter(f => f.type !== 'section' && f.type !== 'fileupload' && !hidden.includes(f.id))
    .slice(0, 12)
  const striped = tableStyle?.striped !== false
  const showHeader = tableStyle?.showHeader !== false
  return (
    <div className="table-wrap" style={{ marginTop: 0, maxHeight: '100%' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }}>
        {showHeader && (
          <thead>
            <tr>
              <th style={th}>Submitted</th>
              {fields.map(f => <th key={f.id} style={th}>{f.label}</th>)}
            </tr>
          </thead>
        )}
        <tbody>
          {records.slice(0, 200).map((rec, i) => (
            <tr key={rec.id} style={striped && i % 2 === 1 ? { background: stripedBg } : undefined}>
              <td style={td}>{new Date(rec.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              {fields.map(f => <td key={f.id} style={td}>{formatCell(rec.data[f.id], f)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 200 && <div style={{ padding: '0.5rem 0.7rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>Showing first 200 of {formatNumber(records.length)}.</div>}
    </div>
  )
}
