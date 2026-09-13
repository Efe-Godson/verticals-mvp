import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.jsx'
import { applyCachedThemeColor, applyCachedThemeMode, watchSystemTheme } from './theme.js'

applyCachedThemeMode()
applyCachedThemeColor()
watchSystemTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      {/* Cookieless pageview tracking (no consent banner needed) - only
          starts sending data once Web Analytics is turned on for this
          project in the Vercel dashboard; a no-op locally/until then. */}
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)