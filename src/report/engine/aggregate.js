// Place at: src/report/engine/aggregate.js
// Reduces a bucket of raw per-record numbers down to the one value a
// bar/cell/point shows. Generalises pivotEngine.js's private aggregate()
// (which only did count/sum/avg) with distinct/min/max/median. Always
// re-derived from raw values, never from already-aggregated numbers.
import { median } from '../helpers/analysisUtils'

export const AGGREGATIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'distinct', label: 'Distinct count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'median', label: 'Median' },
]

// values: array of numbers for sum/avg/min/max/median; for 'count' the length
// is used; for 'distinct' pass the raw (pre-numeric) values array via
// `rawValues`.
export function aggregateValues(kind, values, rawValues) {
  if (kind === 'count') return values.length
  if (kind === 'distinct') {
    const src = rawValues || values
    return new Set(src.map(v => (v && typeof v === 'object' ? JSON.stringify(v) : v))).size
  }
  if (values.length === 0) return 0
  const nums = values.map(Number).filter(n => !isNaN(n))
  if (nums.length === 0) return 0
  if (kind === 'min') return Math.min(...nums)
  if (kind === 'max') return Math.max(...nums)
  if (kind === 'median') return median(nums)
  const sum = nums.reduce((a, b) => a + b, 0)
  if (kind === 'avg') return sum / nums.length
  return sum // 'sum' (default)
}

// Whether an aggregation produces a currency figure given the metric field.
// Used by renderers to pick formatNaira vs plain number formatting.
export function isCurrencyResult(aggregation, metricRole) {
  if (metricRole === 'cartRevenue') return true
  return false
}
