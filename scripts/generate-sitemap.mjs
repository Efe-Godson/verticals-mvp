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

const urls = PUBLIC_ROUTES.map(route => `  <url>
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
console.log(`Wrote ${PUBLIC_ROUTES.length} URLs to public/sitemap.xml (${SITE_URL})`)
