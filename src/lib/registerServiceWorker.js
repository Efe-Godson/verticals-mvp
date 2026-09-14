// Place at: src/lib/registerServiceWorker.js
// vite.config.js's VitePWA block (registerType: 'autoUpdate', skipWaiting,
// clientsClaim) already makes a new deploy's service worker take over as
// soon as it installs - but "takes over" only means it starts controlling
// *future* requests. A tab that was already open keeps running the old
// HTML/JS it originally loaded until something actually reloads it, so
// without this a deploy could sit one version behind indefinitely for
// anyone who doesn't manually hard-refresh. onNeedRefresh reloads once the
// new worker is ready, which is what actually fetches the new build.
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
