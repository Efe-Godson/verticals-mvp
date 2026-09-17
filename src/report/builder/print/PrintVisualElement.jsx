import FitChartToCell from './FitChartToCell'
// Place at: src/report/builder/print/PrintVisualElement.jsx
// One Report Builder visual placed on a print page (brief §26, §31). Ranking
// shown here is an `override` on this print placement only - it is read
// with a fallback to the visual's own saved query and never written back to
// it, so "Dashboard: Top 10, Print: Top 5" never cross-contaminate.
import { runQuery } from '../../engine'
import VisualRenderer from '../visuals/VisualRenderer'

export default function PrintVisualElement({ visual, form, submissions, override }) {
  if (!visual) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', border: '1px dashed #ccc' }}>
        Visual not found (it may have been deleted)
      </div>
    )
  }

  const query = {
    ...visual.query,
    filters: visual.filters,
    topN: override?.topN !== undefined ? override.topN : visual.query.topN,
    sort: override?.sort || visual.query.sort,
  }
  let result = null
  try { result = runQuery(query, { form, submissions }) } catch { /* leave null, VisualRenderer shows empty state */ }

  return (
    <FitChartToCell fixedHeight>
      <VisualRenderer visual={visual} result={result} form={form} tableStyle={override?.tableStyle} displayOverride={override?.chartStyle} />
    </FitChartToCell>
  )
}
