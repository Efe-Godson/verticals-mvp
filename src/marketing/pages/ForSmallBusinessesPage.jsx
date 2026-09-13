// /for-small-businesses - use-case page (brief section 5/42), grounded in
// the actual feature set (sales/expenses/inventory/payroll modules) rather
// than invented specifics.
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { SMALL_BUSINESS_FAQS as FAQS } from '../../seo/faqContent'

const TRACKABLE = [
  'Sales',
  'Expenses',
  'Inventory',
  'Staff payments',
]

export default function ForSmallBusinessesPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.forSmallBusinesses}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'For Small Businesses' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="For Small Businesses" />
          <p className="mkt-eyebrow">For small businesses</p>
          <h1 className="mkt-heading mkt-hero-heading">Run your business on organised records, not scattered spreadsheets.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Most small businesses already collect the information they need - it&apos;s just
            spread across notebooks, messages and spreadsheets no one has time to clean up.
            Verticals gives each part of the business its own simple form, and turns every
            submission into an organised record and a clear report.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What you can track</h2>
          <ul className="mkt-checklist">
            {TRACKABLE.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>One system, not four</h2>
          <p>
            Each of these is its own workflow - its own form, its own records, its own reports -
            but they all live in the same account and work the same way, so switching between
            tracking sales and tracking expenses doesn&apos;t mean switching tools.
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
              <Link to="/expense-tracking">Expense tracking</Link>
              <Link to="/inventory-management">Inventory management</Link>
              <Link to="/payroll">Payroll</Link>
              <Link to="/for-restaurants">For restaurants</Link>
              <Link to="/for-retail">For retail</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
