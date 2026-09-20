// Place at: src/report/builder/print/PrintKpiElement.jsx
// One KPI card from the main Report.jsx dashboard's KPIGrid (see
// report/analysis/buildKpis.js) - the exact same StatTile component and
// formatKpiValue() the live dashboard uses, so a card here always matches
// what the dashboard shows for the same metric. Like PrintTileElement.jsx,
// this has no persisted query to re-run - it just looks its own kpiLabel up
// in kpisById (built fresh from rb.form/rb.scopedSubmissions) every render.
import StatTile from '../../components/StatTile'
import { formatKpiValue } from '../../analysis/buildKpis'

export default function PrintKpiElement({ kpi }) {
  if (!kpi) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', border: '1px dashed #ccc' }}>
        This metric is no longer available (the underlying field may have changed).
      </div>
    )
  }
  return <StatTile label={kpi.label} value={kpi.kind ? formatKpiValue(kpi.raw, kpi.kind, 'auto') : kpi.value} trend={kpi.trend} />
}
