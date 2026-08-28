// Place at: src/report/builder/visuals/PivotViz.jsx
// Adapts a StandardResult to the existing PivotTable.jsx pivotResult shape
// so pivot rendering stays one component across the app.
import PivotTable from '../../components/PivotTable'
import { EmptyViz } from './ChartFrame'
import { valueFormatter, formatPercent } from '../format'

export default function PivotViz({ result }) {
  const fmt = result?.matrix?.percentMode ? (v) => formatPercent(v) : valueFormatter(result)

  if (result?.matrix && result.matrix.colLabels?.length) {
    const m = result.matrix
    // PivotTable reads rowLabels/colLabels/cells/rowTotals/colTotals/grandTotal
    return <PivotTable pivotResult={{
      rowLabels: m.rowLabels,
      colLabels: m.colLabels,
      cells: m.cells,
      rowTotals: m.rowTotals,
      colTotals: m.colTotals,
      grandTotal: m.grandTotal,
    }} formatValue={fmt} />
  }

  const rows = result?.rows || []
  if (!rows.length) return <EmptyViz />
  return <PivotTable
    pivotResult={{ data: rows.map(r => ({ label: r.label, value: r.value })), total: result.total || 0 }}
    formatValue={fmt}
  />
}
