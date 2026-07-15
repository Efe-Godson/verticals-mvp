// Place at: src/report/analysis/CrossAnalysis.jsx
// Interactive: pick any two columns, pick a chart type (bar or pie).
import { useState } from 'react'
import HorizontalBarChart from '../components/HorizontalBarChart'
import PieChart from '../components/PieChart'
import { getFieldValues } from '../helpers/analysisUtils'

const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox']
const NUMERIC_TYPES = ['number', 'rating', 'linearscale']

function buildCategoricalCross(fieldA, fieldB, submissions) {
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

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function buildNumericCross(categoryField, numberField, submissions) {
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

  return Object.entries(groups)
    .map(([label, total]) => ({ label, count: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
}

function CrossAnalysis({ fields, submissions }) {
  const eligible = (fields || []).filter(f =>
    CATEGORICAL_TYPES.includes(f.type) || NUMERIC_TYPES.includes(f.type)
  )

  const [fieldAId, setFieldAId] = useState(eligible[0]?.id || '')
  const [fieldBId, setFieldBId] = useState(eligible[1]?.id || '')
  const [chartType, setChartType] = useState('bar')

  if (eligible.length < 2) return null

  const fieldA = eligible.find(f => f.id === fieldAId)
  const fieldB = eligible.find(f => f.id === fieldBId)

  let data = []
  let validCombo = false

  if (fieldA && fieldB && fieldA.id !== fieldB.id) {
    const aCategory = CATEGORICAL_TYPES.includes(fieldA.type)
    const bCategory = CATEGORICAL_TYPES.includes(fieldB.type)
    const aNumber = NUMERIC_TYPES.includes(fieldA.type)
    const bNumber = NUMERIC_TYPES.includes(fieldB.type)

    if (aCategory && bCategory) {
      data = buildCategoricalCross(fieldA, fieldB, submissions)
      validCombo = true
    } else if (aCategory && bNumber) {
      data = buildNumericCross(fieldA, fieldB, submissions)
      validCombo = true
    } else if (aNumber && bCategory) {
      data = buildNumericCross(fieldB, fieldA, submissions)
      validCombo = true
    }
  }

  return (
    <section style={{ marginTop: '2.5rem' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.6rem', fontWeight: 700 }}>
        Cross Analysis
      </h2>

      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
          <select value={fieldAId} onChange={(e) => setFieldAId(e.target.value)} style={{ padding: '0.5rem' }}>
            {eligible.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <span style={{ color: 'var(--color-muted)' }}>×</span>
          <select value={fieldBId} onChange={(e) => setFieldBId(e.target.value)} style={{ padding: '0.5rem' }}>
            {eligible.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>

          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            style={{ padding: '0.5rem', marginLeft: 'auto' }}
          >
            <option value="bar">Bar chart</option>
            <option value="pie">Pie chart</option>
          </select>
        </div>

        {!validCombo && (
          <p style={{ color: '#999' }}>Choose two different columns to compare (categorical or numeric fields).</p>
        )}

        {validCombo && data.length === 0 && (
          <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>
        )}

        {validCombo && data.length > 0 && (
          <>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.9rem' }}>
              {fieldA.label} × {fieldB.label}
            </div>
            {chartType === 'pie'
              ? <PieChart data={data} />
              : <HorizontalBarChart data={data} formatValue={(v) => `${v}%`} />
            }
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
              {data[0].label} leads at {data[0].count}% of the total.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

export default CrossAnalysis
