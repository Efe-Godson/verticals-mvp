// Place at: src/report/builder/ViewDataModal.jsx
// Focus Mode for a Report Builder visual (redesign brief §5-16, §42-43). A
// dimension breakdown ("series" - bar/line/pie) gets the full experience:
// Top/Bottom ranking that never limits the underlying result, a searchable/
// sortable full-results table, and drill-down into the source records behind
// any one bucket. Other result kinds (KPI, pivot, scatter, raw table) keep
// the simpler Aggregated Data / Source Records view this modal used to be.
import { useState } from 'react'
import Modal from '../../components/Modal'
import { formatCell } from '../../records/recordsUiKit'
import { valueFormatter, formatPercent, formatNumber } from './format'
import { runQuery, findField } from '../engine'
import VisualRenderer from './visuals/VisualRenderer'
import FocusModeModal from '../focus/FocusModeModal'
import FocusRankingControl from '../focus/FocusRankingControl'
import FocusResultsTable from '../focus/FocusResultsTable'
import AboutThisVisual from '../focus/AboutThisVisual'
import { th, td } from '../focus/tableStyles'

function safeRunQuery(query, context) {
  try { return runQuery(query, context) } catch { return null }
}

export default function ViewDataModal({ visual, form, submissions, onClose, onApplyQuery }) {
  const baseQuery = { ...visual.query, filters: visual.filters }
  const fullResult = safeRunQuery({ ...baseQuery, topN: null }, { form, submissions })

  const [rankMode, setRankMode] = useState(baseQuery.sort === 'metric-asc' ? 'bottom' : 'top')
  const [rankN, setRankN] = useState(baseQuery.topN ?? null)
  const [drill, setDrill] = useState(null) // { key, label }

  if (!fullResult || fullResult.kind !== 'series') {
    return <LegacyDataView visual={visual} result={fullResult} form={form} submissions={submissions} onClose={onClose} />
  }

  const chartResult = safeRunQuery({
    ...baseQuery,
    sort: rankMode === 'bottom' ? 'metric-asc' : 'metric-desc',
    topN: rankN,
  }, { form, submissions }) || fullResult

  const drillResult = drill
    ? safeRunQuery({
        ...baseQuery, kind: 'records',
        filters: [...(baseQuery.filters || []), { fieldId: baseQuery.dimension, op: 'eq', value: drill.key }],
      }, { form, submissions })
    : null

  const fmt = valueFormatter(fullResult)
  const rows = fullResult.perRow || fullResult.rows || []
  const dimField = findField(form, baseQuery.dimension)
  const measureField = baseQuery.metric ? findField(form, baseQuery.metric) : null
  const dimLabel = dimField?.label || 'group'
  const unitLabel = `${dimLabel.toLowerCase()}s`

  const columns = [
    { key: 'label', label: dimField?.label || 'Group', align: 'left', sortable: true },
    { key: 'value', label: 'Value', align: 'right', sortable: true, defaultDir: 'desc', format: r => fmt(r.value) },
    { key: 'percentOfTotal', label: '% Total', align: 'right', sortable: true, searchable: false, format: r => formatPercent(r.percentOfTotal || 0) },
    { key: 'rank', label: 'Rank', align: 'right', sortable: true, searchable: false },
  ]

  const baseMode = baseQuery.sort === 'metric-asc' ? 'bottom' : 'top'
  const baseN = baseQuery.topN ?? null
  const canApply = !!onApplyQuery && (rankMode !== baseMode || rankN !== baseN)

  return (
    <FocusModeModal
      onClose={onClose}
      title={visual.title}
      subtitle={`${form?.name || 'Records'} • ${formatNumber(fullResult.count || 0)} record${fullResult.count === 1 ? '' : 's'}`}
      breadcrumbLabel={drill ? drill.label : null}
      onBreadcrumbBack={() => setDrill(null)}
      controls={!drill && (
        <FocusRankingControl mode={rankMode} n={rankN} onChange={(m, n) => { setRankMode(m); setRankN(n) }} />
      )}
      chart={!drill && (
        <VisualRenderer
          visual={visual}
          result={chartResult}
          form={form}
          onSelectDatapoint={({ value }) => {
            const hit = rows.find(r => r.label === value || String(r.key) === String(value))
            setDrill(hit ? { key: hit.key, label: hit.label } : { key: value, label: value })
          }}
        />
      )}
      table={drill ? (
        <DrillRecordsTable result={drillResult} form={form} />
      ) : (
        <FocusResultsTable
          columns={columns}
          rows={rows}
          rowKey={r => r.key}
          countLabel={`All ${unitLabel} · ${rows.length}`}
          searchPlaceholder={`Search ${unitLabel}...`}
          defaultSort={{ key: 'value', dir: 'desc' }}
          onRowClick={row => setDrill({ key: row.key, label: row.label })}
        />
      )}
      footer={
        <AboutThisVisual
          description={`${visual.title} is calculated from ${form?.name || 'this dataset'} using ${measureField ? measureField.label : 'a count of records'}, grouped by ${dimLabel}, sorted ${rankMode === 'bottom' ? 'lowest to highest' : 'highest to lowest'}.`}
          meta={[
            { label: 'Source', value: form?.name || '-' },
            { label: 'Dimension', value: dimLabel },
            { label: 'Measure', value: measureField ? measureField.label : 'Count' },
            { label: 'Chart display', value: rankN ? `${rankMode === 'bottom' ? 'Bottom' : 'Top'} ${rankN}` : 'All' },
            { label: 'Full result', value: `${rows.length} ${unitLabel}` },
          ]}
        />
      }
      applyBar={canApply && (
        <button
          onClick={() => onApplyQuery({ topN: rankN, sort: rankMode === 'bottom' ? 'metric-asc' : 'metric-desc' })}
        >
          Apply to report
        </button>
      )}
    />
  )
}

// The records behind one clicked bucket (brief §15) - same table component
// as the aggregated view, just fed raw rows instead.
function DrillRecordsTable({ result, form }) {
  const recs = result?.records || []
  const fields = (form?.fields || []).filter(f => f.type !== 'section' && f.type !== 'fileupload').slice(0, 14)
  const columns = [
    {
      key: 'created_at', label: 'Submitted', align: 'left', sortable: true,
      sortValue: r => new Date(r.created_at).getTime(),
      format: r => r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
    },
    ...fields.map(f => ({ key: f.id, label: f.label, align: 'left', format: r => formatCell(r.data?.[f.id], f) })),
  ]
  return (
    <FocusResultsTable
      columns={columns}
      rows={recs}
      rowKey={r => r.id}
      countLabel={`${recs.length} record${recs.length === 1 ? '' : 's'}`}
      searchPlaceholder="Search records..."
      defaultSort={{ key: 'created_at', dir: 'desc' }}
      emptyTitle="No underlying records"
      emptyHint="This bucket has no matching source records."
    />
  )
}

// Fallback for result kinds Focus Mode doesn't yet rank/drill into (KPI,
// pivot, scatter, raw table) - the original Aggregated Data / Source Records
// view, unchanged.
function LegacyDataView({ visual, result, form, submissions, onClose }) {
  const [tab, setTab] = useState('agg')
  const fmt = valueFormatter(result)
  const rows = result?.perRow || result?.rows || []
  const sourceIds = new Set(result?.sourceSubmissionIds || [])
  const sourceRows = (submissions || []).filter(s => sourceIds.has(s.id))
  const fields = (form?.fields || []).filter(f => f.type !== 'section' && f.type !== 'fileupload').slice(0, 14)

  return (
    <Modal size="xl" onClose={onClose} title={`${visual.title} - Data`} bodyStyle={{ padding: '0.8rem 1.1rem 1.1rem' }}>
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
                      <td style={{ ...td, textAlign: 'right' }}>{r.rank ?? '-'}</td>
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
