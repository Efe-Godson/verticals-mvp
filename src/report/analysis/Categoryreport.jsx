// Place at: src/report/analysis/Categoryreport.jsx
import HorizontalBarChart from '../components/HorizontalBarChart'

function CategoryReport({ field, answered, totalResponses, multi }) {
  if (answered.length === 0) return <p style={{ color: '#999' }}>No responses yet.</p>

  const countMap = {}
  answered.forEach(s => {
    const val = s.data[field.id]
    if (multi) {
      (Array.isArray(val) ? val : []).forEach(opt => {
        countMap[opt] = (countMap[opt] || 0) + 1
      })
    } else if (val) {
      countMap[val] = (countMap[val] || 0) + 1
    }
  })

  const breakdown = Object.entries(countMap)
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / totalResponses) * 100)
    }))
    .sort((a, b) => b.count - a.count)

  const top = breakdown[0]

  return (
    <div>
      <HorizontalBarChart data={breakdown} bare />
      {top && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
          {top.label} is the most common choice, at {top.percent}% of responses.
        </p>
      )}
    </div>
  )
}

export default CategoryReport
