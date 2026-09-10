import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We author manifest.webmanifest by hand in public/ and link it
      // ourselves in index.html, so the plugin doesn't need to generate one.
      manifest: false,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      workbox: {
        // Take over and drop the previous build's precache as soon as the
        // new service worker installs, so a deploy actually reaches open
        // tabs on the next load instead of lingering a version behind.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // Vendor chunks (jspdf, xlsx, pptxgenjs, html2canvas) can land above
        // the 2MB default - raise the ceiling so the precache build doesn't
        // silently drop them.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Supabase requests (auth, database, storage, edge functions)
            // must never be served from cache - always hit the network so
            // the app never shows stale/incorrect business data or reuses a
            // cached auth response.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
