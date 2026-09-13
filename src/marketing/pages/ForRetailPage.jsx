// /for-retail - grounded in the app's real retail-shop template behaviour
// (src/lib/templateFlags.js: downloadable Invoice, retail-specific to this
// template) rather than invented specifics.
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { RETAIL_FAQS as FAQS } from '../../seo/faqContent'

const CAPABILITIES = [
  'An order screen with products, quantities and payment method',
  'Downloadable invoices for each sale',
  'Inventory tracked alongside your sales',
  'Reports on your best and slowest-selling products',
]

export default function ForRetailPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.forRetail}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'For Retail' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="For Retail" />
          <p className="mkt-eyebrow">For retail</p>
          <h1 className="mkt-heading mkt-hero-heading">Built for retail, from order to invoice.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Record a sale with the products and quantities involved, and it becomes both a
            downloadable invoice for the customer and a record that feeds straight into your
            sales reports.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What's built in</h2>
          <ul className="mkt-checklist">
            {CAPABILITIES.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>From sale to insight</h2>
          <p>
            Every recorded sale rolls up into reports showing which products actually move,
            alongside the inventory and expense records that round out the full picture of the
            business.
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
              <Link to="/sales-tracking">Sales tracking</Link>
              <Link to="/for-restaurants">For restaurants</Link>
              <Link to="/for-small-businesses">For small businesses</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
