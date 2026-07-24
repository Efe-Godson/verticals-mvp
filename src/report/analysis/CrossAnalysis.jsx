// Place at: src/report/analysis/CrossAnalysis.jsx
// Fully user-driven: nothing is pre-selected. Pick any two columns, pick a
// chart type, and (for two categorical columns) pick which segment to
// drill into.
import { useState } from 'react'
import HorizontalBarChart from '../components/HorizontalBarChart'
import PieChart from '../components/PieChart'
import { getFieldValues } from '../helpers/analysisUtils'

const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox']
const NUMERIC_TYPES = ['number', 'rating', 'linearscale']

// Distinct values of a categorical field, ordered by how often they occur —
// used both to build the "All values" combined view and to populate the
// segment picker.
function distinctValuesByFrequency(field, submissions) {
  const counts = {}
  submissions.forEach(sub => {
    getFieldValues(sub, field).forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([value]) => value)
}

// Every fieldA value's fieldB breakdown, so the UI can either show the
// combined ranking or drill into one segment without recomputing.
function buildCategoricalCross(fieldA, fieldB, submissions) {
  const bySegment = {} // fieldA value -> { fieldB value -> count }
  const combined = {} // "a × b" -> count
  let combinedTotal = 0

  submissions.forEach(sub => {
    const aVals = getFieldValues(sub, fieldA)
    const bVals = getFieldValues(sub, fieldB)
    aVals.forEach(a => {
      bVals.forEach(b => {
        bySegment[a] = bySegment[a] || {}
        bySegment[a][b] = (bySegment[a][b] || 0) + 1
        combined[`${a} × ${b}`] = (combined[`${a} × ${b}`] || 0) + 1
        combinedTotal += 1
      })
    })
  })

  return { bySegment, combined, combinedTotal }
}

function segmentToChartData(segmentCounts) {
  const total = Object.values(segmentCounts).reduce((a, b) => a + b, 0)
  return Object.entries(segmentCounts)
    .map(([label, count]) => ({ label, count: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
}

function combinedToChartData(combined, combinedTotal) {
  return Object.entries(combined)
    .map(([label, count]) => ({ label, count: combinedTotal > 0 ? Math.round((count / combinedTotal) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

// A cart field contributes two cross-analyzable measures — order revenue and
// item quantity — rather than the field itself, since a cart value isn't a
// single number. `getMeasureValue` reads whichever one a given pseudo-field
// represents.
function buildCartMeasureFields(cartFields) {
  const measures = []
  cartFields.forEach(cartField => {
    measures.push({
      id: `__cart_revenue__${cartField.id}`, label: `${cartField.label} Revenue`,
      type: 'cart_measure', cartFieldId: cartField.id, measure: 'revenue'
    })
    measures.push({
      id: `__cart_quantity__${cartField.id}`, label: `${cartField.label} Item Count`,
      type: 'cart_measure', cartFieldId: cartField.id, measure: 'quantity'
    })
  })
  return measures
}

function getMeasureValue(sub, field) {
  if (field.type === 'cart_measure') {
    const v = sub.data[field.cartFieldId]
    if (!v || !v.items || v.items.length === 0) return NaN
    return field.measure === 'revenue'
      ? v.total
      : v.items.reduce((sum, item) => sum + item.quantity, 0)
  }
  return Number(sub.data[field.id])
}

function buildNumericCross(categoryField, numberField, submissions) {
  const groups = {}
  let grandTotal = 0

  submissions.forEach(sub => {
    const num = getMeasureValue(sub, numberField)
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

function CrossAnalysis({ fields, cartFields = [], submissions }) {
  const eligible = [
    ...(fields || []).filter(f => CATEGORICAL_TYPES.includes(f.type) || NUMERIC_TYPES.includes(f.type)),
    ...buildCartMeasureFields(cartFields),
  ]

  // Nothing is pre-selected — the user builds the comparison themselves.
  const [fieldAId, setFieldAId] = useState('')
  const [fieldBId, setFieldBId] = useState('')
  const [chartType, setChartType] = useState('bar')
  const [segment, setSegment] = useState('__all__')

  if (eligible.length < 2) return null

  const fieldA = eligible.find(f => f.id === fieldAId)
  const fieldB = eligible.find(f => f.id === fieldBId)
  const sameField = fieldA && fieldB && fieldA.id === fieldB.id

  let data = []
  let validCombo = false
  let footnote = ''
  let segmentOptions = null

  if (fieldA && fieldB && !sameField) {
    const aCategory = CATEGORICAL_TYPES.includes(fieldA.type)
    const bCategory = CATEGORICAL_TYPES.includes(fieldB.type)
    const aNumber = NUMERIC_TYPES.includes(fieldA.type) || fieldA.type === 'cart_measure'
    const bNumber = NUMERIC_TYPES.includes(fieldB.type) || fieldB.type === 'cart_measure'

    if (aCategory && bCategory) {
      validCombo = true
      segmentOptions = distinctValuesByFrequency(fieldA, submissions)
      const { bySegment, combined, combinedTotal } = buildCategoricalCross(fieldA, fieldB, submissions)

      if (segment === '__all__' || !bySegment[segment]) {
        data = combinedToChartData(combined, combinedTotal)
        footnote = data.length > 0
          ? `${data[0].label} is the most common combination, at ${data[0].count}% of all responses.`
          : ''
      } else {
        data = segmentToChartData(bySegment[segment])
        footnote = data.length > 0
          ? `Among "${segment}", ${data[0].label} leads at ${data[0].count}% of ${fieldB.label.toLowerCase()}.`
          : ''
      }
    } else if (aCategory && bNumber) {
      data = buildNumericCross(fieldA, fieldB, submissions)
      validCombo = true
      footnote = data.length > 0 ? `${data[0].label} leads at ${data[0].count}% of the total.` : ''
    } else if (aNumber && bCategory) {
      data = buildNumericCross(fieldB, fieldA, submissions)
      validCombo = true
      footnote = data.length > 0 ? `${data[0].label} leads at ${data[0].count}% of the total.` : ''
    }
  }

  return (
    <div className="card" style={{ padding: '1.75rem' }}>
      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <select value={fieldAId} onChange={(e) => { setFieldAId(e.target.value); setSegment('__all__') }} style={{ padding: '0.5rem' }}>
          <option value="">Choose a column…</option>
          {eligible.map(f => (
            <option key={f.id} value={f.id} disabled={f.id === fieldBId}>{f.label}</option>
          ))}
        </select>
        <span style={{ color: 'var(--color-muted)' }}>×</span>
        <select value={fieldBId} onChange={(e) => { setFieldBId(e.target.value); setSegment('__all__') }} style={{ padding: '0.5rem' }}>
          <option value="">Choose a column…</option>
          {eligible.map(f => (
            <option key={f.id} value={f.id} disabled={f.id === fieldAId}>{f.label}</option>
          ))}
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

      {segmentOptions && (
        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginRight: '0.5rem' }}>
            Focus on
          </label>
          <select value={segment} onChange={(e) => setSegment(e.target.value)} style={{ padding: '0.4rem 0.5rem' }}>
            <option value="__all__">All values (top combinations)</option>
            {segmentOptions.map(v => (
              <option key={v} value={v}>{fieldA.label}: {v}</option>
            ))}
          </select>
        </div>
      )}

      {!fieldA || !fieldB ? (
        <p style={{ color: '#999' }}>Pick two columns above to compare them.</p>
      ) : sameField ? (
        <p style={{ color: '#999' }}>Choose two different columns to compare.</p>
      ) : !validCombo ? (
        <p style={{ color: '#999' }}>This combination isn't supported yet — try a categorical or numeric column instead.</p>
      ) : data.length === 0 ? (
        <p style={{ color: '#999' }}>Not enough data yet for this combination.</p>
      ) : (
        <>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.9rem' }}>
            {fieldA.label} × {fieldB.label}
          </div>
          {chartType === 'pie'
            ? <PieChart data={data} />
            : <HorizontalBarChart data={data} formatValue={(v) => `${v}%`} />
          }
          {footnote && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem' }}>
              {footnote}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default CrossAnalysis
