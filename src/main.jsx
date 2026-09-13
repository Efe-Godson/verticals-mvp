import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.jsx'
import { applyCachedThemeColor, applyCachedThemeMode, watchSystemTheme } from './theme.js'
import { initPostHog, posthog, posthogEnabled } from './lib/posthog.js'

applyCachedThemeMode()
applyCachedThemeColor()
watchSystemTheme()
initPostHog()

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