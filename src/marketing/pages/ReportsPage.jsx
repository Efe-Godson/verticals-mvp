// /product/reports - nested under /product for the same reason as
// RecordsPage.jsx (/reports is already the existing authenticated route).
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { REPORTS_FAQS as FAQS } from '../../seo/faqContent'

const CAPABILITIES = [
  'Totals, trends and comparisons across any date range',
  'Pivot tables, pie charts and bar charts',
  'Ask questions in plain language with AI-assisted analysis',
  'Export as PDF or PowerPoint, or print directly',
]

export default function ReportsPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.productReports}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Product', path: '/product' }, { name: 'Reports' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Reports" />
          <p className="mkt-eyebrow">Reports &amp; analytics</p>
          <h1 className="mkt-heading mkt-hero-heading">Turn your records into answers.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Reports are built from the records your forms have already collected - totals,
            trends and comparisons worked out automatically, so you don&apos;t need to know
            Excel or data analysis to understand your own numbers.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What you can do</h2>
          <ul className="mkt-checklist">
            {CAPABILITIES.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>What you can understand</h2>
          <p>
            Reports surface the patterns already sitting in your records - top products, busiest
            periods, spending trends, performance across locations or staff - without you
            calculating any of it by hand.
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
              <Link to="/product/records">Explore records</Link>
              <Link to="/product">Product overview</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
