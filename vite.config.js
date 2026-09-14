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
      // Must be 'prompt', not 'autoUpdate': vite-plugin-pwa forces
      // workbox.skipWaiting/clientsClaim to true internally whenever
      // registerType is 'autoUpdate' (see its source, injectManifest
      // handling around registerType === "autoUpdate") - REGARDLESS of what
      // this file's workbox block sets. skipWaiting makes the new service
      // worker call self.skipWaiting() unconditionally on install, so it
      // never enters the "waiting" state that workbox-window watches for.
      // registerServiceWorker.js's onNeedRefresh only fires on that
      // "waiting" state, so with 'autoUpdate' it silently never fires - the
      // new worker takes over in the background but the open tab keeps
      // running its old JS/HTML until someone manually hard-refreshes.
      // 'prompt' leaves the new worker waiting and lets the client
      // (registerServiceWorker.js) decide when to tell it to activate, via
      // updateSW(true), which is exactly what onNeedRefresh does here.
      registerType: 'prompt',
      // Registered explicitly via virtual:pwa-register instead
      // (src/lib/registerServiceWorker.js) - that's the only way to get an
      // onNeedRefresh hook that actually reloads an already-open tab once
      // the new worker takes over, instead of it silently running the old
      // build until someone happens to hard-refresh.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      workbox: {
        // clientsClaim (not skipWaiting - see registerType above) is what
        // lets a newly-activated service worker take over already-open
        // tabs once registerServiceWorker.js tells it to.
        clientsClaim: true,
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
