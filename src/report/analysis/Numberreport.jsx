// Place at: src/report/analysis/Numberreport.jsx
import StatTile from '../components/StatTile'
import { median } from '../helpers/analysisUtils'

function NumberReport({ field, answered }) {
  const values = answered.map(s => Number(s.data[field.id])).filter(v => !isNaN(v))
  if (values.length === 0) return <p style={{ color: '#999' }}>No numeric responses yet.</p>

  const total = values.reduce((a, b) => a + b, 0)
  const avg = total / values.length
  const med = median(values)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return (
    <div style={{ marginTop: '0.8rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <StatTile label="Total" value={total.toLocaleString()} />
        <StatTile label="Average" value={Math.round(avg).toLocaleString()} />
        <StatTile label="Median" value={med.toLocaleString()} />
        <StatTile label="Min" value={min.toLocaleString()} />
        <StatTile label="Max" value={max.toLocaleString()} />
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
        Responses average {Math.round(avg).toLocaleString()}, ranging from {min.toLocaleString()} to {max.toLocaleString()}.
      </p>
    </div>
  )
}

export default NumberReport
