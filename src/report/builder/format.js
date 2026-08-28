// Place at: src/report/builder/format.js
// Value formatting for the Builder. Money -> formatNaira (the src/report
// standard); everything else -> grouped number with sensible precision.
import { formatNaira } from '../helpers/analysisUtils'

export function formatNumber(v, decimals) {
  const n = Number(v) || 0
  if (decimals === undefined) {
    decimals = Number.isInteger(n) ? 0 : 2
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatPercent(v, decimals = 1) {
  return `${(Number(v) || 0).toFixed(decimals)}%`
}

// A formatter bound to a result: currency when the metric is cart revenue,
// percent when a matrix percentMode is active, plain number otherwise.
export function valueFormatter(result) {
  if (result?.matrix?.percentMode) return (v) => formatPercent(v)
  if (result?.metricRole === 'cartRevenue') return (v) => formatNaira(v)
  const agg = result?.aggregation
  if (agg === 'avg' || agg === 'median') return (v) => formatNumber(v, 2)
  return (v) => formatNumber(v)
}
