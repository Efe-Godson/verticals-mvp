// Place at: src/report/components/TrendLineChart.jsx
// Time-series area/line for the Reports page. Takes RAW dated points
// ([{ date, value }]) and buckets them itself, so the D/W/M/Q/Y granularity
// toggle can re-bucket live without the caller re-computing. Uses recharts
// (already a dep via the Report Builder).
import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts'
import { bucketDate } from '../engine/dateBuckets'
import useIsMobile from '../../hooks/useIsMobile'

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
}) {
  // On by default: a trend line with no visible values makes a visitor
  // hunt with their cursor to know what they're looking at - the toggle
  // still exists for anyone who wants the plain shape instead.
  const [showLabels, setShowLabels] = useState(true)
  const [gran, setGran] = useState(defaultGranularity)
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

  return (
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
}
