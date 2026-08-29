// Timing helpers for the Universal Loading States brief §9 (minimum-
// duration behaviour): don't flash a skeleton for a request that resolves
// in a few ms, and once a skeleton IS shown, keep it up long enough to not
// strobe.
import { useEffect, useRef, useState } from 'react'

// showSkeleton is false for the first `delay` ms of loading (fast requests
// show nothing), then true; once true it stays true for at least
// `minVisible` ms even if loading finishes, so it never blinks.
export function useDeferredLoading(isLoading, { delay = 200, minVisible = 400 } = {}) {
  const [show, setShow] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    let toShow, toHide
    if (isLoading) {
      toShow = setTimeout(() => { shownAt.current = Date.now(); setShow(true) }, delay)
    } else if (show) {
      const elapsed = Date.now() - shownAt.current
      toHide = setTimeout(() => setShow(false), Math.max(0, minVisible - elapsed))
    }
    return () => { clearTimeout(toShow); clearTimeout(toHide) }
  }, [isLoading, show, delay, minVisible])

  return show
}

// True only once `isLoading` has been running for `after` ms - for showing
// an extra "this is taking a moment" message on slow operations (§9).
export function useSlowFlag(isLoading, after = 2000) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!isLoading) { setSlow(false); return }
    const t = setTimeout(() => setSlow(true), after)
    return () => clearTimeout(t)
  }, [isLoading, after])
  return slow
}
