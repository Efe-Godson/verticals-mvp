// Place at: src/report/builder/visuals/BarViz.jsx
// Bar family: vertical / horizontal / grouped / stacked / 100% stacked -
// all off one StandardResult. Grouped & stacked read result.seriesLabels +
// row.bySeries; the plain bars read row.value.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts'
import { VizBox, EmptyViz, axisTick, gridStroke } from './ChartFrame'
import { seriesColor } from '../palette'
import { valueFormatter } from '../format'

export default function BarViz({ result, variant = 'bar', display = {}, onSelectDatapoint }) {
  const rows = result?.rows || []
  if (!rows.length) return <EmptyViz />
  const fmt = valueFormatter(result)
  const horizontal = variant === 'hbar'
  const grouped = variant === 'groupedBar'
  const stacked = variant === 'stackedBar' || variant === 'stackedBar100'
  const pct100 = variant === 'stackedBar100'
  const seriesLabels = (grouped || stacked) ? (result.seriesLabels || []) : null

  const data = rows.map(r => {
    if (!seriesLabels) return { name: r.label, value: r.value, __key: r.key }
    const row = { name: r.label, __key: r.key }
    if (pct100) {
      const tot = seriesLabels.reduce((s, sl) => s + (r.bySeries?.[sl] || 0), 0) || 1
      seriesLabels.forEach(sl => { row[sl] = ((r.bySeries?.[sl] || 0) / tot) * 100 })
    } else {
      seriesLabels.forEach(sl => { row[sl] = r.bySeries?.[sl] || 0 })
    }
    return row
  })

  const click = (entry) => {
    if (!onSelectDatapoint || !entry) return
    onSelectDatapoint({ dimension: result.query?.dimension || null, value: entry.name })
  }

  return (
    <VizBox>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, bottom: 4, left: horizontal ? 8 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={horizontal} horizontal={!horizontal} />
        {horizontal
          ? <><XAxis type="number" tick={axisTick} tickFormatter={pct100 ? (v) => `${Math.round(v)}%` : fmt} /><YAxis type="category" dataKey="name" tick={axisTick} width={110} /></>
          : <><XAxis dataKey="name" tick={axisTick} interval="preserveStartEnd" /><YAxis tick={axisTick} tickFormatter={pct100 ? (v) => `${Math.round(v)}%` : fmt} /></>}
        <Tooltip formatter={(v) => pct100 ? `${(+v).toFixed(1)}%` : fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        {(display.legend !== false && seriesLabels) && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {seriesLabels
          ? seriesLabels.map((sl, i) => (
              <Bar key={sl} dataKey={sl} stackId={stacked ? 'a' : undefined} fill={seriesColor(i)} radius={stacked ? 0 : [2, 2, 0, 0]} />
            ))
          : <Bar dataKey="value" radius={horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]} onClick={click} cursor={onSelectDatapoint ? 'pointer' : undefined}>
              {data.map((d, i) => <Cell key={i} fill={seriesColor(i % 8)} />)}
            </Bar>}
      </BarChart>
    </VizBox>
  )
}
