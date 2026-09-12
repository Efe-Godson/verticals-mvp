// Place at: src/report/analysis/components/LocationChart.jsx
// "Sales/Orders by <location>" (cart forms) and plain response-count-by-
// location (non-cart forms) tiles. Moved out of Report.jsx so the dashboard
// (Report.jsx) and the Print/PDF builder (report/builder/print/) can both
// build the exact same tile list from the exact same code - see
// ../buildDashboardTiles.js, the shared assembly both call into.
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { formatNaira } from '../../helpers/analysisUtils'

// A 'location' field stores { country, state, city } - collapse it to one
// readable grouping key (city + state, else state/country).
export function locationLabel(v) {
  if (v && typeof v === 'object') {
    const parts = [v.city, v.state].filter(Boolean)
    return parts.join(', ') || v.country || ''
  }
  return typeof v === 'string' ? v.trim() : ''
}

// "Sales by <location>" + "Orders by <location>" tiles for a location field
// crossed with a cart field. Mirrors cartCategoryTiles but resolves the
// location object first.
export function locationCartTiles({ locationField, cartField, submissions }) {
  const revenue = {}
  const orders = {}
  let totalRevenue = 0
  let totalOrders = 0
  submissions.forEach(s => {
    const cart = s.data[cartField.id]
    if (!cart || !cart.items || cart.items.length === 0) return
    const label = locationLabel(s.data[locationField.id])
    if (!label) return
    const grand = cart.total + (cart.deliveryFee || 0)
    totalRevenue += grand
    totalOrders += 1
    revenue[label] = (revenue[label] || 0) + grand
    orders[label] = (orders[label] || 0) + 1
  })
  const toRows = (obj, total) => Object.entries(obj)
    .map(([label, count]) => ({ label, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
  const rev = toRows(revenue, totalRevenue)
  if (rev.length === 0) return []
  const ord = toRows(orders, totalOrders)
  const base = `loc-${locationField.id}-${cartField.id}`
  return [
    { id: `${base}-rev`, title: `Sales by ${locationField.label}`, node: <HorizontalBarChart data={rev} formatValue={(v) => formatNaira(v)} bare /> },
    { id: `${base}-ord`, title: `Orders by ${locationField.label}`, node: <HorizontalBarChart data={ord} bare /> },
  ]
}

// Plain response-count breakdown by location, for forms with no cart field.
export function locationCountTile({ locationField, submissions, noun }) {
  const counts = {}
  let total = 0
  submissions.forEach(s => {
    const label = locationLabel(s.data[locationField.id])
    if (!label) return
    counts[label] = (counts[label] || 0) + 1
    total += 1
  })
  const rows = Object.entries(counts)
    .map(([label, count]) => ({ label, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
  if (rows.length === 0) return []
  return [{ id: `loc-${locationField.id}-count`, title: `${noun.plural} by ${locationField.label}`, node: <HorizontalBarChart data={rows} bare /> }]
}
