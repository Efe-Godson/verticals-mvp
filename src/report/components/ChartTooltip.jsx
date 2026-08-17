// Place at: src/report/components/ChartTooltip.jsx
// Small floating tooltip for chart hover states, shared by PieChart and
// HorizontalBarChart. Positioned from the triggering mouse event's viewport
// coordinates (fixed positioning) rather than a library, these charts are
// simple enough not to need a portal/collision engine.

import { useCallback, useEffect, useState } from 'react'

// Touch devices synthesize a "mouseenter" from a tap but never send the
// matching "mouseleave" (there's no pointer to leave with), so a
// hover-triggered tooltip just gets stuck on screen, fixed-positioned,
// riding along as the page scrolls - the bar/column it describes is
// already labeled with its value directly, so hover is a pure desktop
// nicety, not something worth losing on touch. Gating on `(hover: hover)`
// (true for mice/trackpads, false for touchscreens) skips it there instead
// of trying to patch touch semantics onto a hover-only interaction.
function supportsHover() {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches
}

export function useChartTooltip() {
  const [tooltip, setTooltip] = useState(null) // { x, y, label, value }

  const showTooltip = useCallback((e, label, value) => {
    if (!supportsHover()) return
    setTooltip({ x: e.clientX, y: e.clientY, label, value })
  }, [])

  const moveTooltip = useCallback((e) => {
    setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  // Belt-and-suspenders for hybrid devices (touchscreen laptops, etc.) that
  // do report hover support: a stuck tooltip should never survive a scroll.
  useEffect(() => {
    if (!tooltip) return
    window.addEventListener('scroll', hideTooltip, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', hideTooltip, { capture: true })
  }, [tooltip, hideTooltip])

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
