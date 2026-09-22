// Place at: src/report/components/DateRangeSlider.jsx
// Power BI-style two-handle date range slider for Report.jsx's "Date slider"
// filter option. The track only ever spans the earliest-to-latest date the
// form actually has submissions for (see Report.jsx's dateBounds) - there's
// nothing to show past either end, so dragging past it would just show a
// misleading amount of empty room.
import { useCallback, useEffect, useRef, useState } from 'react'

// Local Y/M/D only, never toISOString() - toISOString() converts to UTC
// first, which silently shifts the calendar day for any timezone ahead of
// UTC (Nigeria included) once local midnight crosses back into "yesterday".
function toISODate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fromISODate(iso) {
  return new Date(iso + 'T00:00:00')
}
function dayIndex(d) {
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)
}

export default function DateRangeSlider({ minDate, maxDate, startValue, endValue, onChange }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(null) // 'start' | 'end' | null

  const minDay = dayIndex(minDate)
  const maxDay = dayIndex(maxDate)
  const totalDays = Math.max(1, maxDay - minDay) // avoid divide-by-zero when every submission is the same day

  const startDay = startValue ? Math.min(Math.max(dayIndex(fromISODate(startValue)), minDay), maxDay) : minDay
  const endDay = endValue ? Math.min(Math.max(dayIndex(fromISODate(endValue)), minDay), maxDay) : maxDay

  const startPct = ((startDay - minDay) / totalDays) * 100
  const endPct = ((endDay - minDay) / totalDays) * 100

  const dayFromClientX = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round(minDay + pct * totalDays)
  }, [minDay, totalDays])

  const moveThumb = useCallback((which, clientX) => {
    const day = dayFromClientX(clientX)
    const newStartDay = which === 'start' ? Math.min(day, endDay) : startDay
    const newEndDay = which === 'end' ? Math.max(day, startDay) : endDay
    onChange(
      toISODate(new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() + (newStartDay - minDay))),
      toISODate(new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() + (newEndDay - minDay)))
    )
  }, [dayFromClientX, startDay, endDay, minDay, minDate, onChange])

  useEffect(() => {
    if (!dragging) return
    function handleMove(e) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      moveThumb(dragging, clientX)
    }
    function handleUp() { setDragging(null) }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragging, moveThumb])

  function handleTrackClick(e) {
    if (e.target !== trackRef.current) return
    const day = dayFromClientX(e.clientX)
    // Nudge whichever handle is closer, same convention as most range
    // sliders (clicking the track doesn't reset the whole selection).
    const which = Math.abs(day - startDay) <= Math.abs(day - endDay) ? 'start' : 'end'
    moveThumb(which, e.clientX)
  }

  const thumbStyle = (pct) => ({
    position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%, -50%)',
    width: '16px', height: '16px', borderRadius: '50%', background: 'var(--color-primary)',
    border: '2px solid var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    cursor: 'grab', touchAction: 'none', zIndex: 2,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', minWidth: '160px', maxWidth: '260px', padding: '0.2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text)', fontWeight: 600 }}>
        <span>{toISODate(new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() + (startDay - minDay)))}</span>
        <span>{toISODate(new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() + (endDay - minDay)))}</span>
      </div>
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{ position: 'relative', height: '4px', borderRadius: '2px', background: 'var(--color-border)', cursor: 'pointer' }}
      >
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: `${startPct}%`, width: `${endPct - startPct}%`,
          background: 'var(--color-primary)', borderRadius: '2px',
        }} />
        <div
          role="slider" aria-label="Start date" aria-valuemin={minDay} aria-valuemax={maxDay} aria-valuenow={startDay}
          onPointerDown={(e) => { e.stopPropagation(); setDragging('start') }}
          style={thumbStyle(startPct)}
        />
        <div
          role="slider" aria-label="End date" aria-valuemin={minDay} aria-valuemax={maxDay} aria-valuenow={endDay}
          onPointerDown={(e) => { e.stopPropagation(); setDragging('end') }}
          style={thumbStyle(endPct)}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-muted)' }}>
        <span>{toISODate(minDate)}</span>
        <span>{toISODate(maxDate)}</span>
      </div>
    </div>
  )
}
