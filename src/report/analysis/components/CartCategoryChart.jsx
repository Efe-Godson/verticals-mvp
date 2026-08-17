// Place at: src/report/analysis/components/CartCategoryChart.jsx
// Chart version of "cart revenue grouped by a categorical field", replaces
// the old table-based CartCrossTab for this use case (no tables).
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { getFieldValues, formatNaira } from '../../helpers/analysisUtils'

function CartCategoryChart({ categoryField, cartField, submissions }) {
  const revenueGroups = {}
  const orderGroups = {}
  let totalRevenue = 0
  let totalOrders = 0

  submissions.forEach(sub => {
    const cartVal = sub.data[cartField.id]
    if (!cartVal || !cartVal.items || cartVal.items.length === 0) return
    const grandTotal = cartVal.total + (cartVal.deliveryFee || 0)
    totalRevenue += grandTotal
    totalOrders += 1

    getFieldValues(sub, categoryField).forEach(val => {
      revenueGroups[val] = (revenueGroups[val] || 0) + grandTotal
      orderGroups[val] = (orderGroups[val] || 0) + 1
    })
  })

  const data = Object.entries(revenueGroups)
    .map(([label, revenue]) => ({
      label,
      count: revenue,
      percent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)

  if (data.length === 0) return <p style={{ color: '#999' }}>Not enough order data yet.</p>

  const orderData = Object.entries(orderGroups)
    .map(([label, orders]) => ({
      label,
      count: orders,
      percent: totalOrders > 0 ? Math.round((orders / totalOrders) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)

  const top = data[0]

  return (
    <div>
      <HorizontalBarChart data={data} formatValue={(v) => formatNaira(v)} />
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
        {top.label} leads with {formatNaira(top.count)} in sales ({top.percent}% of revenue).
      </p>

      <div style={{ marginTop: '1.5rem' }}>
        <HorizontalBarChart title="Orders" data={orderData} bare />
      </div>
    </div>
  )
}

export default CartCategoryChart
