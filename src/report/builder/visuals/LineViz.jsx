// Place at: src/report/builder/visuals/LineViz.jsx
// Line / multi-line / area / stacked-area - one component, `variant` picks.
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { VizBox, EmptyViz, axisTick, gridStroke } from './ChartFrame'
import { seriesColor } from '../palette'
import { valueFormatter } from '../format'

export default function LineViz({ result, variant = 'line', display = {} }) {
  const rows = result?.rows || []
  if (!rows.length) return <EmptyViz />
  const fmt = valueFormatter(result)
  const isArea = variant === 'area' || variant === 'stackedArea'
  const stacked = variant === 'stackedArea'
  const multi = (variant === 'multiLine' || isArea) && result.seriesLabels
  const seriesLabels = multi ? result.seriesLabels : null

  const data = rows.map(r => {
    if (!seriesLabels) return { name: r.label, value: r.value }
    const row = { name: r.label }
    seriesLabels.forEach(sl => { row[sl] = r.bySeries?.[sl] || 0 })
    return row
  })

  const Chart = isArea ? AreaChart : LineChart
  const Series = isArea ? Area : Line

  return (
    <VizBox>
      <Chart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="name" tick={axisTick} interval="preserveStartEnd" />
        <YAxis tick={axisTick} tickFormatter={fmt} width={56} />
        <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        {(display.legend !== false && seriesLabels) && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {seriesLabels
          ? seriesLabels.map((sl, i) => (
              <Series key={sl} type="monotone" dataKey={sl} stackId={stacked ? 'a' : undefined}
                stroke={seriesColor(i)} fill={seriesColor(i)} fillOpacity={isArea ? 0.18 : 1} strokeWidth={2} dot={false} />
            ))
          : <Series type="monotone" dataKey="value" stroke={seriesColor(0)} fill={seriesColor(0)}
              fillOpacity={isArea ? 0.18 : 1} strokeWidth={2} dot={rows.length <= 20} />}
      </Chart>
    </VizBox>
  )
}
