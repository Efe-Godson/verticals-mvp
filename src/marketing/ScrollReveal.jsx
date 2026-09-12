// Place at: src/marketing/ScrollReveal.jsx
// Fades + lifts its children into place the first time they scroll into
// view - the only motion device this page uses beyond hover/button
// transitions (see marketing.css's prefers-reduced-motion block, honoured
// here too since an IntersectionObserver reveal needs its own JS check).
import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

export default function ScrollReveal({ children, className }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(prefersReducedMotion)

  useEffect(() => {
    if (prefersReducedMotion || !ref.current) return
    const node = ref.current
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.unobserve(node)
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const classes = ['mkt-reveal', visible && 'mkt-reveal--visible', className].filter(Boolean).join(' ')
  return <div ref={ref} className={classes}>{children}</div>
}
