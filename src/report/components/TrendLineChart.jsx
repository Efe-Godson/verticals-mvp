// Place at: src/report/components/TrendLineChart.jsx
// Time-series area/line for the Reports page. Takes RAW dated points
// ([{ date, value }]) and buckets them itself, so the D/W/M/Q/Y granularity
// toggle can re-bucket live without the caller re-computing. Uses recharts
// (already a dep via the Report Builder).
import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts'
import { bucketDate } from '../engine/dateBuckets'
import useIsMobile from '../../hooks/useIsMobile'
import FocusModeModal from '../focus/FocusModeModal'
import FocusResultsTable from '../focus/FocusResultsTable'
import AboutThisVisual from '../focus/AboutThisVisual'

const GRANULARITIES = [
  ['day', 'D'],
  ['week', 'W'],
  ['month', 'M'],
  ['quarter', 'Q'],
  ['year', 'Y'],
]

// Short axis ticks so a wide ₦ value doesn't get clipped: 4,163,000 -> 4.2M.
function compact(n) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${+(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${+(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${+(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`
  return `${sign}${abs}`
}

function toggleBtnStyle(active) {
  return {
    border: 'none', borderRadius: '5px', padding: '.2rem .55rem', fontSize: '.72rem',
    fontWeight: 600, cursor: 'pointer', minWidth: '1.7rem',
    background: active ? 'var(--color-surface)' : 'transparent',
    color: active ? 'var(--color-text)' : 'var(--color-muted)',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
  }
}

const groupStyle = { display: 'flex', gap: '2px', background: 'var(--color-bg)', borderRadius: '6px', padding: '2px' }

export default function TrendLineChart({
  points,
  defaultGranularity = 'day',
  formatValue = (v) => v.toLocaleString(),
  currency = false,
  height,
  focusTitle,
  sourceLabel,
  getRecords,
  recordColumns,
  description,
  embedded = false,
}) {
  // Off by default: labels on every point crowd a chart with more than a
  // few - the toggle still exists for anyone who wants them.
  const [showLabels, setShowLabels] = useState(false)
  const [gran, setGran] = useState(defaultGranularity)
  const [focusOpen, setFocusOpen] = useState(false)
  const [drillBucket, setDrillBucket] = useState(null)
  const isMobile = useIsMobile()
  const chartHeight = height ?? (isMobile ? 210 : 260)

  const data = useMemo(() => {
    const buckets = {}
    ;(points || []).forEach(p => {
      const b = bucketDate(p.date, gran)
      if (!b) return
      const row = buckets[b.key] || (buckets[b.key] = { key: b.key, label: b.label, value: 0 })
      row.value += p.value || 0
    })
    return Object.values(buckets).sort((a, b) => (a.key < b.key ? -1 : 1))
  }, [points, gran])

  if (!points || points.length === 0) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>No dated records in this range yet.</p>
  }

  const axisFmt = (v) => (currency ? `₦${compact(v)}` : compact(v))

  const chartBody = (
    <div>
      <div
        data-html2canvas-ignore="true"
        className="report-tile-control"
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '.4rem', marginBottom: '.4rem',
        }}
      >
        {/* On a phone the two segmented groups can't sit side by side without
            the second one spilling off the card - each takes a full row and
            its buttons split the width evenly. */}
        <div style={{ ...groupStyle, ...(isMobile ? { width: '100%' } : null) }}>
          {GRANULARITIES.map(([value, short]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGran(value)}
              title={value[0].toUpperCase() + value.slice(1)}
              style={{ ...toggleBtnStyle(gran === value), ...(isMobile ? { flex: 1 } : null) }}
            >
              {short}
            </button>
          ))}
        </div>
        <div style={{ ...groupStyle, ...(isMobile ? { width: '100%' } : null) }}>
          <button type="button" onClick={() => setShowLabels(false)} style={{ ...toggleBtnStyle(!showLabels), ...(isMobile ? { flex: 1 } : null) }}>Hide labels</button>
          <button type="button" onClick={() => setShowLabels(true)} style={{ ...toggleBtnStyle(showLabels), ...(isMobile ? { flex: 1 } : null) }}>Show labels</button>
        </div>
        {!embedded && (
          <button
            type="button"
            data-html2canvas-ignore="true"
            onClick={() => setFocusOpen(true)}
            title="Focus mode - explore the complete result"
            style={{
              border: '1px solid var(--color-border)', borderRadius: '6px',
              padding: '.2rem .5rem', fontSize: '.78rem', lineHeight: 1,
              background: 'var(--color-surface)', color: 'var(--color-muted)', cursor: 'pointer',
            }}
          >
            ⤢
          </button>
        )}
      </div>

      <div style={{ width: '100%', height: chartHeight }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: showLabels ? 18 : 8, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            {/* padding insets the first/last points from the plot edges so
                their value labels + end ticks aren't clipped. */}
            <XAxis
              dataKey="label"
              tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--color-muted)' }}
              interval="preserveStartEnd"
              minTickGap={isMobile ? 40 : 28}
              padding={{ left: isMobile ? 14 : 20, right: isMobile ? 16 : 22 }}
            />
            <YAxis
              tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--color-muted)' }}
              tickFormatter={axisFmt}
              width={isMobile ? 42 : 54}
            />
            <Tooltip
              formatter={(v) => formatValue(v)}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
              labelStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#trend-fill)"
              dot={data.length <= 24}
            >
              {showLabels && (
                <LabelList
                  dataKey="value"
                  position="top"
                  offset={8}
                  formatter={(v) => (currency ? `₦${compact(v)}` : v.toLocaleString())}
                  style={{ fontSize: 10, fill: 'var(--color-text)', fontWeight: 600 }}
                />
              )}
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <>
      {chartBody}
      {focusOpen && (
        <TrendFocusModal
          title={focusTitle || 'Trend'}
          sourceLabel={sourceLabel}
          data={data}
          gran={gran}
          formatValue={formatValue}
          currency={currency}
          points={points}
          getRecords={getRecords}
          recordColumns={recordColumns}
          drillBucket={drillBucket}
          onDrill={setDrillBucket}
          description={description}
          onClose={() => { setFocusOpen(false); setDrillBucket(null) }}
        />
      )}
    </>
  )
}

// Focus Mode for a time series (brief §18): every bucket already renders on
// the chart above (there's no "top N" to hide here) - the value-add is a
// precise, searchable table of the same buckets, plus drilling into the
// records behind any one of them.
function TrendFocusModal({
  title, sourceLabel, data, gran, formatValue, currency, points,
  getRecords, recordColumns, drillBucket, onDrill, description, onClose,
}) {
  const columns = [
    { key: 'label', label: 'Date', align: 'left', sortable: true, defaultDir: 'asc' },
    { key: 'value', label: 'Value', align: 'right', sortable: true, defaultDir: 'desc', format: r => formatValue(r.value) },
  ]

  const records = drillBucket && getRecords ? getRecords(drillBucket) || [] : null
  const derivedRecordColumns = records && records.length > 0
    ? (recordColumns || Object.keys(records[0]).map(k => ({
        key: k,
        label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
        align: typeof records[0][k] === 'number' ? 'right' : 'left',
        sortable: true,
      })))
    : []

  return (
    <FocusModeModal
      onClose={onClose}
      title={title}
      subtitle={sourceLabel ? `${sourceLabel} • ${data.length} ${gran} periods` : `${data.length} ${gran} periods`}
      breadcrumbLabel={drillBucket ? drillBucket.label : null}
      onBreadcrumbBack={() => onDrill(null)}
      chart={!drillBucket && (
        <TrendLineChart points={points} defaultGranularity={gran} formatValue={formatValue} currency={currency} embedded />
      )}
      table={drillBucket ? (
        records && records.length > 0 ? (
          <FocusResultsTable
            columns={derivedRecordColumns}
            rows={records}
            rowKey={(r, i) => r.id || i}
            countLabel={`${records.length} record${records.length === 1 ? '' : 's'}`}
            searchPlaceholder="Search records..."
          />
        ) : (
          <div style={{ padding: '1.5rem 0', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
            No underlying records found for this period.
          </div>
        )
      ) : (
        <FocusResultsTable
          columns={columns}
          rows={data}
          countLabel={`All periods · ${data.length}`}
          searchPlaceholder="Search dates..."
          defaultSort={{ key: 'label', dir: 'asc' }}
          onRowClick={getRecords ? (row) => onDrill(row) : undefined}
        />
      )}
      footer={
        <AboutThisVisual
          description={description || `${title} sums each record's value into ${gran} buckets.`}
          meta={[{ label: 'Granularity', value: gran }]}
        />
      }
    />
  )
}
