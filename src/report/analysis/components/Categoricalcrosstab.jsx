// Place at: src/report/analysis/components/Categoricalcrosstab.jsx
import { getFieldValues, thStyle, tdStyle } from '../../helpers/analysisUtils'

function CategoricalCrossTab({ fieldA, fieldB, submissions }) {
  const rowLabels = fieldA.options || []
  const colLabels = fieldB.options || []

  const matrix = {}
  rowLabels.forEach(r => { matrix[r] = {}; colLabels.forEach(c => { matrix[r][c] = 0 }) })

  let grandTotal = 0
  submissions.forEach(sub => {
    const aVals = getFieldValues(sub, fieldA)
    const bVals = getFieldValues(sub, fieldB)
    aVals.forEach(a => {
      bVals.forEach(b => {
        if (matrix[a] && matrix[a][b] !== undefined) {
          matrix[a][b] += 1
          grandTotal += 1
        }
      })
    })
  })

  if (grandTotal === 0) return <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>{fieldA.label} \ {fieldB.label}</th>
            {colLabels.map(c => <th key={c} style={{ ...thStyle, textAlign: 'right' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map(r => (
            <tr key={r}>
              <td style={tdStyle}>{r}</td>
              {colLabels.map(c => {
                const count = matrix[r][c]
                const percent = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0
                return (
                  <td key={c} style={{ ...tdStyle, textAlign: 'right' }}>
                    {count} <span style={{ color: '#999', fontSize: '0.8rem' }}>({percent}%)</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CategoricalCrossTab
