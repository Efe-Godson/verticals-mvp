// Place at: src/report/components/PivotTable.jsx
// Renders a pivotEngine.js result as an actual pivot-style grid: row labels
// down the left, column labels across the top, a Total row/column, and a
// grand total in the corner - the literal "table" chart type. Also handles
// the single-dimension case (no columns picked) as a plain two-column list.
//
// On a phone the rows x columns grid can't shrink to fit, so below the mobile
// breakpoint each row becomes a stacked card instead (doc point #13).

import useIsMobile from '../../hooks/useIsMobile'
import { DataCard, DataCardList } from '../../components/DataCards'

const th = {
  textAlign: 'left', padding: '0.5rem 0.7rem', fontSize: '0.82rem',
  background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap', position: 'sticky', top: 0,
}
const td = {
  padding: '0.5rem 0.7rem', fontSize: '0.85rem',
  borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}

function PivotTable({ pivotResult, formatValue = (v) => v.toLocaleString() }) {
  const { data, rowLabels } = pivotResult
  const isMobile = useIsMobile()

  // Single dimension: just label + value, same shape HorizontalBarChart
  // takes, but as a plain list - the "table" option for a chart type that's
  // otherwise a bar/pie.
  if (!rowLabels) {
    if (data.length === 0) return <p style={{ color: 'var(--color-muted)' }}>Not enough data yet.</p>

    if (isMobile) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.map(d => (
            <div key={d.label} style={{
              display: 'flex', justifyContent: 'space-between', gap: '0.8rem',
              padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.88rem',
            }}>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{d.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>{formatValue(d.value)}</span>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Label</th><th style={{ ...th, textAlign: 'right' }}>Value</th></tr></thead>
          <tbody>
            {data.map(d => (
              <tr key={d.label}>
                <td style={td}>{d.label}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Two dimensions: a real rows x columns grid, with a Total row and column.
  const { colLabels, cells, rowTotals, colTotals, grandTotal } = pivotResult
  if (rowLabels.length === 0) return <p style={{ color: 'var(--color-muted)' }}>Not enough data yet.</p>

  if (isMobile) {
    return (
      <DataCardList>
        {rowLabels.map(row => (
          <DataCard key={row} title={row}>
            {colLabels.map(col => (
              <DataCard.Row key={col} label={col} value={formatValue(cells[row][col])} />
            ))}
            <DataCard.Row label="Total" value={formatValue(rowTotals[row])} strong />
          </DataCard>
        ))}
        <DataCard title="Column totals" style={{ background: 'var(--color-bg)' }}>
          {colLabels.map(col => (
            <DataCard.Row key={col} label={col} value={formatValue(colTotals[col])} />
          ))}
          <DataCard.Row label="Grand total" value={formatValue(grandTotal)} strong />
        </DataCard>
      </DataCardList>
    )
  }

  return (
    <div className="table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}></th>
            {colLabels.map(col => <th key={col} style={{ ...th, textAlign: 'right' }}>{col}</th>)}
            <th style={{ ...th, textAlign: 'right', fontWeight: 700 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rowLabels.map(row => (
            <tr key={row}>
              <td style={{ ...td, fontWeight: 600 }}>{row}</td>
              {colLabels.map(col => (
                <td key={col} style={{ ...td, textAlign: 'right' }}>{formatValue(cells[row][col])}</td>
              ))}
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{formatValue(rowTotals[row])}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>Total</td>
            {colLabels.map(col => (
              <td key={col} style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none' }}>
                {formatValue(colTotals[col])}
              </td>
            ))}
            <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{formatValue(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default PivotTable
