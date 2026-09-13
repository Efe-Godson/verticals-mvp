// Single source of truth for public-page SEO metadata (see the SEO
// Implementation plan). src/seo/SEO.jsx reads this for live client-side
// <title>/meta updates, scripts/prerender.mjs reads it for build-time static
// HTML, and PUBLIC_ROUTES below drives scripts/generate-sitemap.mjs - so a
// route's title/description/canonical/priority only ever gets typed once.
//
// No "www" - the app has consistently used the bare apex domain
// (verticalsapp.com) in index.html, robots.txt, sitemap.xml and the
// marketing footer's contact link, so this keeps that convention rather
// than introducing a second one.
export const SITE_URL = 'https://verticalsapp.com'
export const SITE_NAME = 'Verticals'
// Dedicated 1200x630 Open Graph/Twitter image (brief section 18) rather
// than reusing the square verticals-mark.png directly - see
// scripts/resize-brand-assets.ps1 for how it was generated (the same mark,
// composited onto the correct canvas size, 83% smaller as a bonus).
export const DEFAULT_OG_IMAGE = `${SITE_URL}/verticals-og.png`

// Every entry that has a `canonical` and isn't `noindex` is a real,
// crawlable public page - see PUBLIC_ROUTES below (a separate `path` field,
// used for routing/sitemap/prerender file output) for the subset that also
// gets prerendered + listed in the sitemap. Entries without `canonical`
// (login, signup, ...) are metadata-only, applied where those pages are
// routed - see SEO.jsx, which spreads these objects directly onto its own
// `canonical`/`title`/`description`/`noindex` props.
export const seoPages = {
  home: {
    canonical: '/',
    title: 'Verticals | Capture, Manage & Understand Your Data',
    description: 'Collect records, manage workflows and turn your data into clear reports and insights with Verticals.',
  },
  product: {
    canonical: '/product',
    title: 'Product Overview | Verticals',
    description: 'How Verticals turns forms into organised records and organised records into clear reports, in one connected system.',
  },
  forms: {
    canonical: '/forms',
    title: 'Build Custom Forms & Workflows | Verticals',
    description: 'Build a form around exactly what you need to record, share it as a public link, and collect submissions as structured records.',
  },
  productRecords: {
    canonical: '/product/records',
    title: 'Records Management | Verticals',
    description: 'Search, filter and export every record your forms collect - organised automatically, no manual spreadsheet cleanup.',
  },
  productReports: {
    canonical: '/product/reports',
    title: 'Reports & Business Analytics | Verticals',
    description: 'Turn your records into totals, trends and comparisons - with charts, pivot tables and AI-assisted analysis.',
  },
  salesTracking: {
    canonical: '/sales-tracking',
    title: 'Sales Tracking & Reporting | Verticals',
    description: 'Track daily sales, see your best-selling products and turn sales records into clear reports with Verticals.',
  },
  expenseTracking: {
    canonical: '/expense-tracking',
    title: 'Expense Tracking for Small Businesses | Verticals',
    description: 'Record expenses by category, date and payment method, then turn them into spending reports with Verticals.',
  },
  inventoryManagement: {
    canonical: '/inventory-management',
    title: 'Inventory Management | Verticals',
    description: 'Track stock levels, restock products, get low-stock warnings and keep inventory in sync with your sales records.',
  },
  payroll: {
    canonical: '/payroll',
    title: 'Payroll & Staff Payments | Verticals',
    description: 'Record staff salaries, bonuses, deductions and advances, and let Verticals work out each final payment automatically.',
  },
  forSmallBusinesses: {
    canonical: '/for-small-businesses',
    title: 'Verticals for Small Businesses',
    description: 'Track sales, expenses, inventory and staff payments in one connected system built for small businesses.',
  },
  forRestaurants: {
    canonical: '/for-restaurants',
    title: 'Verticals for Restaurants',
    description: 'Take orders, print receipts, pay staff and track performance - a workflow built around how restaurants actually operate.',
  },
  forRetail: {
    canonical: '/for-retail',
    title: 'Verticals for Retail',
    description: 'Record sales, generate invoices, track inventory and see your best-selling products with Verticals.',
  },
  // "/template-gallery" rather than the brief's suggested "/templates" -
  // that path is already the existing authenticated template picker (see
  // App.jsx), same naming collision as /records and /reports.
  templateGallery: {
    canonical: '/template-gallery',
    title: 'Templates | Verticals',
    description: 'Start from a ready-made Retail, Restaurant or Expenses template, or build your own from a blank Forms canvas.',
  },
  resources: {
    canonical: '/resources',
    title: 'Resources | Verticals',
    description: 'Guides on tracking sales, expenses, inventory and staff payments, and turning records into reports.',
  },
  about: {
    canonical: '/about',
    title: 'About Verticals',
    description: 'What Verticals is, the idea behind it, and who it helps capture, understand and act on their data.',
  },
  contact: {
    canonical: '/contact',
    title: 'Contact Verticals',
    description: 'Get in touch with the Verticals team.',
  },
  privacy: {
    canonical: '/privacy',
    title: 'Privacy Policy | Verticals',
    description: 'How Verticals collects, stores and protects the information in your account.',
  },
  terms: {
    canonical: '/terms',
    title: 'Terms of Service | Verticals',
    description: 'The terms that apply to using Verticals.',
  },
  notFound: {
    title: 'Page not found | Verticals',
    description: "The page you're looking for doesn't exist.",
    noindex: true,
  },
  login: {
    title: 'Sign In | Verticals',
    description: 'Sign in to your Verticals account.',
    noindex: true,
  },
  signup: {
    title: 'Sign Up | Verticals',
    description: 'Create a Verticals account.',
    noindex: true,
  },
  confirmEmail: {
    title: 'Confirm Your Email | Verticals',
    description: 'Confirm your email to finish setting up your Verticals account.',
    noindex: true,
  },
  resetPassword: {
    title: 'Reset Password | Verticals',
    description: 'Reset your Verticals account password.',
    noindex: true,
  },
  publicForm: {
    title: 'Verticals',
    description: undefined,
    noindex: true,
  },
}

// The subset of seoPages that's a real standalone public page - drives both
// the prerender script (scripts/prerender.mjs) and the sitemap generator
// (scripts/generate-sitemap.mjs). /demo is deliberately not prerendered
// (it's data-driven/interactive - out of scope here) but does stay in the
// sitemap, since the main demo landing page has useful standalone content
// on its own (see the SEO brief's demo-handling section).
export const PUBLIC_ROUTES = [
  { seoKey: 'home', path: '/', priority: '1.0', changefreq: 'weekly', prerender: true },
  { seoKey: 'product', path: '/product', priority: '0.9', changefreq: 'monthly', prerender: true },
  { seoKey: 'forms', path: '/forms', priority: '0.8', changefreq: 'monthly', prerender: true },
  { seoKey: 'productRecords', path: '/product/records', priority: '0.8', changefreq: 'monthly', prerender: true },
  { seoKey: 'productReports', path: '/product/reports', priority: '0.8', changefreq: 'monthly', prerender: true },
  { seoKey: 'salesTracking', path: '/sales-tracking', priority: '0.8', changefreq: 'monthly', prerender: true },
  { seoKey: 'expenseTracking', path: '/expense-tracking', priority: '0.8', changefreq: 'monthly', prerender: true },
  { seoKey: 'inventoryManagement', path: '/inventory-management', priority: '0.7', changefreq: 'monthly', prerender: true },
  { seoKey: 'payroll', path: '/payroll', priority: '0.7', changefreq: 'monthly', prerender: true },
  { seoKey: 'forSmallBusinesses', path: '/for-small-businesses', priority: '0.7', changefreq: 'monthly', prerender: true },
  { seoKey: 'forRestaurants', path: '/for-restaurants', priority: '0.7', changefreq: 'monthly', prerender: true },
  { seoKey: 'forRetail', path: '/for-retail', priority: '0.7', changefreq: 'monthly', prerender: true },
  { seoKey: 'templateGallery', path: '/template-gallery', priority: '0.6', changefreq: 'monthly', prerender: true },
  { seoKey: 'resources', path: '/resources', priority: '0.4', changefreq: 'monthly', prerender: true },
  { seoKey: 'about', path: '/about', priority: '0.5', changefreq: 'monthly', prerender: true },
  { seoKey: 'contact', path: '/contact', priority: '0.5', changefreq: 'monthly', prerender: true },
  { seoKey: 'privacy', path: '/privacy', priority: '0.3', changefreq: 'yearly', prerender: true },
  { seoKey: 'terms', path: '/terms', priority: '0.3', changefreq: 'yearly', prerender: true },
  { path: '/demo', priority: '0.6', changefreq: 'monthly', prerender: false },
]

export function absoluteUrl(path) {
  if (!path) return SITE_URL
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}
