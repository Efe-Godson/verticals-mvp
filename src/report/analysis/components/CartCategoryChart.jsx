// Place at: src/report/analysis/components/CartCategoryChart.jsx
// Chart version of "cart revenue grouped by a categorical field" — replaces
// the old table-based CartCrossTab for this use case (no tables).
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { getFieldValues, formatNaira } from '../../helpers/analysisUtils'

function CartCategoryChart({ categoryField, cartField, submissions }) {
  const groups = {}
  let totalRevenue = 0

  submissions.forEach(sub => {
    const cartVal = sub.data[cartField.id]
    if (!cartVal || !cartVal.items || cartVal.items.length === 0) return
    totalRevenue += cartVal.total

    getFieldValues(sub, categoryField).forEach(val => {
      groups[val] = (groups[val] || 0) + cartVal.total
    })
  })

  const data = Object.entries(groups)
    .map(([label, revenue]) => ({
      label,
      count: revenue,
      percent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)

  if (data.length === 0) return <p style={{ color: '#999' }}>Not enough order data yet.</p>

  const top = data[0]

  return (
    <div>
      <HorizontalBarChart data={data} formatValue={(v) => formatNaira(v)} />
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
        {top.label} leads with {formatNaira(top.count)} in sales ({top.percent}% of revenue).
      </p>
    </div>
  )
}

export default CartCategoryChart
