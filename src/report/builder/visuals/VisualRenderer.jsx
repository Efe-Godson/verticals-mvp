// Place at: src/report/builder/visuals/VisualRenderer.jsx
// The "Visual Renderer" box of the pipeline (brief §11). Takes a visual
// definition + a StandardResult (already produced by runQuery) and draws
// it. The SAME result renders as bar/pie/donut/table without re-querying.
import BarViz from './BarViz'
import LineViz from './LineViz'
import PieViz from './PieViz'
import ScatterViz from './ScatterViz'
import KpiViz from './KpiViz'
import PivotViz from './PivotViz'
import { SummaryTableViz, DataTableViz } from './TableViz'
import { EmptyViz } from './ChartFrame'

const BAR_VARIANTS = ['bar', 'hbar', 'groupedBar', 'stackedBar', 'stackedBar100']
const LINE_VARIANTS = ['line', 'multiLine', 'area', 'stackedArea']

export default function VisualRenderer({ visual, result, form, onSelectDatapoint }) {
  if (!result) return <EmptyViz message="Configure this visual on the right." />
  const type = visual.type

  if (['kpi', 'number', 'comparison', 'progress'].includes(type)) {
    return <KpiViz result={result} visual={visual} display={visual.display || {}} />
  }
  if (BAR_VARIANTS.includes(type)) {
    return <BarViz result={result} variant={type} display={visual.display || {}} onSelectDatapoint={onSelectDatapoint} />
  }
  if (LINE_VARIANTS.includes(type)) {
    return <LineViz result={result} variant={type} display={visual.display || {}} />
  }
  if (type === 'pie' || type === 'donut') {
    return <PieViz result={result} variant={type} display={visual.display || {}} onSelectDatapoint={onSelectDatapoint} />
  }
  if (type === 'scatter') {
    return <ScatterViz result={result} onSelectDatapoint={onSelectDatapoint} />
  }
  if (type === 'pivot') {
    return <PivotViz result={result} />
  }
  if (type === 'summaryTable') {
    return <SummaryTableViz result={result} />
  }
  if (type === 'table') {
    return <DataTableViz result={result} form={form} />
  }
  return <EmptyViz message={`Unknown visual type: ${type}`} />
}
