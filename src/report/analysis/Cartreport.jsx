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

  answered.forEach(s => {
    s.data[field.id].items.forEach(item => {
      itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
      itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
    })
  })

  const topByQty = Object.entries(itemQty)
    .map(([name, qty]) => ({ label: name, count: qty }))
    .sort((a, b) => b.count - a.count)

  const topByRevenue = Object.entries(itemRevenue)
    .map(([name, revenue]) => ({ label: name, count: revenue }))
    .sort((a, b) => b.count - a.count)

  const bestSeller = topByQty[0]
  const topEarner = topByRevenue[0]

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
        {topByQty.length > 0 && (
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.9rem' }}>
              Units Sold by Product{topByQty.length > 10 ? ' (top 10)' : ''}
            </div>
            <HorizontalBarChart data={topByQty.slice(0, 10)} />
            {bestSeller && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
                {bestSeller.label} is the best seller, with {bestSeller.count.toLocaleString()} units sold.
              </p>
            )}
          </div>
        )}

        {topByRevenue.length > 0 && (
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.9rem' }}>
              Revenue by Product{topByRevenue.length > 10 ? ' (top 10)' : ''}
            </div>
            <HorizontalBarChart data={topByRevenue.slice(0, 10)} formatValue={(v) => formatNaira(v)} />
            {topEarner && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
                {topEarner.label} generates the most revenue, at {formatNaira(topEarner.count)}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CartReport
