// Place at: src/report/analysis/components/CategoricalCrossChart.jsx
// Category x Category, flattened into combined labels (e.g. "Lagos x VIP"),
// each shown as a percentage share of all responses. No tables.
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { getFieldValues } from '../../helpers/analysisUtils'

function CategoricalCrossChart({ fieldA, fieldB, submissions }) {
  const counts = {}
  let total = 0

  submissions.forEach(sub => {
    const aVals = getFieldValues(sub, fieldA)
    const bVals = getFieldValues(sub, fieldB)
    aVals.forEach(a => {
      bVals.forEach(b => {
        const key = `${a} × ${b}`
        counts[key] = (counts[key] || 0) + 1
        total += 1
      })
    })
  })

  const data = Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  if (data.length === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  const top = data[0]

  return (
    <div>
      <HorizontalBarChart data={data} formatValue={(v) => `${v}%`} />
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
        {top.label} is the most common combination, making up {top.count}% of responses.
      </p>
    </div>
  )
}

export default CategoricalCrossChart
