// Place at: src/report/analysis/Cartreport.jsx
import StatTile from '../components/StatTile'
import HorizontalBarChart from '../components/HorizontalBarChart'
import { formatNaira } from '../helpers/analysisUtils'

function CartReport({ field, answered, showStats = true }) {
  if (answered.length === 0) return <p style={{ color: '#999' }}>No orders yet.</p>

  const totals = answered.map(s => s.data[field.id].total)
  const totalRevenue = totals.reduce((a, b) => a + b, 0)
  const avgOrder = totalRevenue / totals.length

  const itemQty = {}
  const itemRevenue = {}
  const categoryQty = {}
  const categoryRevenue = {}

  answered.forEach(s => {
    s.data[field.id].items.forEach(item => {
      itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
      itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
      // Each line item carries its own category (see PublicForm.jsx's
      // submitAnswers), so one order spanning several categories splits
      // correctly here instead of collapsing to a single bucket.
      const category = item.category?.trim() || 'Uncategorized'
      categoryQty[category] = (categoryQty[category] || 0) + item.quantity
      categoryRevenue[category] = (categoryRevenue[category] || 0) + item.price * item.quantity
    })
  })

  const topByQty = Object.entries(itemQty)
    .map(([name, qty]) => ({ label: name, count: qty }))
    .sort((a, b) => b.count - a.count)

  const topByRevenue = Object.entries(itemRevenue)
    .map(([name, revenue]) => ({ label: name, count: revenue }))
    .sort((a, b) => b.count - a.count)

  // Only worth its own section once there's an actual split to show - a
  // single category (or every item uncategorized) just re-states the
  // product breakdown above with one bar.
  const hasCategoryBreakdown = Object.keys(categoryRevenue).length > 1

  const categoryByRevenue = Object.entries(categoryRevenue)
    .map(([name, revenue]) => ({ label: name, count: revenue }))
    .sort((a, b) => b.count - a.count)

  const categoryByQty = Object.entries(categoryQty)
    .map(([name, qty]) => ({ label: name, count: qty }))
    .sort((a, b) => b.count - a.count)

  return (
    <div style={{ marginTop: showStats ? '0.8rem' : 0 }}>
      {showStats && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <StatTile label="Total Revenue" value={formatNaira(totalRevenue)} />
          <StatTile label="Orders" value={answered.length.toLocaleString()} />
          <StatTile label="Average Order" value={formatNaira(avgOrder)} />
        </div>
      )}

      <div style={{ display: 'grid', gap: '2.2rem' }}>
        {topByRevenue.length > 0 && (
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.9rem' }}>
              Revenue by Product{topByRevenue.length > 10 ? ' (top 10)' : ''}
            </div>
            <HorizontalBarChart data={topByRevenue.slice(0, 10)} formatValue={(v) => formatNaira(v)} bare />
          </div>
        )}

        {topByQty.length > 0 && (
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.9rem' }}>
              Units Sold by Product{topByQty.length > 10 ? ' (top 10)' : ''}
            </div>
            <HorizontalBarChart data={topByQty.slice(0, 10)} bare />
          </div>
        )}

        {hasCategoryBreakdown && (
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.9rem' }}>
              Revenue by Category
            </div>
            <HorizontalBarChart data={categoryByRevenue} formatValue={(v) => formatNaira(v)} bare />
          </div>
        )}

        {hasCategoryBreakdown && (
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.9rem' }}>
              Units Sold by Category
            </div>
            <HorizontalBarChart data={categoryByQty} bare />
          </div>
        )}
      </div>
    </div>
  )
}

export default CartReport

// The same four cart charts (Revenue / Units, by Product / by Category) but
// as separate tile descriptors, so the Reports page can give each its own
// card instead of bundling them into one. StatTiles are omitted - the page
// carries its own KPI row.
export function cartReportTiles({ field, answered }) {
  if (!answered || answered.length === 0) return []

  const itemQty = {}
  const itemRevenue = {}
  const categoryQty = {}
  const categoryRevenue = {}

  answered.forEach(s => {
    ;(s.data[field.id]?.items || []).forEach(item => {
      itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
      itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
      const category = item.category?.trim() || 'Uncategorized'
      categoryQty[category] = (categoryQty[category] || 0) + item.quantity
      categoryRevenue[category] = (categoryRevenue[category] || 0) + item.price * item.quantity
    })
  })

  const toSorted = (obj) => Object.entries(obj)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const byRev = toSorted(itemRevenue)
  const byQty = toSorted(itemQty)
  const catRev = toSorted(categoryRevenue)
  const catQty = toSorted(categoryQty)
  const hasCategoryBreakdown = Object.keys(categoryRevenue).length > 1

  const tiles = []
  if (byRev.length > 0) {
    tiles.push({
      id: `cart-${field.id}-rev`,
      title: `Revenue by Product${byRev.length > 10 ? ' (top 10)' : ''}`,
      node: <HorizontalBarChart data={byRev.slice(0, 10)} formatValue={(v) => formatNaira(v)} bare />,
    })
  }
  if (byQty.length > 0) {
    tiles.push({
      id: `cart-${field.id}-qty`,
      title: `Units Sold by Product${byQty.length > 10 ? ' (top 10)' : ''}`,
      node: <HorizontalBarChart data={byQty.slice(0, 10)} bare />,
    })
  }
  if (hasCategoryBreakdown) {
    tiles.push({
      id: `cart-${field.id}-catrev`,
      title: 'Revenue by Category',
      node: <HorizontalBarChart data={catRev} formatValue={(v) => formatNaira(v)} bare />,
    })
    tiles.push({
      id: `cart-${field.id}-catqty`,
      title: 'Units Sold by Category',
      node: <HorizontalBarChart data={catQty} bare />,
    })
  }
  return tiles
}