// /payroll - grounded in the real payroll module
// (src/payroll/calculatePayroll.js: DEDUCTION_TYPES, ADDITION_TYPES, and
// the salary + additions - deductions calculation it actually runs).
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { PAYROLL_FAQS as FAQS } from '../../seo/faqContent'

const CAPABILITIES = [
  'Monthly salary per staff member',
  'Additions - bonus, allowance, reimbursement, commission, extra day',
  'Deductions - fine, missed day, salary advance, loan repayment, damage',
  'Final payment calculated automatically',
]

export default function PayrollPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.payroll}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Payroll' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Payroll" />
          <p className="mkt-eyebrow">Payroll</p>
          <h1 className="mkt-heading mkt-hero-heading">Staff payments, worked out for you.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Record a base salary once, then log the bonuses, advances, fines and other
            adjustments as they happen - Verticals works out each final payment automatically.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What you can record</h2>
          <ul className="mkt-checklist">
            {CAPABILITIES.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>How the final amount is worked out</h2>
          <p>
            Final payment = monthly salary + total additions - total deductions. Every bonus,
            advance, fine or other entry recorded for a staff member during the month feeds
            straight into that calculation - nothing to total up by hand.
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
              <Link to="/for-small-businesses">For small businesses</Link>
              <Link to="/for-restaurants">For restaurants</Link>
              <Link to="/expense-tracking">Explore expense tracking</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
