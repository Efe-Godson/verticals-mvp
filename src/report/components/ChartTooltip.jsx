// Place at: src/report/components/ChartTooltip.jsx
// Small floating tooltip for chart hover states, shared by PieChart and
// HorizontalBarChart. Positioned from the triggering mouse event's viewport
// coordinates (fixed positioning) rather than a library — these charts are
// simple enough not to need a portal/collision engine.

import { useCallback, useState } from 'react'

export function useChartTooltip() {
  const [tooltip, setTooltip] = useState(null) // { x, y, label, value }

  const showTooltip = useCallback((e, label, value) => {
    setTooltip({ x: e.clientX, y: e.clientY, label, value })
  }, [])

  const moveTooltip = useCallback((e) => {
    setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  return { tooltip, showTooltip, moveTooltip, hideTooltip }
}

export default function ChartTooltip({ tooltip }) {
  if (!tooltip) return null

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tooltip.x + 14,
        top: tooltip.y + 14,
        pointerEvents: 'none',
        zIndex: 1000,
        background: 'var(--color-text)',
        color: 'var(--color-surface)',
        fontSize: '.78rem',
        lineHeight: 1.4,
        padding: '.4rem .6rem',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        maxWidth: '220px',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ fontWeight: 600 }}>{tooltip.label}</div>
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>{tooltip.value}</div>
    </div>
  )
}
