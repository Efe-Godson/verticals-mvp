import { useCallback, useState } from 'react'
import { forceRefreshApp } from '../lib/registerServiceWorker'

export default function useAppUpdate() {
  const [updating, setUpdating] = useState(false)

  const updateApp = useCallback(() => {
    setUpdating(true)
    window.setTimeout(() => { forceRefreshApp() }, 120)
  }, [])

  return { updating, updateApp }
}