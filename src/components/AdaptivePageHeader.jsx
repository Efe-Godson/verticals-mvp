import { getHeaderLayout } from './headerLayout'
import { useLayoutEffect, useRef, useState, useId } from 'react'

// Reserve the full title before deciding whether filters fit beside it.
export default function AdaptivePageHeader({ title, filters, filterWidth, minimumFilterWidth = filterWidth, open, onOpenChange, children }) {
  const rowRef = useRef(null)
  const titleRef = useRef(null)
  const buttonRef = useRef(null)
  const [layout, setLayout] = useState({ condensed: true, filterWidth })
  const { condensed } = layout
  const panelId = useId()

  useLayoutEffect(() => {
    const measure = () => {
      const available = rowRef.current?.clientWidth || 0
      const next = getHeaderLayout(available, titleRef.current?.getBoundingClientRect().width || 0, buttonRef.current?.offsetWidth || 100, filterWidth, minimumFilterWidth)
      setLayout(current => current.condensed === next.condensed && current.filterWidth === next.filterWidth ? current : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rowRef.current)
    observer.observe(titleRef.current)
    observer.observe(buttonRef.current)
    return () => observer.disconnect()
  }, [title, filterWidth, minimumFilterWidth])

  return (
    <div ref={rowRef} className="adaptive-page-header" data-html2canvas-ignore="true" onKeyDown={event => {
      if (event.key === 'Escape' && open) { onOpenChange(false); buttonRef.current?.focus() }
    }}>
      <div className="adaptive-title-measure" aria-hidden="true"><span ref={titleRef}>{title}</span></div>
      <h1>{title}</h1>
      {!condensed && <div className="adaptive-inline-filters" style={{ width: layout.filterWidth }}>{filters}</div>}
      <button ref={buttonRef} type="button" className="secondary" aria-expanded={open} aria-controls={panelId} onClick={() => onOpenChange(!open)}>Options <span aria-hidden="true">&#9662;</span></button>
      {open && <>
        <div className="adaptive-menu-backdrop" onClick={() => onOpenChange(false)} />
        <div id={panelId} className="adaptive-options-panel">
          {condensed && <div className="adaptive-menu-filters"><strong>Search and filters</strong>{filters}</div>}
          {children}
        </div>
      </>}
    </div>
  )
}
