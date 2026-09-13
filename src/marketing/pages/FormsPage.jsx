// /forms - see SalesTrackingPage.jsx for the pattern this mirrors.
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { FORMS_FAQS as FAQS } from '../../seo/faqContent'

const BUILDABLE = [
  'Custom fields - text, numbers, dates and more',
  'Product/quantity fields for order-style forms',
  'Location fields',
  'Sections, or one-question-per-screen pages',
  'A public link anyone can submit to',
]

export default function FormsPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.forms}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Forms' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Forms" />
          <p className="mkt-eyebrow">Forms &amp; workflows</p>
          <h1 className="mkt-heading mkt-hero-heading">Build a form around exactly what you need to record.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            A Verticals form is the starting point of every workflow - collect what matters to
            your business, share it as a link, and every submission becomes an organised record
            automatically.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What you can build</h2>
          <ul className="mkt-checklist">
            {BUILDABLE.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>How people fill it in</h2>
          <p>
            Published forms get a public link - no Verticals account required to submit.
            They&apos;re built to work as well from a phone as from a desktop, since most
            day-to-day submissions happen on the go.
          </p>

          <h2>Where it goes</h2>
          <p>
            Every submission becomes a structured, searchable record the moment it's sent -
            ready to review, filter and report on without any manual cleanup.
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
              <Link to="/product/records">Explore records</Link>
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
