import { useRef, useState } from 'react'

// Swipe-down-to-close for bottom sheets. Extracted from NavBar.jsx's mobile
// menu sheet - plain DOM writes for the live drag so a fast finger doesn't
// fight React's render cycle; `dragging` just flips the CSS transition off
// while tracking. Returns handlers to spread onto the drag-handle element
// and the ref to put on the sheet.
const CLOSE_THRESHOLD = 80

export default function useDragToDismiss(onDismiss) {
  const [dragging, setDragging] = useState(false)
  const startY = useRef(null)
  const sheetRef = useRef(null)

  function onTouchStart(e) {
    startY.current = e.touches[0].clientY
    setDragging(true)
  }
  function onTouchMove(e) {
    if (startY.current == null || !sheetRef.current) return
    const delta = Math.max(0, e.touches[0].clientY - startY.current)
    sheetRef.current.style.transform = `translateY(${delta}px)`
  }
  function onTouchEnd(e) {
    if (startY.current == null || !sheetRef.current) return
    const delta = Math.max(0, (e.changedTouches[0]?.clientY ?? startY.current) - startY.current)
    startY.current = null
    setDragging(false)
    sheetRef.current.style.transform = ''
    if (delta > CLOSE_THRESHOLD) onDismiss?.()
  }

  return { dragging, sheetRef, handleProps: { onTouchStart, onTouchMove, onTouchEnd } }
}
