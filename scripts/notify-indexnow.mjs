// Notifies participating search engines (Bing, and others that share the
// IndexNow network) that the public marketing pages listed in
// PUBLIC_ROUTES have changed - brief section 37. Deliberately NOT wired
// into `npm run build`/CI: IndexNow should fire when public content is
// actually published, not on every commit, and it applies only to the
// public marketing surface (never private records/reports/forms - see
// PUBLIC_ROUTES in src/config/seo.js, the same indexable-page list the
// sitemap and prerenderer use, so there's no separate list to keep in
// sync or accidentally leak a private route through).
//
// Requires a real IndexNow key, generated at https://www.bing.com/indexnow
// (or any IndexNow-compatible generator) - this script only sends it, it
// doesn't register one. Until INDEXNOW_KEY is set, running this is a no-op
// that explains what's missing, rather than silently doing nothing or
// sending an invalid request.
//
// Setup once a real key exists:
//   1. Set INDEXNOW_KEY (e.g. in the deploy environment, or locally via
//      `INDEXNOW_KEY=... node scripts/notify-indexnow.mjs`).
//   2. Create public/<INDEXNOW_KEY>.txt containing just the key itself -
//      IndexNow's ownership-verification file. Not generated here since it
//      has to match a real registered key, not a placeholder.
// Run after deploying changed/new public pages:
//   npm run notify:indexnow
import { SITE_URL, PUBLIC_ROUTES, absoluteUrl } from '../src/config/seo.js'

const key = process.env.INDEXNOW_KEY

if (!key) {
  console.log('notify-indexnow: INDEXNOW_KEY is not set - skipping (see scripts/notify-indexnow.mjs for setup).')
  process.exit(0)
}

const urlList = PUBLIC_ROUTES.map(route => absoluteUrl(route.path))
const host = new URL(SITE_URL).host

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList,
  }),
})

if (res.ok) {
  console.log(`notify-indexnow: submitted ${urlList.length} URL(s), status ${res.status}`)
} else {
  console.error(`notify-indexnow: request failed - status ${res.status} ${res.statusText}`)
  console.error(await res.text().catch(() => ''))
  process.exit(1)
}
