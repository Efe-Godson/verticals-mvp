// /product/records - path nested under /product rather than the bare
// "/records" the brief suggests, since /records is already the existing
// authenticated records dashboard (see App.jsx) - see the SEO
// Implementation follow-up notes for the naming rationale.
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { RECORDS_FAQS as FAQS } from '../../seo/faqContent'

const CAPABILITIES = [
  'Search across every submission',
  'Filter and sort by any field',
  'Export as PDF, Excel or CSV',
  'Every submission organised automatically',
]

export default function RecordsPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.productRecords}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Product', path: '/product' }, { name: 'Records' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Records" />
          <p className="mkt-eyebrow">Records</p>
          <h1 className="mkt-heading mkt-hero-heading">Every submission, organised automatically.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            No more digging through scattered files or spreadsheets someone has to clean up
            later - every form submission becomes a structured record the moment it arrives.
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

          <h2>Where records come from</h2>
          <p>
            Records are generated from your forms - whether you fill them in yourself or share
            a public link for others to submit to. Either way, every submission lands in the
            same organised, reviewable list.
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
              <Link to="/forms">Explore forms</Link>
              <Link to="/product/reports">Explore reports</Link>
              <Link to="/product">Product overview</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
