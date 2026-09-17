import { useLayoutEffect, useRef, useState } from 'react'
import { fitChartInBox } from './chartFit'

// Render at a readable chart size, then contain the entire result in its cell.
// Natural-height lists retain every row; Recharts receives a real pixel height.
export default function FitChartToCell({ children, fixedHeight = false }) {
  const boxRef = useRef(null)
  const contentRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [content, setContent] = useState({ width: 640, height: 360 })
  const logicalWidth = Math.max(640, box.width)
  const logicalHeight = Math.max(360, box.height)

  useLayoutEffect(() => {
    const el = boxRef.current
    const measure = () => setBox(current => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      return current.width === next.width && current.height === next.height ? current : next
    })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = contentRef.current
    const measure = () => setContent(current => {
      const next = { width: Math.max(logicalWidth, el.scrollWidth), height: Math.max(1, el.scrollHeight, el.offsetHeight) }
      return current.width === next.width && current.height === next.height ? current : next
    })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => observer.disconnect()
  }, [logicalWidth, logicalHeight, children])

  const fit = fitChartInBox(box.width, box.height, content.width, content.height)
  return (
    <div ref={boxRef} style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      <div ref={contentRef} style={{ position: 'absolute', width: logicalWidth, height: fixedHeight ? logicalHeight : 'auto', display: 'flow-root', left: fit.x, top: fit.y, transform: 'scale(' + fit.scale + ')', transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}
