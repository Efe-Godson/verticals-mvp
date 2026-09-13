// Place at: src/report/builder/print/useAutosave.js
// Debounced autosave (Designer 2.0 Phase 1, step 12) - watches for edits
// and calls save() a short idle period after the last one, so work isn't
// lost to a forgotten manual Save. The manual Save button stays; this just
// means the user doesn't have to remember to click it.
//
// `changeToken` must be a value that changes identity on every edit (e.g.
// printLayout, which useReportBuilder.js's mutate() always replaces with a
// new object) - `dirty` alone won't do, since it's a boolean that's already
// true after the first edit and so doesn't change value (and therefore
// doesn't re-trigger this effect) on subsequent edits, which would leave
// the debounce timer from the *first* edit as the only one that ever fires.
import { useCallback, useEffect, useRef, useState } from 'react'

// status: 'idle' | 'saving' | 'saved' | 'error'
export function useAutosave(changeToken, dirty, save, { delay = 1500 } = {}) {
  const [status, setStatus] = useState('idle')
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!dirty) return
    setStatus('idle')
    const timer = setTimeout(async () => {
      setStatus('saving')
      const { error } = await saveRef.current()
      setStatus(error ? 'error' : 'saved')
    }, delay)
    return () => clearTimeout(timer)
  }, [changeToken, dirty, delay])

  const retry = useCallback(async () => {
    setStatus('saving')
    const { error } = await saveRef.current()
    setStatus(error ? 'error' : 'saved')
  }, [])

  return { status, retry }
}
