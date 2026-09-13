// Writes static HTML for each prerenderable PUBLIC_ROUTES entry into dist/,
// using dist/index.html (produced by `vite build`) as the head/asset-tag
// template and dist-ssr/entry-server.js (produced by `vite build --ssr
// src/entry-server.jsx`, see package.json's build:ssr script) to render
// each page's body. See the SEO Implementation plan for why this replaces
// an empty <div id="root"></div> with real content for crawlers that don't
// execute JS well, without needing a headless browser.
//
// Run via `npm run build` (chained after build:client + build:ssr) or
// directly with `npm run prerender` once both of those already exist.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PUBLIC_ROUTES, seoPages, absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from '../src/config/seo.js'
import { buildOrganization, buildWebSite, buildSoftwareApplication, buildBreadcrumbList, buildFAQPage } from '../src/seo/structuredData.js'
import { SALES_TRACKING_FAQS, EXPENSE_TRACKING_FAQS, FORMS_FAQS, RECORDS_FAQS, REPORTS_FAQS, SMALL_BUSINESS_FAQS, RESTAURANT_FAQS, RETAIL_FAQS, INVENTORY_FAQS, PAYROLL_FAQS, TEMPLATES_FAQS } from '../src/seo/faqContent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const distDir = path.join(root, 'dist')
const ssrEntryPath = path.join(root, 'dist-ssr', 'entry-server.js')

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('prerender: dist/index.html not found - run `npm run build:client` first.')
  process.exit(1)
}
if (!fs.existsSync(ssrEntryPath)) {
  console.error('prerender: dist-ssr/entry-server.js not found - run `npm run build:ssr` first.')
  process.exit(1)
}

function toFileUrl(p) {
  return 'file://' + p.replace(/\\/g, '/')
}

const { renderPage } = await import(toFileUrl(ssrEntryPath))
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')

// Mirrors exactly what each page's own <SEO structuredData={...}> passes at
// runtime (see each src/marketing/pages/*.jsx) - kept alongside them here
// since the static pass can't just render the component and read it back
// out (see stripHeadTags below).
const SCHEMAS_BY_SEO_KEY = {
  home: () => [buildOrganization(), buildWebSite(), buildSoftwareApplication()],
  product: () => [buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Product' }])],
  forms: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Forms' }]),
    buildFAQPage(FORMS_FAQS),
  ],
  productRecords: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Product', path: '/product' }, { name: 'Records' }]),
    buildFAQPage(RECORDS_FAQS),
  ],
  productReports: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Product', path: '/product' }, { name: 'Reports' }]),
    buildFAQPage(REPORTS_FAQS),
  ],
  salesTracking: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Sales Tracking' }]),
    buildFAQPage(SALES_TRACKING_FAQS),
  ],
  expenseTracking: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Expense Tracking' }]),
    buildFAQPage(EXPENSE_TRACKING_FAQS),
  ],
  inventoryManagement: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Inventory Management' }]),
    buildFAQPage(INVENTORY_FAQS),
  ],
  payroll: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Payroll' }]),
    buildFAQPage(PAYROLL_FAQS),
  ],
  forSmallBusinesses: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'For Small Businesses' }]),
    buildFAQPage(SMALL_BUSINESS_FAQS),
  ],
  forRestaurants: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'For Restaurants' }]),
    buildFAQPage(RESTAURANT_FAQS),
  ],
  forRetail: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'For Retail' }]),
    buildFAQPage(RETAIL_FAQS),
  ],
  templateGallery: () => [
    buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Templates' }]),
    buildFAQPage(TEMPLATES_FAQS),
  ],
  resources: () => [buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Resources' }])],
  about: () => [buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'About' }])],
  contact: () => [buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Contact' }])],
  privacy: () => [buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Privacy Policy' }])],
  terms: () => [buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Terms of Service' }])],
}

// SEO.jsx renders its own <title>/<meta>/<link>/<script type="application/
// ld+json"> tags as part of each page's tree - correct for live client-side
// navigation, but renderToStaticMarkup has no <head> to hoist them into
// here, so they'd otherwise land as invalid, duplicate tags inline in the
// body. Stripped out below; the real <head> is rebuilt from
// src/config/seo.js + SCHEMAS_BY_SEO_KEY above instead - the same data the
// live SEO component renders, just also baked into the static HTML.
function stripHeadTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\b[^>]*>/g, '')
    .replace(/<link\b[^>]*>/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHead(seoKey, canonicalPath) {
  const meta = seoPages[seoKey]
  const url = absoluteUrl(canonicalPath)
  const schemas = (SCHEMAS_BY_SEO_KEY[seoKey] || (() => []))()
  const robots = meta.noindex ? 'noindex, follow' : 'index, follow'
  return `<title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />${schemas.map(s => `
    <script type="application/ld+json">${JSON.stringify(s)}</script>`).join('')}`
}

let written = 0
for (const route of PUBLIC_ROUTES) {
  if (!route.prerender || !route.seoKey) continue

  const bodyHtml = stripHeadTags(renderPage(route.seoKey, route.path))

  const html = template
    // Swaps the whole static <title>...head content up to </head> for this
    // page's own - same tag set as index.html's default, page-specific
    // values.
    .replace(/<title>[\s\S]*?(?=<\/head>)/, buildHead(route.seoKey, route.path) + '\n  ')
    .replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)

  const outFile = route.path === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, route.path.replace(/^\//, ''), 'index.html')

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, html)
  written++
}

console.log(`prerender: wrote ${written} static page(s) into dist/`)
