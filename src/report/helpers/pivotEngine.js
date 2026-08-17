// Place at: src/report/helpers/pivotEngine.js
// Shared aggregation engine for ReportBuilder.jsx and the "Custom Reports"
// section it feeds on Report.jsx - one grouping (rows, optional columns) x
// one measure, same mental model as CrossAnalysis.jsx's two-field cross-tab
// but generalized with real aggregation (count/sum/avg, not just counts)
// and a proper rows x columns grid instead of a single-series breakdown.
import { getFieldValues, CATEGORICAL_TYPES } from './analysisUtils'

const NUMERIC_TYPES = ['number', 'rating', 'linearscale']

// Rows/Columns candidates: categorical fields as-is, plus date fields
// grouped by weekday - same grouping Report.jsx's computeInsights already
// uses for "busiest day", not the literal calendar date (a report spanning
// months would otherwise get one bucket per individual day).
export function getGroupableFields(form) {
  return form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type) || f.type === 'date')
}

function groupValues(sub, field) {
  if (field.type === 'date') {
    const v = sub.data[field.id]
    if (!v) return []
    const d = new Date(v)
    if (isNaN(d)) return []
    return [d.toLocaleDateString('en-GB', { weekday: 'long' })]
  }
  return getFieldValues(sub, field)
}

// Measures: count of responses, sum/average of a numeric field, or a cart
// field's revenue/items-sold. Revenue always uses the grand total (order
// total + delivery fee) - the same fix already applied to
// CartCategoryChart/CrossAnalysis, since a cart value's own `.total` never
// includes delivery on its own.
export function getMeasureOptions(form) {
  const options = [{ id: '__count__', label: 'Number of Responses', kind: 'count' }]

  form.fields.filter(f => NUMERIC_TYPES.includes(f.type)).forEach(f => {
    options.push({ id: `__sum__${f.id}`, label: `Sum of ${f.label}`, kind: 'sum', fieldId: f.id })
    options.push({ id: `__avg__${f.id}`, label: `Average of ${f.label}`, kind: 'avg', fieldId: f.id })
  })

  form.fields.filter(f => f.type === 'cart').forEach(f => {
    options.push({ id: `__cartRevenue__${f.id}`, label: `${f.label} Revenue`, kind: 'cartRevenue', cartFieldId: f.id })
    options.push({ id: `__cartQty__${f.id}`, label: `${f.label} Items Sold`, kind: 'cartQty', cartFieldId: f.id })
  })

  return options
}

// Value a single submission contributes toward a measure, or null if it
// doesn't have one (an unanswered number field, a cart field with no items
// on this submission) - null entries are dropped, not treated as 0, so an
// average isn't dragged down by responses that never touched that field.
function getMeasureValue(sub, measure) {
  if (measure.kind === 'sum' || measure.kind === 'avg') {
    const n = Number(sub.data[measure.fieldId])
    return isNaN(n) ? null : n
  }
  if (measure.kind === 'cartRevenue' || measure.kind === 'cartQty') {
    const v = sub.data[measure.cartFieldId]
    if (!v || !v.items || v.items.length === 0) return null
    return measure.kind === 'cartRevenue'
      ? v.total + (v.deliveryFee || 0)
      : v.items.reduce((sum, item) => sum + item.quantity, 0)
  }
  return null
}

// Reduces a bucket of raw per-submission measure values down to the one
// number a bar/cell shows. Always re-derived from the raw values, never
// from already-aggregated numbers - summing per-cell averages to get a row
// total would be a different (wrong) number than the row's actual average.
function aggregate(kind, values) {
  if (kind === 'count') return values.length
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  return kind === 'avg' ? sum / values.length : sum
}

// rowField/colField: field objects from getGroupableFields (colField may be
// null for a single-dimension breakdown). measure: one entry from
// getMeasureOptions. Returns { data, total } for the single-dimension case
// (feeds HorizontalBarChart/PieChart directly), or a full rows x columns
// grid for the 2D case (feeds PivotTable.jsx).
export function computePivot({ rowField, colField, measure, submissions }) {
  // row label -> column label (or null when colField is unset) -> raw values
  const buckets = {}

  submissions.forEach(sub => {
    const rowVals = groupValues(sub, rowField)
    if (rowVals.length === 0) return
    const measureVal = measure.kind === 'count' ? 1 : getMeasureValue(sub, measure)
    if (measureVal === null) return

    const colVals = colField ? groupValues(sub, colField) : [null]
    if (colVals.length === 0) return

    rowVals.forEach(row => {
      colVals.forEach(col => {
        buckets[row] = buckets[row] || {}
        buckets[row][col] = buckets[row][col] || []
        buckets[row][col].push(measureVal)
      })
    })
  })

  if (!colField) {
    const data = Object.entries(buckets)
      .map(([label, byCol]) => ({ label, value: aggregate(measure.kind, byCol[null] || []) }))
      .sort((a, b) => b.value - a.value)
    const total = aggregate(measure.kind, Object.values(buckets).flatMap(byCol => byCol[null] || []))
    return { data, total }
  }

  const rowKeys = Object.keys(buckets)
  const colKeys = [...new Set(rowKeys.flatMap(r => Object.keys(buckets[r])))]

  const cells = {}
  const rowTotals = {}
  const colValues = {} // col -> flattened raw values, for colTotals below

  rowKeys.forEach(row => {
    cells[row] = {}
    const rowValues = []
    colKeys.forEach(col => {
      const vals = buckets[row][col] || []
      cells[row][col] = aggregate(measure.kind, vals)
      rowValues.push(...vals)
      colValues[col] = (colValues[col] || []).concat(vals)
    })
    rowTotals[row] = aggregate(measure.kind, rowValues)
  })

  const colTotals = {}
  colKeys.forEach(col => { colTotals[col] = aggregate(measure.kind, colValues[col] || []) })

  const grandTotal = aggregate(measure.kind, rowKeys.flatMap(row => colKeys.flatMap(col => buckets[row][col] || [])))

  const rowLabels = [...rowKeys].sort((a, b) => rowTotals[b] - rowTotals[a])
  const colLabels = [...colKeys].sort((a, b) => colTotals[b] - colTotals[a])

  return { rowLabels, colLabels, cells, rowTotals, colTotals, grandTotal }
}

// Adapts a single-dimension computePivot() result ({ data: [{label,value}],
// total }) to the {label, count, percent} shape HorizontalBarChart/PieChart
// expect - kept separate from computePivot itself since the 2D grid result
// has no equivalent single-series shape to convert.
export function toChartData({ data, total }) {
  return data.map(d => ({ label: d.label, count: d.value, percent: total > 0 ? Math.round((d.value / total) * 100) : 0 }))
}
