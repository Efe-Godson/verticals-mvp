// Place at: src/report/analysis/components/CartCategoryChart.jsx
// "Cart revenue grouped by a categorical field" - two charts: revenue by
// value, and order count by value. On the Reports page these are handed
// out as separate tiles (cartCategoryTiles); the default component still
// renders both stacked for anywhere that wants the combined view.
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { getFieldValues, formatNaira } from '../../helpers/analysisUtils'

function aggregate({ categoryField, cartField, submissions }) {
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
      percent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const orderData = Object.entries(orderGroups)
    .map(([label, orders]) => ({
      label,
      count: orders,
      percent: totalOrders > 0 ? Math.round((orders / totalOrders) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return { data, orderData }
}

// Two separate tile descriptors for the Reports page.
export function cartCategoryTiles({ categoryField, cartField, submissions }) {
  const { data, orderData } = aggregate({ categoryField, cartField, submissions })
  if (data.length === 0) return []
  const base = `cat-${categoryField.id}-${cartField.id}`
  return [
    {
      id: `${base}-rev`,
      title: `Sales by ${categoryField.label}`,
      node: <HorizontalBarChart data={data} formatValue={(v) => formatNaira(v)} bare />,
    },
    {
      id: `${base}-ord`,
      title: `Orders by ${categoryField.label}`,
      node: <HorizontalBarChart data={orderData} bare />,
    },
  ]
}

function CartCategoryChart({ categoryField, cartField, submissions }) {
  const { data, orderData } = aggregate({ categoryField, cartField, submissions })
  if (data.length === 0) return <p style={{ color: '#999' }}>Not enough order data yet.</p>

  return (
    <div>
      <HorizontalBarChart data={data} formatValue={(v) => formatNaira(v)} />
      <div style={{ marginTop: '1.5rem' }}>
        <HorizontalBarChart title="Orders" data={orderData} bare />
      </div>
    </div>
  )
}

export default CartCategoryChart
