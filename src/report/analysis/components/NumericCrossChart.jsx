// Place at: src/report/analysis/components/NumericCrossChart.jsx
// Category x Number: shares of a numeric field's total, grouped by category.
// Shown as percentage share, no tables.
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { getFieldValues } from '../../helpers/analysisUtils'

function NumericCrossChart({ categoryField, numberField, submissions }) {
  const groups = {}
  let grandTotal = 0

  submissions.forEach(sub => {
    const num = Number(sub.data[numberField.id])
    if (isNaN(num)) return
    getFieldValues(sub, categoryField).forEach(val => {
      groups[val] = (groups[val] || 0) + num
      grandTotal += num
    })
  })

  const data = Object.entries(groups)
    .map(([label, total]) => ({
      label,
      count: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)

  if (data.length === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  const top = data[0]

  return (
    <div>
      <HorizontalBarChart data={data} formatValue={(v) => `${v}%`} />
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
        {top.label} accounts for {top.count}% of total {numberField.label.toLowerCase()}.
      </p>
    </div>
  )
}

export default NumericCrossChart
