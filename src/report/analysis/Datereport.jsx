// Place at: src/report/analysis/Datereport.jsx
import StatTile from '../components/StatTile'
import HorizontalBarChart from '../components/HorizontalBarChart'

function DateReport({ field, answered }) {
  if (answered.length === 0) return <p style={{ color: '#999' }}>No responses yet.</p>

  const dayCounts = {}
  const monthCounts = {}

  answered.forEach(s => {
    const raw = s.data[field.id]
    const d = new Date(raw)
    if (isNaN(d)) return
    const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' })
    const monthName = d.toLocaleDateString('en-GB', { month: 'long' })
    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1
    monthCounts[monthName] = (monthCounts[monthName] || 0) + 1
  })

  const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
  const peakMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const dayBreakdown = dayOrder
    .filter(d => dayCounts[d])
    .map(d => ({
      label: d,
      count: dayCounts[d],
      percent: Math.round((dayCounts[d] / answered.length) * 100)
    }))

  return (
    <div style={{ marginTop: '0.8rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
        <StatTile label="Peak Day" value={peakDay ? peakDay[0] : '—'} />
        <StatTile label="Peak Month" value={peakMonth ? peakMonth[0] : '—'} />
      </div>

      <HorizontalBarChart title="By day of week" data={dayBreakdown} bare />

      {peakDay && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
          {peakDay[0]} is the busiest day, accounting for {Math.round((peakDay[1] / answered.length) * 100)}% of responses.
        </p>
      )}
    </div>
  )
}

export default DateReport
