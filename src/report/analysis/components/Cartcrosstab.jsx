// Place at: src/report/analysis/components/Cartcrosstab.jsx
import { getFieldValues, thStyle, tdStyle } from '../../helpers/analysisUtils'

function CartCrossTab({ fieldA, fieldB, submissions }) {
  const groups = {}
  let totalRevenue = 0
  let totalTransactions = 0

  submissions.forEach(sub => {
    const cartVal = sub.data[fieldB.id]
    if (!cartVal || !cartVal.items || cartVal.items.length === 0) return
    totalTransactions += 1
    totalRevenue += cartVal.total

    getFieldValues(sub, fieldA).forEach(a => {
      if (!groups[a]) groups[a] = { revenue: 0, transactions: 0 }
      groups[a].revenue += cartVal.total
      groups[a].transactions += 1
    })
  })

  const rows = Object.entries(groups)
    .map(([label, g]) => ({
      label,
      revenue: g.revenue,
      transactions: g.transactions,
      revenuePercent: totalRevenue > 0 ? Math.round((g.revenue / totalRevenue) * 100) : 0,
      transactionPercent: totalTransactions > 0 ? Math.round((g.transactions / totalTransactions) * 100) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)

  if (rows.length === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  const top = rows[0]
  const gap = top.revenuePercent - top.transactionPercent
  const insight = Math.abs(gap) >= 10
    ? `${top.label} drives ${top.revenuePercent}% of revenue from just ${top.transactionPercent}% of orders.`
    : null

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>{fieldA.label}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Revenue</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Orders</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td style={tdStyle}>{r.label}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.revenue.toLocaleString()}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.revenuePercent}%</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.transactions}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.transactionPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {insight && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '1rem' }}>{insight}</p>
      )}
    </div>
  )
}

export default CartCrossTab
