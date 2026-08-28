// Place at: src/report/builder/visuals/PieViz.jsx
// Pie / donut (donut = inner radius). Caps to 8 slices + "Other", matching
// the hand-rolled src/report/components/PieChart.jsx behaviour.
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { VizBox, EmptyViz } from './ChartFrame'
import { seriesColor } from '../palette'
import { chartPalette } from '../palette'
import { valueFormatter } from '../format'

export default function PieViz({ result, variant = 'pie', display = {}, onSelectDatapoint }) {
  const rows = result?.rows || []
  if (!rows.length) return <EmptyViz />
  const fmt = valueFormatter(result)

  const sorted = [...rows].sort((a, b) => b.value - a.value)
  let data = sorted.slice(0, 8).map(r => ({ name: r.label, value: r.value }))
  if (sorted.length > 8) {
    data.push({ name: 'Other', value: sorted.slice(8).reduce((s, r) => s + r.value, 0), __other: true })
  }
  const total = data.reduce((s, d) => s + d.value, 0) || 1

  return (
    <VizBox>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius={variant === 'donut' ? '55%' : 0} outerRadius="80%" paddingAngle={1}
          onClick={(e) => onSelectDatapoint && e && onSelectDatapoint({ dimension: result.query?.dimension || null, value: e.name })}
          cursor={onSelectDatapoint ? 'pointer' : undefined}
          label={display.labels ? (e) => `${Math.round((e.value / total) * 100)}%` : false}
          labelLine={false}
        >
          {data.map((d, i) => <Cell key={i} fill={d.__other ? chartPalette().other : seriesColor(i)} stroke="var(--color-surface)" strokeWidth={2} />)}
        </Pie>
        <Tooltip formatter={(v) => `${fmt(v)} (${Math.round((v / total) * 100)}%)`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        {display.legend !== false && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </PieChart>
    </VizBox>
  )
}
