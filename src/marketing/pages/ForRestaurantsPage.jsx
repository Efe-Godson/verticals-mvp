// /for-restaurants - grounded in the app's real restaurant-order-pay
// template behaviour (src/lib/templateFlags.js: thermal-style receipt
// printing, staff-scoped order screens) rather than invented specifics.
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { RESTAURANT_FAQS as FAQS } from '../../seo/faqContent'

const CAPABILITIES = [
  'An order screen with products, quantities and payment method',
  'Receipt printing for each order',
  'Staff accounts scoped to just the order screen',
  'Sales, expenses and staff payments in the same account',
]

export default function ForRestaurantsPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.forRestaurants}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'For Restaurants' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="For Restaurants" />
          <p className="mkt-eyebrow">For restaurants</p>
          <h1 className="mkt-heading mkt-hero-heading">Built for how restaurants actually take orders.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            An order-taking form doubles as your sales records - every order becomes a record
            the moment it&apos;s submitted, with a receipt printed for the table and nothing
            left to re-enter later.
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

          <h2>Beyond the order screen</h2>
          <p>
            The same account that runs your order screen also tracks expenses and staff
            payments, and turns every order into reports on your best-selling items and sales
            performance over time.
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
              <Link to="/for-retail">For retail</Link>
              <Link to="/for-small-businesses">For small businesses</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
