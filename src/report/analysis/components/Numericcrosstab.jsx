// Place at: src/report/analysis/components/Numericcrosstab.jsx
import { getFieldValues, thStyle, tdStyle } from '../../helpers/analysisUtils'

function NumericCrossTab({ fieldA, fieldB, submissions }) {
  const groups = {}

  submissions.forEach(sub => {
    const numB = Number(sub.data[fieldB.id])
    if (isNaN(numB)) return
    getFieldValues(sub, fieldA).forEach(a => {
      if (!groups[a]) groups[a] = { count: 0, sum: 0 }
      groups[a].count += 1
      groups[a].sum += numB
    })
  })

  const rows = Object.entries(groups)
    .map(([label, g]) => ({ label, count: g.count, total: g.sum, average: g.sum / g.count }))
    .sort((a, b) => b.total - a.total)

  if (rows.length === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>{fieldA.label}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Count</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Total {fieldB.label}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Average</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td style={tdStyle}>{r.label}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.count}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.total.toLocaleString()}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{r.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                {grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default NumericCrossTab
