import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.jsx'
import { applyCachedThemeColor, applyCachedThemeMode, watchSystemTheme } from './theme.js'
import { initPostHog, posthog, posthogEnabled } from './lib/posthog.js'
import { initDateInputClickToOpen } from './lib/dateInputClick.js'
import { registerServiceWorker } from './lib/registerServiceWorker.js'

applyCachedThemeMode()
applyCachedThemeColor()
watchSystemTheme()
initPostHog()
initDateInputClickToOpen()
registerServiceWorker()

// Every route in App.jsx is React.lazy()-loaded, so navigating to one
// fetches its chunk (e.g. BusinessesHome-<hash>.js) on demand. A tab left
// open across a deploy still has the OLD build's chunk filenames in its
// module graph - if that chunk no longer exists on the server (a new
// deploy replaced it with a new hash), the fetch 404s and throws straight
// out of React.lazy() into ErrorBoundary ("Something went wrong on this
// page") for no reason a reload doesn't already fix, since a reload picks
// up the current build's filenames. Vite dispatches this event right
// before that throw specifically so it can be caught here instead - this
// is Vite's own documented fix for the "dynamic import fails to fetch
// module after deployment" case. Capped at 3 auto-reloads per tab session
// (cleared once the app's been stable a while) so a genuinely broken load
// - offline, a real outage - falls through to ErrorBoundary's manual
// Reload/Go Home instead of looping forever.
const PRELOAD_RETRY_KEY = 'vitePreloadRetryCount'
window.addEventListener('vite:preloadError', () => {
  const retries = Number(sessionStorage.getItem(PRELOAD_RETRY_KEY) || 0)
  if (retries >= 3) return
  sessionStorage.setItem(PRELOAD_RETRY_KEY, String(retries + 1))
  window.location.reload()
})
setTimeout(() => sessionStorage.removeItem(PRELOAD_RETRY_KEY), 30000)

const app = (
  <BrowserRouter>
    <App />
    {/* Cookieless pageview tracking (no consent banner needed) - only
        starts sending data once Web Analytics is turned on for this
        project in the Vercel dashboard; a no-op locally/until then. */}
    <Analytics />
  </BrowserRouter>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {posthogEnabled ? (
      <PostHogProvider client={posthog}>
        <PostHogErrorBoundary>{app}</PostHogErrorBoundary>
      </PostHogProvider>
    ) : app}
  </StrictMode>,
)