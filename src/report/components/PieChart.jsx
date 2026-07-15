// Place at: src/report/components/PieChart.jsx
// Simple SVG donut/pie chart. Expects data as [{ label, count }] where
// `count` is treated as a share (percentages work well, but any comparable
// magnitude is fine — slices are proportional to count/total).
function PieChart({ data, size = 240 }) {
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1
  const radius = size / 2
  const center = size / 2

  const colors = ['#0070f3', '#f5a623', '#7928ca', '#50e3c2', '#ff4d4f', '#13c2c2', '#eb2f96', '#faad14', '#52c41a', '#2f54eb']

  let cumulative = 0
  const slices = data.map((d, i) => {
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

    return {
      path,
      color: colors[i % colors.length],
      label: d.label,
      percent: Math.round(value * 100)
    }
  })

  return (
    <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          s.path
            ? <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1" />
            : <circle key={i} cx={center} cy={center} r={radius} fill={s.color} />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span>{s.label} — {s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PieChart
