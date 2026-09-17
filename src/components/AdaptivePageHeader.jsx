import { getHeaderLayout } from './headerLayout'
import { useLayoutEffect, useRef, useState, useId } from 'react'

// Search/filters used to move into the Options dropdown once the title
// crowded them out of the row (condensed) - now they get their own
// collapsible row below the header instead, toggled by this icon, so
// Options stays actions-only (Print, Download, ...) regardless of how long
// the title is.
function RibbonToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}

// Reserve the full title before deciding whether filters fit beside it.
export default function AdaptivePageHeader({ title, filters, filterWidth, minimumFilterWidth = filterWidth, open, onOpenChange, children }) {
  const rowRef = useRef(null)
  const titleRef = useRef(null)
  const buttonRef = useRef(null)
  const [layout, setLayout] = useState({ condensed: true, filterWidth })
  const { condensed } = layout
  const panelId = useId()
  const ribbonId = useId()
  // Only meaningful while condensed - closes itself once filters fit inline
  // again (title shortens, window widens) so it can't get stuck open
  // showing a row that's now redundant with the inline filters.
  const [ribbonOpen, setRibbonOpen] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const available = rowRef.current?.clientWidth || 0
      const next = getHeaderLayout(available, titleRef.current?.getBoundingClientRect().width || 0, buttonRef.current?.offsetWidth || 100, filterWidth, minimumFilterWidth)
      setLayout(current => current.condensed === next.condensed && current.filterWidth === next.filterWidth ? current : next)
      if (!next.condensed) setRibbonOpen(false)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rowRef.current)
    observer.observe(titleRef.current)
    observer.observe(buttonRef.current)
    return () => observer.disconnect()
  }, [title, filterWidth, minimumFilterWidth])

  return (
    <>
      <div ref={rowRef} className="adaptive-page-header" data-html2canvas-ignore="true" onKeyDown={event => {
        if (event.key !== 'Escape') return
        if (open) { onOpenChange(false); buttonRef.current?.focus() }
        if (ribbonOpen) setRibbonOpen(false)
      }}>
        <div className="adaptive-title-measure" aria-hidden="true"><span ref={titleRef}>{title}</span></div>
        <h1>{title}</h1>
        {!condensed && <div className="adaptive-inline-filters" style={{ width: layout.filterWidth }}>{filters}</div>}
        {condensed && (
          <button
            type="button" className="secondary" aria-expanded={ribbonOpen} aria-controls={ribbonId} title="Search and filters"
            onClick={() => { setRibbonOpen(v => !v); onOpenChange(false) }}
          >
            <RibbonToggleIcon />
          </button>
        )}
        <button
          ref={buttonRef} type="button" className="secondary" aria-expanded={open} aria-controls={panelId}
          onClick={() => { onOpenChange(!open); setRibbonOpen(false) }}
        >
          Options <span aria-hidden="true">&#9662;</span>
        </button>
        {open && <>
          <div className="adaptive-menu-backdrop" onClick={() => onOpenChange(false)} />
          <div id={panelId} className="adaptive-options-panel">
            {children}
          </div>
        </>}
      </div>
      {condensed && ribbonOpen && (
        <div id={ribbonId} className="adaptive-ribbon-row" data-html2canvas-ignore="true">{filters}</div>
      )}
    </>
  )
}
