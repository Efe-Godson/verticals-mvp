// Place at: src/report/components/PieChart.jsx
// Simple SVG donut/pie chart. Expects data as [{ label, count }] where
// `count` is treated as a share (percentages work well, but any comparable
// magnitude is fine — slices are proportional to count/total).

// Fixed categorical order — a slot always means the same hue, and a 9th+
// category folds into "Other" rather than generating a new color.
const SERIES_COLORS = [
  'var(--chart-series-1)', 'var(--chart-series-2)', 'var(--chart-series-3)', 'var(--chart-series-4)',
  'var(--chart-series-5)', 'var(--chart-series-6)', 'var(--chart-series-7)', 'var(--chart-series-8)',
]
const MAX_SLICES = SERIES_COLORS.length

function PieChart({ data, size = 240 }) {
  const sorted = [...data].sort((a, b) => b.count - a.count)
  const shown = sorted.length > MAX_SLICES ? sorted.slice(0, MAX_SLICES - 1) : sorted
  const rest = sorted.length > MAX_SLICES ? sorted.slice(MAX_SLICES - 1) : []
  const restCount = rest.reduce((sum, d) => sum + d.count, 0)
  const slicesData = restCount > 0 ? [...shown, { label: 'Other', count: restCount }] : shown

  const total = slicesData.reduce((sum, d) => sum + d.count, 0) || 1
  const radius = size / 2
  const center = size / 2

  let cumulative = 0
  const slices = slicesData.map((d, i) => {
    const value = d.count / total
    const startAngle = cumulative * 2 * Math.PI
    cumulative += value
    const endAngle = cumulative * 2 * Math.PI

    const x1 = center + radius * Math.sin(startAngle)
    const y1 = center - radius * Math.cos(startAngle)
    const x2 = center + radius * Math.sin(endAngle)
    const y2 = center - radius * Math.cos(endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

    const path = value >= 0.999
      ? null // single slice covering the whole circle
      : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    const isOther = d.label === 'Other' && restCount > 0 && i === slicesData.length - 1
    return {
      path,
      color: isOther ? 'var(--chart-series-other)' : SERIES_COLORS[i % SERIES_COLORS.length],
      label: d.label,
      percent: Math.round(value * 100)
    }
  })

  return (
    <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          s.path
            ? <path key={i} d={s.path} fill={s.color} stroke="var(--color-surface)" strokeWidth="2">
                <title>{s.label} — {s.percent}%</title>
              </path>
            : <circle key={i} cx={center} cy={center} r={radius} fill={s.color}>
                <title>{s.label} — {s.percent}%</title>
              </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span>{s.label} — <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.percent}%</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PieChart
