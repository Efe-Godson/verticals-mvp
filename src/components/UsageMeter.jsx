// Place at: src/components/UsageMeter.jsx
// No progress-bar/gauge component existed anywhere in this codebase before
// (src/components/ProgressState.jsx is a step checklist, not a percent
// meter) - built fresh here for the Pricing & Usage page's KPI section.
// Severity color follows the same thresholds the page gates behavior on
// (70%/90%/100%), so the visual and the copy next to it never disagree.

function severityColor(percentage) {
  if (percentage >= 90) return '#c0392b'
  if (percentage >= 70) return 'var(--status-warning)'
  return 'var(--color-primary)'
}

// Circular gauge - quick-recognition "how full am I" at a glance.
export function UsageGauge({ percentage, size = 140, strokeWidth = 12 }) {
  const clamped = Math.max(0, Math.min(100, percentage))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  const color = severityColor(clamped)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% of monthly entries used`}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22} fontWeight="700" fill="var(--color-text)">
        {Math.round(clamped)}%
      </text>
    </svg>
  )
}

// Horizontal meter - precise "how close am I" comparison, paired with the
// gauge rather than replacing it (spec: "use the gauge for quick
// recognition and the meter for precise comparison").
export function UsageBar({ used, limit, percentage, height = 10 }) {
  const clamped = Math.max(0, Math.min(100, percentage))
  const color = severityColor(clamped)
  return (
    <div>
      <div style={{
        height, borderRadius: height / 2, background: 'var(--color-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${clamped}%`, height: '100%', background: color, borderRadius: height / 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
        <span>{used.toLocaleString()} / {limit.toLocaleString()} entries</span>
        <span>{Math.round(clamped)}% used</span>
      </div>
    </div>
  )
}
