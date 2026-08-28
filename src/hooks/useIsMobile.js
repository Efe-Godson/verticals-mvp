import { useEffect, useState } from 'react'

// The one shared responsive breakpoint hook. Replaces the ad-hoc
// window.innerWidth + resize listeners that were copy-pasted in PublicForm
// and HorizontalBarChart. Uses matchMedia so it fires once per crossing, not
// on every resize pixel, and is safe to call before mount.
export const MOBILE_BREAKPOINT = 768
export const NARROW_BREAKPOINT = 480

function query(breakpoint) {
  return `(max-width: ${breakpoint - 1}px)`
}

function read(breakpoint) {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(query(breakpoint)).matches
}

export default function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => read(breakpoint))

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query(breakpoint))
    const onChange = (e) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    // Safari < 14 only supports addListener/removeListener.
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [breakpoint])

  return isMobile
}
