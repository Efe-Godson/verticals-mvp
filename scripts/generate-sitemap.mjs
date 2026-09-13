// Regenerates public/sitemap.xml from PUBLIC_ROUTES (src/config/seo.js) -
// one source of truth shared with scripts/prerender.mjs, instead of hand-
// maintaining the XML file separately (see the SEO Implementation plan).
// Run: node scripts/generate-sitemap.mjs (also wired into `npm run build`).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { SITE_URL, PUBLIC_ROUTES, absoluteUrl } from '../src/config/seo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const today = new Date().toISOString().slice(0, 10)

// Published Resource articles are dynamic (resource_articles rows), so they
// can't live in the static PUBLIC_ROUTES list like every other page here -
// fetched from the same public-content edge function the live /resources
// pages use (see src/lib/legalContentClient.js), which only ever returns
// published fields. Wrapped in try/catch so a Supabase hiccup (or missing
// env vars, e.g. in CI) degrades to "sitemap without articles" rather than
// failing `npm run build` outright.
async function fetchResourceArticleUrls() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('generate-sitemap: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set - skipping Resource article URLs.')
    return []
  }
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/public-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      body: JSON.stringify({ action: 'list_resources' }),
    })
    if (!response.ok) throw new Error(`public-content returned ${response.status}`)
    const { articles } = await response.json()
    return (articles || []).map(a => ({ path: `/resources/${a.slug}`, priority: '0.5', changefreq: 'monthly' }))
  } catch (err) {
    console.warn('generate-sitemap: could not fetch Resource articles, skipping them -', err.message)
    return []
  }
}

const resourceArticleRoutes = await fetchResourceArticleUrls()
const allRoutes = [...PUBLIC_ROUTES, ...resourceArticleRoutes]

const urls = allRoutes.map(route => `  <url>
    <loc>${absoluteUrl(route.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

const outPath = path.join(__dirname, '..', 'public', 'sitemap.xml')
fs.writeFileSync(outPath, xml)
console.log(`Wrote ${allRoutes.length} URLs to public/sitemap.xml (${SITE_URL})`)
