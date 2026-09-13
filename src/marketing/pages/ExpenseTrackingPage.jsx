// /expense-tracking - see SalesTrackingPage.jsx for the pattern this
// mirrors (brief section 5/42).
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { EXPENSE_TRACKING_FAQS as FAQS } from '../../seo/faqContent'

const TRACKABLE = [
  'Expense category',
  'Amount and date',
  'Payment method',
  'Vendor or purpose',
  'Recurring expenses',
]

export default function ExpenseTrackingPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.expenseTracking}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Expense Tracking' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Expense Tracking" />
          <p className="mkt-eyebrow">Expense tracking</p>
          <h1 className="mkt-heading mkt-hero-heading">See where your money is actually going.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Expenses are easy to lose track of when they're spread across receipts, messages and
            memory. Verticals collects them as structured records and turns them into reports
            that show spending trends instead of a pile of numbers.
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
            An expense form in Verticals records exactly the detail your business needs to
            review spending later:
          </p>
          <ul className="mkt-checklist">
            {TRACKABLE.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>What Verticals does with it</h2>
          <p>
            Every expense you record is organised by category, date and amount automatically -
            no manual spreadsheet upkeep, and nothing to reconcile at the end of the month
            before you can actually look at it.
          </p>

          <h2>What you can understand from it</h2>
          <p>
            Reports show your spending broken down by category and how it changes over time, so
            you can see where money is going and spot patterns worth acting on, whether that's a
            cost creeping up or a recurring expense worth reviewing.
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
              <Link to="/sales-tracking">Explore sales tracking</Link>
              <Link to="/payroll">Explore payroll</Link>
              <Link to="/product/reports">Explore reports</Link>
              <Link to="/demo">See a live expense report in the demo</Link>
              <Link to="/about">Learn what Verticals is</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
