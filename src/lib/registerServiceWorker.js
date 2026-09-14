// Place at: src/lib/registerServiceWorker.js
// A new deploy's service worker installs and sits "waiting" until this file
// tells it to take over (see vite.config.js - skipWaiting is intentionally
// NOT set in the workbox config, so it doesn't skip that waiting state on
// its own). Even once it does take over, that only means it starts
// controlling *future* requests. A tab that was already open keeps running
// the old HTML/JS it originally loaded until something actually reloads it,
// so without this a deploy could sit one version behind indefinitely for
// anyone who doesn't manually hard-refresh. onNeedRefresh fires when the new
// worker is waiting, and updateSW(true) tells it to activate and reloads
// once it does, which is what actually fetches the new build.
//
// Switched from vite-plugin-pwa's auto-injected registration script (see
// vite.config.js's injectRegister: null) to this explicit virtual:pwa-
// register call specifically to get that onNeedRefresh hook - the injected
// script only registers the worker, it doesn't know to reload anything.
import { registerSW } from 'virtual:pwa-register'

export function registerServiceWorker() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // A tab left open for hours (this is a POS/forms app people keep
      // open all shift) otherwise never notices a deploy until it happens
      // to navigate somewhere - poll so it picks one up within the hour.
      setInterval(() => registration.update(), 60 * 60 * 1000)
    },
    onNeedRefresh() {
      updateSW(true)
    },
  })
}

// Manual "Refresh app" button (NavBar.jsx) - the autoUpdate flow above
// handles a normal deploy on its own, but someone who suspects they're
// stuck on a stale build (or just wants to be sure right now, same
// situation that motivated this file) shouldn't have to know DevTools
// exists to force it. Unregisters every service worker and empties the
// Cache Storage entries workbox precached into, so the reload that follows
// can't be served anything but a fresh network fetch - stronger than
// registerSW(true) above, which only helps if a new build is actually
// waiting; this works even when the current one just needs a clean reload.
export async function forceRefreshApp() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch {
    // Fall through to reload regardless - worst case it's a normal reload
    // instead of a cache-busting one, not a failure to refresh at all.
  } finally {
    window.location.reload()
  }
}
