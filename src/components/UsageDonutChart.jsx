// Place at: src/components/UsageDonutChart.jsx
// Entry-type distribution donut for the Pricing & Usage page's analytics
// section - a ring of stroke-dasharray segments (same technique as
// UsageMeter.jsx's gauge) rather than PieChart.jsx's filled-wedge path
// approach, since this one needs a hollow center for the total-entries
// label and PieChart.jsx is shared elsewhere and not worth risking a
// donut-mode change for. Reuses report/builder/palette.js's seriesColor()
// so slice colors match every other chart in the app (same validated
// categorical ramp, dark-mode aware) instead of a second palette.
import { useState } from 'react'
import { seriesColor } from '../report/builder/palette'
import ChartTooltip, { useChartTooltip } from '../report/components/ChartTooltip'

const MAX_SLICES = 8

export default function UsageDonutChart({ data, centerValue, centerLabel, size = 220, thickness = 30 }) {
  const [hovered, setHovered] = useState(null)
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip()

  const sorted = [...data].filter(d => d.count > 0).sort((a, b) => b.count - a.count)
  const shown = sorted.length > MAX_SLICES ? sorted.slice(0, MAX_SLICES - 1) : sorted
  const rest = sorted.length > MAX_SLICES ? sorted.slice(MAX_SLICES - 1) : []
  const restCount = rest.reduce((s, d) => s + d.count, 0)
  const slicesData = restCount > 0 ? [...shown, { label: 'Other', count: restCount }] : shown

  const total = slicesData.reduce((s, d) => s + d.count, 0) || 1
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  let cumulative = 0
  const segments = slicesData.map((d, i) => {
    const value = d.count / total
    const dash = value * circumference
    const offset = -cumulative * circumference
    cumulative += value
    const isOther = d.label === 'Other' && restCount > 0 && i === slicesData.length - 1
    return { dash, offset, color: isOther ? 'var(--chart-series-other)' : seriesColor(i), label: d.label, count: d.count, percent: Math.round(value * 100) }
  })

  if (slicesData.length === 0) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>No entries recorded yet this period.</p>
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s, i) => (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`} strokeDashoffset={s.offset}
              style={{ cursor: 'default', opacity: hovered !== null && hovered !== s.label ? 0.45 : 1, transition: 'opacity .12s ease' }}
              onMouseEnter={(e) => { setHovered(s.label); showTooltip(e, s.label, `${s.count.toLocaleString()} · ${s.percent}%`) }}
              onMouseMove={moveTooltip}
              onMouseLeave={() => { setHovered(null); hideTooltip() }}
            />
          ))}
        </g>
        <text x="50%" y="47%" textAnchor="middle" fontSize={size * 0.15} fontWeight="700" fill="var(--color-text)">
          {centerValue}
        </text>
        <text x="50%" y="60%" textAnchor="middle" fontSize={size * 0.065} fill="var(--color-muted)">
          {centerLabel}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {segments.map((s, i) => (
          <div
            key={i}
            onMouseEnter={(e) => { setHovered(s.label); showTooltip(e, s.label, `${s.count.toLocaleString()} · ${s.percent}%`) }}
            onMouseMove={moveTooltip}
            onMouseLeave={() => { setHovered(null); hideTooltip() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'default',
              opacity: hovered !== null && hovered !== s.label ? 0.55 : 1,
              fontWeight: hovered === s.label ? 600 : 400,
              transition: 'opacity .12s ease',
            }}
          >
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span style={{ textTransform: 'capitalize' }}>{s.label}</span>
            <span style={{ color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.percent}%</span>
          </div>
        ))}
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  )
}
