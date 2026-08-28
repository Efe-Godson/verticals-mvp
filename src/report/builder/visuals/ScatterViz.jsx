// Place at: src/report/builder/visuals/ScatterViz.jsx
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from 'recharts'
import { VizBox, EmptyViz, axisTick, gridStroke } from './ChartFrame'
import { seriesColor } from '../palette'
import { formatNumber } from '../format'

export default function ScatterViz({ result, onSelectDatapoint }) {
  const points = result?.points || []
  if (!points.length) return <EmptyViz message="Pick an X and a Y number field." />
  const axes = result.axes || { x: 'X', y: 'Y' }

  return (
    <VizBox>
      <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis type="number" dataKey="x" name={axes.x} tick={axisTick} tickFormatter={formatNumber}
          label={{ value: axes.x, position: 'insideBottom', offset: -8, fontSize: 11, fill: 'var(--color-muted)' }} />
        <YAxis type="number" dataKey="y" name={axes.y} tick={axisTick} tickFormatter={formatNumber} width={56}
          label={{ value: axes.y, angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-muted)' }} />
        <ZAxis range={[50, 50]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(v, n) => [formatNumber(v), n]}
          labelFormatter={() => ''}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Scatter data={points} fill={seriesColor(0)} fillOpacity={0.7}
          onClick={(e) => onSelectDatapoint && e && e.label && onSelectDatapoint({ dimension: result.query?.dimension || null, value: e.label })}
          cursor={onSelectDatapoint ? 'pointer' : undefined} />
      </ScatterChart>
    </VizBox>
  )
}
