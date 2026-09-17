// Place at: src/report/analysis/components/WeekdayChart.jsx
// "Sales by Day of Week" / "Orders by Day of Week" - the weekday
// distribution that used to live only on Records.jsx's Daily Tally view,
// now proper Report.jsx tiles. Each gets its own Sum/Average/Count
// value-field picker, reusing report/engine/aggregate.js - the same
// reduction the Report Builder's own aggregation picker (ConfigPanel.jsx)
// uses, rather than a bespoke set of options here.
import { useMemo, useState } from 'react'
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { AGGREGATIONS, aggregateValues } from '../../engine/aggregate'
import { formatNaira } from '../../helpers/analysisUtils'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function bucketByWeekday(rows) {
  const buckets = Array.from({ length: 7 }, () => [])
  rows.forEach(({ date, value }) => {
    const idx = (date.getDay() + 6) % 7 // getDay(): 0=Sun..6=Sat -> 0=Mon..6=Sun
    buckets[idx].push(value)
  })
  return buckets
}

function toggleBtnStyle(active) {
  return {
    border: 'none', borderRadius: '5px', padding: '.2rem .55rem', fontSize: '.72rem',
    fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--color-surface)' : 'transparent',
    color: active ? 'var(--color-text)' : 'var(--color-muted)',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
  }
}

// `rows` is one { date, value } per record - `value` is whatever this chart
// aggregates (order revenue for the Sales tile, item quantity for the Orders
// tile). Bucketed into the 7 weekdays, then reduced with whichever
// aggregation the picker is set to.
function WeekdayAggregationChart({ title, rows, options, defaultAggregation, currency, description }) {
  const [aggregation, setAggregation] = useState(defaultAggregation)
  const aggOptions = AGGREGATIONS.filter(a => options.includes(a.value))

  const data = useMemo(() => {
    const buckets = bucketByWeekday(rows)
    return WEEKDAY_LABELS.map((label, i) => ({ label, count: aggregateValues(aggregation, buckets[i], buckets[i]) }))
  }, [rows, aggregation])

  const formatValue = currency && aggregation !== 'count' ? (v) => formatNaira(v) : (v) => v.toLocaleString()

  return (
    <div>
      {aggOptions.length > 1 && (
        <div data-html2canvas-ignore="true" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.5rem' }}>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--color-bg)', borderRadius: '6px', padding: '2px' }}>
            {aggOptions.map(a => (
              <button key={a.value} type="button" onClick={() => setAggregation(a.value)} style={toggleBtnStyle(aggregation === a.value)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <HorizontalBarChart data={data} formatValue={formatValue} bare maxBars={7} focusTitle={title} description={description} />
    </div>
  )
}

// Two tiles: revenue per weekday (Sum by default, switchable to Average
// order value or Count of orders) and orders per weekday (Count by default,
// switchable to Sum/Average of items per order). Both bucket by whichever
// date buildChartTiles resolved for each record (recordDate - honors
// settings.reportDateField, same as the trend tiles above them).
export function weekdayTiles({ cartFields, submissions, recordDate }) {
  if (cartFields.length === 0) return []

  const revenueRows = []
  const itemRows = []
  submissions.forEach(sub => {
    const date = recordDate(sub)
    let revenue = 0
    let items = 0
    let hasCart = false
    cartFields.forEach(cf => {
      const v = sub.data[cf.id]
      if (v && v.items && v.items.length > 0) {
        hasCart = true
        revenue += Number(v.total || 0) + Number(v.deliveryFee || 0)
        items += v.items.reduce((s, it) => s + Number(it.quantity || 0), 0)
      }
    })
    if (hasCart) {
      revenueRows.push({ date, value: revenue })
      itemRows.push({ date, value: items })
    }
  })

  if (revenueRows.length === 0) return []

  return [
    {
      id: 'weekday-sales',
      title: 'Sales by Day of Week',
      node: (
        <WeekdayAggregationChart
          title="Sales by Day of Week"
          rows={revenueRows}
          options={['sum', 'avg', 'count']}
          defaultAggregation="sum"
          currency
          description="Sales by Day of Week groups each order's revenue by the weekday it fell on, summed by default - switch to Average for the typical order value on that day, or Count for how many orders it had."
        />
      ),
    },
    {
      id: 'weekday-orders',
      title: 'Orders by Day of Week',
      node: (
        <WeekdayAggregationChart
          title="Orders by Day of Week"
          rows={itemRows}
          options={['count', 'sum', 'avg']}
          defaultAggregation="count"
          description="Orders by Day of Week counts orders per weekday by default - switch to Sum for total items sold that weekday, or Average for items per order."
        />
      ),
    },
  ]
}
