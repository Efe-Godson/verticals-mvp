// Place at: src/report/analysis/buildDashboardTiles.js
// Builds the exact chart-tile list the main Report.jsx dashboard shows -
// trend, cart/product, category, location and legacy-widget tiles - from
// nothing but { form, submissions }. Report.jsx calls this directly so the
// live dashboard and the Print/PDF builder (report/builder/print/) can never
// drift apart: both render the same tiles because both call the same
// function, rather than each re-implementing the same assembly logic.
import TrendLineChart from '../components/TrendLineChart'
import { cartReportTiles } from './Cartreport'
import { cartCategoryTiles } from './components/CartCategoryChart'
import { categoryCountTiles } from './components/CategoryCountChart'
import { locationCartTiles, locationCountTile } from './components/LocationChart'
import CustomReportWidget from '../CustomReportWidget'
import { getEntryNoun, formatNaira } from '../helpers/analysisUtils'

const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox', 'autocomplete']

// Fields whose values are worth breaking cart revenue down by first,
// e.g. "Sales Rep", "Salesperson", or a "Name" field, before the rest.
function isPriorityCategoryField(field) {
  const label = (field.label || '').toLowerCase()
  return /\bname\b/.test(label) ||
    /sales\s*-?\s*rep/.test(label) ||
    /sales\s*-?\s*person/.test(label) ||
    /salesperson/.test(label) ||
    /\bemployee\b/.test(label) ||
    /\bstaff\b/.test(label)
}

// Fields that represent how a sale reached the customer, surfaced in their
// own "Sales Channel" section rather than lumped in with generic breakdowns.
function isChannelField(field) {
  const label = (field.label || '').toLowerCase()
  return /channel/.test(label) || /\bplatform\b/.test(label) || /\bsource\b/.test(label)
}

// submissions should already be whatever the caller wants scoped to (a live
// date-range filter on the dashboard, or the Report Builder's own scoped
// submissions in Print View) - this function itself applies no date logic
// beyond deriving the record date for the trend tiles' x-axis.
export function buildChartTiles(form, submissions) {
  const reportDateField = form.fields.find(f => f.id === form.settings?.reportDateField && f.type === 'date')
  const reportAmountField = form.fields.find(f => f.id === form.settings?.reportAmountField && f.type === 'number')

  function recordDate(sub) {
    if (reportDateField) {
      const raw = sub.data[reportDateField.id]
      if (raw) {
        const d = new Date(raw)
        if (!isNaN(d.getTime())) return d
      }
    }
    return new Date(sub.created_at)
  }

  const cartFields = form.fields.filter(f => f.type === 'cart')
  const categoryFields = form.fields.filter(f => CATEGORICAL_TYPES.includes(f.type))
  const locationFields = form.fields.filter(f => f.type === 'location')
  const entryNoun = getEntryNoun(form, cartFields.length > 0)

  const salesByCategoryPairs = []
  cartFields.forEach(cartField => {
    categoryFields.forEach(catField => {
      salesByCategoryPairs.push({ cartField, catField, priority: isPriorityCategoryField(catField) })
    })
  })
  // "Operations" pairs (sales rep / staff / name) surface separately from
  // "Products" pairs (channel, other category breakdowns); see isPriorityCategoryField.
  const nonOperationsPairs = salesByCategoryPairs.filter(p => !p.priority)
  const channelCategoryPairs = nonOperationsPairs.filter(p => isChannelField(p.catField))
  const otherCategoryPairs = nonOperationsPairs.filter(p => !isChannelField(p.catField))
  const operationsCategoryPairs = salesByCategoryPairs.filter(p => p.priority)

  // Time series over the record date. Raw dated points are handed to
  // TrendLineChart, which buckets them by the granularity the D/W/M/Q/Y
  // toggle is set to. The default just picks something sensible for the span.
  const trendTiles = (() => {
    if (submissions.length < 2) return []
    const times = submissions.map(s => recordDate(s).getTime()).filter(t => !isNaN(t))
    if (times.length < 2) return []
    const spanDays = (Math.max(...times) - Math.min(...times)) / 86400000
    const defaultGran = spanDays <= 45 ? 'day' : spanDays <= 120 ? 'week' : spanDays <= 900 ? 'month' : 'quarter'

    const orderPoints = []
    const revenuePoints = []
    const amountPoints = []
    submissions.forEach(s => {
      const d = recordDate(s)
      orderPoints.push({ date: d, value: 1 })
      let rev = 0
      cartFields.forEach(cf => {
        const v = s.data[cf.id]
        if (v && v.items && v.items.length > 0) rev += v.total + (v.deliveryFee || 0)
      })
      if (rev > 0) revenuePoints.push({ date: d, value: rev })
      if (reportAmountField) {
        const amt = Number(s.data[reportAmountField.id])
        if (!isNaN(amt) && amt !== 0) amountPoints.push({ date: d, value: amt })
      }
    })

    const byLabel = reportDateField ? ` (by ${reportDateField.label})` : ''
    const orderTitle = `${entryNoun.plural} over time${byLabel}`
    const countTile = {
      id: 'trend-orders',
      title: orderTitle,
      node: <TrendLineChart points={orderPoints} defaultGranularity={defaultGran} focusTitle={orderTitle} sourceLabel={entryNoun.plural} />,
    }
    const tiles = []
    // Lead with a money/amount trend where one exists - a plain count of
    // records is the least interesting way to open a report when there's an
    // actual result (revenue, or an Expenses book's own amount field) to
    // show instead. Same ordering KPIGrid already gives Revenue over Orders.
    if (revenuePoints.length > 0) {
      const revenueTitle = `Revenue over time${byLabel}`
      tiles.push({
        id: 'trend-revenue',
        title: revenueTitle,
        node: <TrendLineChart points={revenuePoints} defaultGranularity={defaultGran} formatValue={formatNaira} currency focusTitle={revenueTitle} sourceLabel={entryNoun.plural} />,
      })
    } else if (amountPoints.length > 0) {
      const amountTitle = `${reportAmountField.label} over time${byLabel}`
      tiles.push({
        id: 'trend-amount',
        title: amountTitle,
        node: <TrendLineChart points={amountPoints} defaultGranularity={defaultGran} formatValue={formatNaira} currency focusTitle={amountTitle} sourceLabel={entryNoun.plural} />,
      })
    }
    tiles.push(countTile)
    return tiles
  })()

  // One flat, ordered list of chart tiles - the unit the owner can pair up
  // (see toggleChartPair / ChartTileGrid in Report.jsx). Each needs a stable id.
  const chartTiles = [
    ...trendTiles,
    ...cartFields.flatMap(field => {
      const answered = submissions.filter(s => {
        const v = s.data[field.id]
        return v && v.items && v.items.length > 0
      })
      return cartReportTiles({ field, answered })
    }),
    ...[...channelCategoryPairs, ...operationsCategoryPairs, ...otherCategoryPairs].flatMap(({ cartField, catField }) =>
      cartCategoryTiles({ categoryField: catField, cartField, submissions }),
    ),
    // No cart field means salesByCategoryPairs above is empty (it's built
    // as a cart x category cartesian product) - without this, a non-cart
    // form never got a single category breakdown chart no matter how much
    // data it had. Counts responses per value, or sums reportAmountField
    // per value when the form has one (e.g. Expenses' own "amount").
    ...(cartFields.length === 0
      ? categoryFields.flatMap(catField =>
          categoryCountTiles({ categoryField: catField, submissions, amountField: reportAmountField, noun: entryNoun }),
        )
      : []),
    ...locationFields.flatMap(lf =>
      cartFields.length > 0
        ? cartFields.flatMap(cf => locationCartTiles({ locationField: lf, cartField: cf, submissions }))
        : locationCountTile({ locationField: lf, submissions, noun: entryNoun }),
    ),
    ...(form.settings?.reportWidgets || []).map(widget => ({
      id: `widget-${widget.id}`,
      title: widget.title,
      node: <CustomReportWidget form={form} widget={widget} submissions={submissions} />,
    })),
  ]

  // Apply the owner's saved tile order (reportChartOrder is a list of ids);
  // any tile not in the list keeps its natural position after the ranked ones.
  const orderRank = new Map((form?.settings?.reportChartOrder || []).map((tid, i) => [tid, i]))
  const orderedChartTiles = [...chartTiles].sort(
    (a, b) => (orderRank.has(a.id) ? orderRank.get(a.id) : 1e9) - (orderRank.has(b.id) ? orderRank.get(b.id) : 1e9),
  )

  return { tiles: orderedChartTiles, entryNoun }
}
