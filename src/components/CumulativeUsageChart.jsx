// Place at: src/components/CumulativeUsageChart.jsx
// Running-total entries across the current usage period, with the plan's
// entry_limit as a horizontal reference line - makes it visually obvious
// how close the account is to its cap before it actually hits it. Separate
// from report/components/TrendLineChart.jsx (which buckets raw points by a
// granularity toggle) since this needs a running-sum transform and a
// ReferenceLine, neither of which that shared component does.
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import useIsMobile from '../hooks/useIsMobile'

// Short axis ticks so a wide number doesn't get clipped.
function compact(n) {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${+(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${+(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`
  return `${abs}`
}

export default function CumulativeUsageChart({ dailyCounts, entryLimit }) {
  const isMobile = useIsMobile()
  if (!dailyCounts || dailyCounts.length === 0) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>No entries recorded yet this period.</p>
  }

  let running = 0
  const data = dailyCounts.map(d => {
    running += d.entries
    return { label: d.label, cumulative: running }
  })

  return (
    <div style={{ width: '100%', height: isMobile ? 210 : 260 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="cumulative-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--color-muted)' }} interval="preserveStartEnd" minTickGap={isMobile ? 40 : 28} />
          <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--color-muted)' }} tickFormatter={compact} width={isMobile ? 40 : 50} />
          <Tooltip
            formatter={(v) => v.toLocaleString()}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
            labelStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
          />
          {entryLimit != null && (
            <ReferenceLine
              y={entryLimit} stroke="var(--status-warning)" strokeDasharray="4 4"
              label={{ value: `Plan limit: ${entryLimit.toLocaleString()}`, position: 'insideTopRight', fill: 'var(--status-warning)', fontSize: 11 }}
            />
          )}
          <Area type="monotone" dataKey="cumulative" stroke="var(--color-primary)" strokeWidth={2} fill="url(#cumulative-fill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
