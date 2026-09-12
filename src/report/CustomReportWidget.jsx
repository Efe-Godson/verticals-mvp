// Place at: src/report/CustomReportWidget.jsx
// Renders one widget from the legacy simple builder (form.settings.reportWidgets,
// see src/ReportBuilder.jsx). Moved out of Report.jsx so it can be shared with
// the Print/PDF builder via buildDashboardTiles.js without a circular import
// back into the Report.jsx page component.
import PieChart from './components/PieChart'
import PivotTable from './components/PivotTable'
import HorizontalBarChart from './components/HorizontalBarChart'
import { getGroupableFields, getMeasureOptions, computePivot, toChartData } from './helpers/pivotEngine'
import { formatNaira } from './helpers/analysisUtils'

export default function CustomReportWidget({ form, widget, submissions }) {
  const groupableFields = getGroupableFields(form)
  const measureOptions = getMeasureOptions(form)
  const rowField = groupableFields.find(f => f.id === widget.rowFieldId)
  const colField = widget.colFieldId ? groupableFields.find(f => f.id === widget.colFieldId) : null
  const measure = measureOptions.find(m => m.id === widget.measureId)

  if (!rowField || !measure) {
    return <p style={{ color: 'var(--color-muted)' }}>One of this report's fields was removed from the form - edit or remove it in the Report Builder.</p>
  }

  const pivotResult = computePivot({ rowField, colField, measure, submissions })
  const formatValue = measure.kind === 'cartRevenue' ? formatNaira : (v) => v.toLocaleString()

  if (widget.chartType === 'table' || colField) return <PivotTable pivotResult={pivotResult} formatValue={formatValue} />
  if (widget.chartType === 'pie') return <PieChart data={toChartData(pivotResult)} />
  return <HorizontalBarChart data={toChartData(pivotResult)} formatValue={formatValue} />
}
