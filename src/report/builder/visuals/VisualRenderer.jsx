// Place at: src/report/builder/visuals/VisualRenderer.jsx
// The "Visual Renderer" box of the pipeline (brief §11). Takes a visual
// definition + a StandardResult (already produced by runQuery) and draws
// it. The SAME result renders as bar/pie/donut/table without re-querying.
//
// Bar/Line/Pie/Scatter are lazy-loaded: they're the only branches that pull
// in recharts (a large dependency), so a report that only ever shows
// KPI/Pivot/Table visuals never downloads it, and visiting the Report /
// Report Builder / Print routes no longer means fetching every chart
// engine up front. One Suspense boundary covers all four; KPI/Pivot/Table/
// Empty stay synchronous (unaffected by Suspense) since they don't need
// recharts at all.
//
// This module is itself already lazy-loaded from its callers (Report
// Builder canvas, promoted Reports grid, Focus Mode, Print/PDF), so no
// SSR path renders it (src/entry-server.jsx only prerenders the standalone
// marketing pages, never the report builder). The Print/PDF export
// (src/reportExport.js) snapshots the DOM with html2canvas *after* the
// visuals are already mounted on screen in the print workspace, so by the
// time a user clicks "Download PDF" the relevant chart chunks have already
// been requested/resolved - no extra handling needed there.
import { lazy, Suspense } from 'react'
import KpiViz from './KpiViz'
import PivotViz from './PivotViz'
import { SummaryTableViz, DataTableViz } from './TableViz'
import { EmptyViz } from './ChartFrame'
import { SkeletonChart } from '../../../components/Skeleton'

const BarViz = lazy(() => import('./BarViz'))
const LineViz = lazy(() => import('./LineViz'))
const PieViz = lazy(() => import('./PieViz'))
const ScatterViz = lazy(() => import('./ScatterViz'))

const BAR_VARIANTS = ['bar', 'hbar', 'groupedBar', 'stackedBar', 'stackedBar100']
const LINE_VARIANTS = ['line', 'multiLine', 'area', 'stackedArea']

function ChartFallback() {
  return <SkeletonChart style={{ height: '100%', minHeight: 160 }} />
}

export default function VisualRenderer({ visual, result, form, onSelectDatapoint }) {
  if (!result) return <EmptyViz message="Configure this visual on the right." />
  const type = visual.type

  if (['kpi', 'number', 'comparison', 'progress'].includes(type)) {
    return <KpiViz result={result} visual={visual} display={visual.display || {}} />
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

  let chart = null
  if (BAR_VARIANTS.includes(type)) {
    chart = <BarViz result={result} variant={type} display={visual.display || {}} onSelectDatapoint={onSelectDatapoint} />
  } else if (LINE_VARIANTS.includes(type)) {
    chart = <LineViz result={result} variant={type} display={visual.display || {}} />
  } else if (type === 'pie' || type === 'donut') {
    chart = <PieViz result={result} variant={type} display={visual.display || {}} onSelectDatapoint={onSelectDatapoint} />
  } else if (type === 'scatter') {
    chart = <ScatterViz result={result} onSelectDatapoint={onSelectDatapoint} />
  }
  if (chart) {
    return <Suspense fallback={<ChartFallback />}>{chart}</Suspense>
  }

  return <EmptyViz message={`Unknown visual type: ${type}`} />
}
