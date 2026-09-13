// /product - the hub page tying Forms/Records/Reports together (brief
// section 4/42). Links out to each pillar's own standalone page rather than
// explaining all three in depth here.
import { FileText, Database, BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'

const PILLARS = [
  {
    icon: FileText,
    title: 'Forms',
    desc: 'Build a form around exactly what you need to record, and share it as a public link anyone can submit to.',
    to: '/forms',
    cta: 'Explore Forms',
  },
  {
    icon: Database,
    title: 'Records',
    desc: 'Every submission becomes a searchable, filterable, exportable record - organised automatically, no manual cleanup.',
    to: '/product/records',
    cta: 'Explore Records',
  },
  {
    icon: BarChart3,
    title: 'Reports',
    desc: 'Totals, trends and comparisons worked out from your records automatically, with charts, pivot tables and AI-assisted analysis.',
    to: '/product/reports',
    cta: 'Explore Reports',
  },
]

export default function ProductPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.product}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Product' }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Product" />
          <p className="mkt-eyebrow">Product overview</p>
          <h1 className="mkt-heading mkt-hero-heading">One connected system, from data you capture to decisions you can act on.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Verticals is a web-based platform that helps businesses and individuals collect
            records, manage workflows and turn their data into clear reports and insights.
            Forms, records and reports aren&apos;t separate tools bolted together - one
            submission flows straight through to an organised record and into your reports.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-trust-wrap" style={{ maxWidth: 'var(--mkt-w-content)' }}>
            <div className="mkt-trust-list">
              {PILLARS.map(({ icon: Icon, title, desc, to, cta }) => (
                <div className="mkt-trust-item" key={title}>
                  <p className="mkt-trust-title">
                    <span className="mkt-trust-icon"><Icon size={21} strokeWidth={2} /></span>
                    {title}
                  </p>
                  <p className="mkt-trust-desc">{desc}</p>
                  <div className="mkt-related-links" style={{ marginTop: 10 }}>
                    <Link to={to}>{cta}</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>Who uses it</h2>
          <p>
            Businesses use Verticals to track things like sales, expenses, inventory and staff
            payments, depending on their own workflow - a retail shop, a restaurant, or any
            small business collecting records it needs to make sense of. Individuals use it the
            same way for anything worth tracking and understanding over time.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <p className="mkt-related-title">Related</p>
            <div className="mkt-related-links">
              <Link to="/sales-tracking">Sales tracking</Link>
              <Link to="/expense-tracking">Expense tracking</Link>
              <Link to="/about">Learn what Verticals is</Link>
              <Link to="/onboarding">Try a free demo</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
