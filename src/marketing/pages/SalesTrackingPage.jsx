// /sales-tracking - a real, standalone explanatory page (not a keyword
// doorway page - see the SEO Implementation plan / brief section 42).
// Reuses the landing page's own chrome and CSS tokens rather than a new
// visual system.
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { SALES_TRACKING_FAQS as FAQS } from '../../seo/faqContent'

const TRACKABLE = [
  'Products or services sold',
  'Quantities and amounts',
  'Dates and times',
  'Categories and locations',
  'Payment method',
]

export default function SalesTrackingPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.salesTracking}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Sales Tracking' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Sales Tracking" />
          <p className="mkt-eyebrow">Sales tracking</p>
          <h1 className="mkt-heading mkt-hero-heading">Know what's selling without touching a spreadsheet.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Businesses collect sales every day, but the records alone don't say much on their
            own. Verticals is a web-based platform for collecting records, managing workflows
            and turning what you track into clear reports and insights - starting with sales.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What you can track</h2>
          <p>
            A sales form in Verticals can record whatever detail actually matters to your
            business - not a fixed set of fields you have to work around:
          </p>
          <ul className="mkt-checklist">
            {TRACKABLE.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>What Verticals does with it</h2>
          <p>
            Every sale submitted through your form becomes a structured record - organised,
            searchable and ready to report on immediately, instead of sitting in a notebook or
            a spreadsheet someone has to clean up later.
          </p>

          <h2>What you can understand from it</h2>
          <p>
            Reports turn those records into your top-selling products, sales trends over time,
            and performance comparisons across products or locations - the questions a business
            actually asks about its own sales data, answered automatically instead of worked out
            by hand.
          </p>
        </div>
      </section>

      <section className="mkt-section" id="faq">
        <div className="mkt-container">
          <div className="mkt-faq">
            <h2 className="mkt-heading" style={{ textAlign: 'left', marginBottom: 'var(--mkt-sp-3)' }}>Common questions</h2>
            {FAQS.map(({ q, a }) => (
              <details className="mkt-faq-item" key={q}>
                <summary>
                  {q}
                  <Plus size={18} className="mkt-faq-icon" aria-hidden="true" />
                </summary>
                <p className="mkt-faq-answer">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <p className="mkt-related-title">Related</p>
            <div className="mkt-related-links">
              <Link to="/expense-tracking">Explore expense tracking</Link>
              <Link to="/inventory-management">Explore inventory management</Link>
              <Link to="/product/reports">Explore reports</Link>
              <Link to="/demo">See a live sales report in the demo</Link>
              <Link to="/about">Learn what Verticals is</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
