// Place at: src/report/engine/dateBuckets.js
// Groups a date value into a sortable bucket at a chosen granularity. The
// rest of the app only ever bucketed dates by weekday name (pivotEngine,
// Report.jsx computeInsights, Datereport) - the Builder needs real
// day/week/month/quarter/year time series, so this is new.

// Monday-based, matching src/report/helpers/dateRange.js's startOfWeek.
function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1) - day)
  return d
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const DATE_GRANULARITIES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

// Returns { key, label } - key is an ISO-ish string that sorts
// lexicographically in chronological order; label is what the axis shows.
// Returns null for an unparseable / empty value (caller drops it).
export function bucketDate(value, granularity = 'day') {
  if (value === undefined || value === null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return null

  const y = d.getFullYear()
  const m = d.getMonth() // 0-11

  if (granularity === 'year') {
    return { key: String(y), label: String(y) }
  }
  if (granularity === 'quarter') {
    const q = Math.floor(m / 3) + 1
    return { key: `${y}-Q${q}`, label: `Q${q} ${y}` }
  }
  if (granularity === 'month') {
    return { key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTHS[m]} ${y}` }
  }
  if (granularity === 'week') {
    const ws = startOfWeek(d)
    const key = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`
    return { key, label: `Wk of ${ws.getDate()} ${MONTHS[ws.getMonth()]}` }
  }
  // day
  const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { key, label: `${d.getDate()} ${MONTHS[m]}` }
}
