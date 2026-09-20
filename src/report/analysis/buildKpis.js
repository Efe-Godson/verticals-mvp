// Place at: src/report/analysis/buildKpis.js
// Builds the exact KPI list the main Report.jsx dashboard's KPIGrid shows -
// primary cards (Revenue/Orders/Average Order Value, when the form has a
// cart) plus every "More metrics" card - from nothing but { form,
// submissions, previousSubmissions, totalResponses }. Report.jsx calls this
// directly so the live dashboard and the Print/PDF builder
// (report/builder/print/) can never drift apart - same reasoning
// buildDashboardTiles.jsx's own header comment gives for chart tiles.
import { median, getEntryNoun, formatNaira } from '../helpers/analysisUtils'

export const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox', 'autocomplete']
export const NUMERIC_TYPES = ['number', 'rating', 'linearscale']
export const DEMOGRAPHIC_TYPES = ['email', 'phone']

// Aggregates the numbers a trend comparison needs from a set of submissions,
// shared between the current and previous period so the two are computed
// identically.
export function computeCartTotals(cartFields, submissions) {
  let totalRevenue = 0
  let totalOrders = 0
  let totalItems = 0
  const orderTotals = []

  cartFields.forEach(field => {
    submissions.forEach(s => {
      const v = s.data[field.id]
      if (v && v.items && v.items.length > 0) {
        const grandTotal = v.total + (v.deliveryFee || 0)
        totalRevenue += grandTotal
        totalOrders += 1
        orderTotals.push(grandTotal)
        totalItems += v.items.reduce((sum, item) => sum + item.quantity, 0)
      }
    })
  })

  return { totalRevenue, totalOrders, totalItems, orderTotals }
}

// Returns undefined (not shown) when there's no previous-period value to
// compare against, rather than a misleading 0% / flat trend.
export function computeTrend(current, previous) {
  if (previous === undefined || previous === null || previous === 0) return undefined
  const percent = Math.round(((current - previous) / previous) * 100)
  return { direction: current >= previous ? 'up' : 'down', percent }
}

function getCompletionRate(form, submissions) {
  const nonCartFields = form.fields.filter(f => f.type !== 'cart' && f.type !== 'section')
  if (nonCartFields.length === 0 || submissions.length === 0) return 0

  const rates = nonCartFields.map(f => {
    const answered = submissions.filter(s => {
      const v = s.data[f.id]
      if (f.type === 'multiplechoicegrid' || f.type === 'checkboxgrid') return v && typeof v === 'object' && Object.keys(v).length > 0
      if (f.type === 'checkbox') return Array.isArray(v) && v.length > 0
      return v !== undefined && v !== null && v.toString().trim() !== ''
    })
    return (answered.length / submissions.length) * 100
  })

  return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
}

// One decimal place with a K/M/B suffix above 10,000 (17299 -> "17.3K",
// 16782200 -> "16.8M") - below that a plain number is already short enough.
function abbreviateNumber(n) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e4) return `${sign}${(abs / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

// 'auto' abbreviates large values (see abbreviateNumber) so a stat tile
// never has to truncate its own value; 'full' spells out the exact number.
// Only currency/count metrics respond to this - percentages, ratios and
// text metrics (e.g. "1.5", "62%", "Friday") are already short and stay
// exactly as computed either way.
export function formatKpiValue(raw, kind, mode) {
  const n = Number(raw) || 0
  if (mode === 'full') return kind === 'currency' ? formatNaira(n) : n.toLocaleString()
  return kind === 'currency' ? `₦${abbreviateNumber(n)}` : abbreviateNumber(n)
}

// previousSubmissions/totalResponses are optional - callers with no
// "previous period" concept (the Print/PDF builder, which has no date-range
// comparison UI) can omit them; every trend just comes back undefined
// (see computeTrend) and totalResponses falls back to submissions.length.
export function buildKpis({ form, submissions, previousSubmissions = [], totalResponses }) {
  const responsesCount = totalResponses ?? submissions.length
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const numericFields = form.fields.filter(f => NUMERIC_TYPES.includes(f.type))
  const categoryFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))
  const demographicFields = form.fields.filter(f => DEMOGRAPHIC_TYPES.includes(f.type))
  const dateFields = form.fields.filter(f => f.type === 'date')
  const hasPreviousPeriod = previousSubmissions.length > 0
  const noun = getEntryNoun(form, cartFields.length > 0)

  const primaryKpis = []
  // Every other computed metric lives behind "More metrics" so the grid above
  // never gets crowded, add new KPI computations here as the report grows,
  // and they show up in the checklist automatically.
  const moreKpis = []

  // ---- Cart / revenue metrics ----
  const { totalRevenue, totalOrders, totalItems, orderTotals } = computeCartTotals(cartFields, submissions)
  const previousCart = hasPreviousPeriod ? computeCartTotals(cartFields, previousSubmissions) : null
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  if (cartFields.length > 0) {
    primaryKpis.push({
      label: 'Revenue', raw: totalRevenue, kind: 'currency',
      trend: computeTrend(totalRevenue, previousCart?.totalRevenue)
    })
    primaryKpis.push({
      label: 'Orders', raw: totalOrders, kind: 'count',
      trend: computeTrend(totalOrders, previousCart?.totalOrders)
    })
    primaryKpis.push({
      label: 'Average Order Value', raw: avgOrderValue, kind: 'currency',
      trend: computeTrend(avgOrderValue, previousCart?.totalOrders > 0 ? previousCart.totalRevenue / previousCart.totalOrders : undefined)
    })

    moreKpis.push({
      label: 'Median Order Value',
      raw: median(orderTotals), kind: 'currency'
    })
    moreKpis.push({
      label: 'Highest Order Value',
      raw: orderTotals.length > 0 ? Math.max(...orderTotals) : 0, kind: 'currency'
    })
    moreKpis.push({ label: 'Total Items Sold', raw: totalItems, kind: 'count' })
    moreKpis.push({
      label: 'Average Items per Order',
      value: totalOrders > 0 ? (totalItems / totalOrders).toFixed(1) : '0'
    })
  }

  moreKpis.push({
    label: `Total ${noun.plural}`, raw: responsesCount, kind: 'count',
    trend: computeTrend(responsesCount, hasPreviousPeriod ? previousSubmissions.length : undefined)
  })

  // ---- Completion & pacing ----
  const completionRate = getCompletionRate(form, submissions)
  if (completionRate > 0) {
    moreKpis.push({ label: 'Avg. Completion', value: `${completionRate}%` })
  }

  if (submissions.length > 1) {
    const timestamps = submissions.map(s => new Date(s.created_at).getTime()).filter(t => !isNaN(t))
    if (timestamps.length > 1) {
      const spanDays = Math.max(1, (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24))
      moreKpis.push({ label: `${noun.plural} per Day`, value: (responsesCount / spanDays).toFixed(1) })
    }
  }

  // ---- Numeric fields (one set of stats per field) ----
  numericFields.forEach(field => {
    const values = submissions.map(s => Number(s.data[field.id])).filter(v => !isNaN(v))
    if (values.length === 0) return
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    moreKpis.push({ label: `Average ${field.label}`, raw: Math.round(avg), kind: 'count' })
    moreKpis.push({ label: `Median ${field.label}`, raw: median(values), kind: 'count' })
    moreKpis.push({ label: `Highest ${field.label}`, raw: Math.max(...values), kind: 'count' })
    moreKpis.push({ label: `Lowest ${field.label}`, raw: Math.min(...values), kind: 'count' })
  })

  // ---- Category fields (top value + variety) ----
  categoryFields.forEach(field => {
    const answered = submissions.filter(s => {
      const v = s.data[field.id]
      return field.type === 'checkbox' ? Array.isArray(v) && v.length > 0 : v !== undefined && v !== null && v !== ''
    })
    if (answered.length === 0) return
    const countMap = {}
    answered.forEach(s => {
      const v = s.data[field.id]
      const vals = Array.isArray(v) ? v : [v]
      vals.forEach(val => { countMap[val] = (countMap[val] || 0) + 1 })
    })
    const entries = Object.entries(countMap)
    const top = entries.sort((a, b) => b[1] - a[1])[0]
    if (top) {
      const percent = Math.round((top[1] / answered.length) * 100)
      moreKpis.push({ label: `Top ${field.label}`, value: `${top[0]} (${percent}%)` })
    }
    moreKpis.push({ label: `Distinct ${field.label} values`, raw: entries.length, kind: 'count' })
  })

  // ---- Demographic coverage ----
  demographicFields.forEach(field => {
    const answered = submissions.filter(s => {
      const v = s.data[field.id]
      return v !== undefined && v !== null && v.toString().trim() !== ''
    })
    if (submissions.length === 0) return
    const percent = Math.round((answered.length / submissions.length) * 100)
    moreKpis.push({ label: `${field.label} Provided`, value: `${percent}%` })
  })

  // ---- Date fields ----
  dateFields.forEach(field => {
    const answered = submissions.filter(s => s.data[field.id])
    if (answered.length === 0) return
    const dayCounts = {}
    answered.forEach(s => {
      const d = new Date(s.data[field.id])
      if (isNaN(d)) return
      const dn = d.toLocaleDateString('en-GB', { weekday: 'long' })
      dayCounts[dn] = (dayCounts[dn] || 0) + 1
    })
    const top = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
    if (top) moreKpis.push({ label: `Busiest Day (${field.label})`, value: top[0] })
  })

  return { primaryKpis, moreKpis }
}
