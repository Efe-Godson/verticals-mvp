// Compiled via `vite build --ssr` (see package.json's build:ssr script) into
// dist-ssr/entry-server.js - plain Node can then import that compiled
// output and call renderPage() without needing to understand JSX itself.
// scripts/prerender.mjs is the consumer.
//
// Only the small set of standalone marketing pages are listed here (see
// PUBLIC_ROUTES in src/config/seo.js) - none of them read auth state or
// fetch data on initial render, so a plain renderToStaticMarkup is enough;
// no <App>/<AuthProvider>/Supabase involved, and no hydration bookkeeping
// needed since the client replaces this markup via createRoot on load
// (see src/main.jsx), not hydrateRoot.
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import LandingPage from './marketing/LandingPage'
import ProductPage from './marketing/pages/ProductPage'
import FormsPage from './marketing/pages/FormsPage'
import RecordsPage from './marketing/pages/RecordsPage'
import ReportsPage from './marketing/pages/ReportsPage'
import SalesTrackingPage from './marketing/pages/SalesTrackingPage'
import ExpenseTrackingPage from './marketing/pages/ExpenseTrackingPage'
import AboutPage from './marketing/pages/AboutPage'
import ContactPage from './marketing/pages/ContactPage'
import PrivacyPage from './marketing/pages/PrivacyPage'
import TermsPage from './marketing/pages/TermsPage'
import InventoryManagementPage from './marketing/pages/InventoryManagementPage'
import PayrollPage from './marketing/pages/PayrollPage'
import ForSmallBusinessesPage from './marketing/pages/ForSmallBusinessesPage'
import ForRestaurantsPage from './marketing/pages/ForRestaurantsPage'
import ForRetailPage from './marketing/pages/ForRetailPage'
import ResourcesPage from './marketing/pages/ResourcesPage'

const PAGES_BY_SEO_KEY = {
  home: LandingPage,
  product: ProductPage,
  forms: FormsPage,
  productRecords: RecordsPage,
  productReports: ReportsPage,
  salesTracking: SalesTrackingPage,
  expenseTracking: ExpenseTrackingPage,
  about: AboutPage,
  contact: ContactPage,
  privacy: PrivacyPage,
  terms: TermsPage,
  inventoryManagement: InventoryManagementPage,
  payroll: PayrollPage,
  forSmallBusinesses: ForSmallBusinessesPage,
  forRestaurants: ForRestaurantsPage,
  forRetail: ForRetailPage,
  resources: ResourcesPage,
}

export function renderPage(seoKey, path) {
  const Page = PAGES_BY_SEO_KEY[seoKey]
  if (!Page) throw new Error(`entry-server: no prerenderable page registered for seoKey "${seoKey}"`)
  return renderToStaticMarkup(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>
  )
}
