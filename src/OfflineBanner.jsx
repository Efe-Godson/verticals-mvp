import { useEffect, useState } from 'react'

// Cached app-shell assets (see vite.config.js's VitePWA workbox config) let
// the page still open with no network, but Supabase calls will all fail -
// this just makes that state visible instead of letting things fail silently.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      paddingTop: 'env(safe-area-inset-top)',
      zIndex: 3000, textAlign: 'center',
    }}>
      <div style={{
        background: 'var(--status-warning)', color: '#1a1a1a',
        fontSize: '0.85rem', fontWeight: 600, padding: '0.4rem 1rem',
      }}>
        You're offline - changes won't save until your connection is back.
      </div>
    </div>
  )
}
