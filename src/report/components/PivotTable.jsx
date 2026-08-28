// Place at: src/report/components/PivotTable.jsx
// Renders a pivotEngine.js result as an actual pivot-style grid: row labels
// down the left, column labels across the top, a Total row/column, and a
// grand total in the corner - the literal "table" chart type. Also handles
// the single-dimension case (no columns picked) as a plain two-column list.

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

  // Single dimension: just label + value, same shape HorizontalBarChart
  // takes, but as a plain list - the "table" option for a chart type that's
  // otherwise a bar/pie.
  if (!rowLabels) {
    if (data.length === 0) return <p style={{ color: 'var(--color-muted)' }}>Not enough data yet.</p>
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
