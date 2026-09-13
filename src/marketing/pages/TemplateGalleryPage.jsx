// /template-gallery - grounded in the actual seeded templates (see
// supabase/migrations/*_template.sql), quoting their real name/eyebrow/
// description/highlights rather than inventing template copy. The set
// below (Retail, Restaurant, Expenses, Forms) is the current stable list -
// "Custom Form" was retired in favour of "Forms" (see
// 20260911090000_retire_custom_form_template.sql).
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { TEMPLATES_FAQS as FAQS } from '../../seo/faqContent'

const TEMPLATES = [
  {
    name: 'Retail',
    eyebrow: 'Set Up Shop',
    desc: 'Sell from a product catalogue and record who bought what - fill in the order, hit submit, no separate checkout step.',
    highlights: ['Product catalogue', 'One submit button, no embedded checkout', 'Customer details tucked into "More details"'],
    to: '/for-retail',
  },
  {
    name: 'Restaurant',
    eyebrow: 'Front of house',
    desc: 'Take dine-in, takeout, or delivery orders from a menu and record how the guest paid.',
    highlights: ['Menu with prices', 'Dine-in / takeout / delivery', 'Payment method on every order'],
    to: '/for-restaurants',
  },
  {
    name: 'Expenses',
    eyebrow: 'Track spending',
    desc: 'Record, understand and control where your money goes.',
    highlights: ['Record an expense in seconds - Amount + Category + Save', 'Everything else optional under "Add details"'],
    to: '/expense-tracking',
  },
  {
    name: 'Forms',
    eyebrow: 'Build Your Own',
    desc: 'Start from a blank form and add exactly the fields you need - no preset catalogue or workflow.',
    highlights: ['Blank canvas, add any fields', 'Share a link and collect responses', 'Records and reports included'],
    to: '/forms',
  },
]

export default function TemplateGalleryPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.templateGallery}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Templates' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Templates" />
          <p className="mkt-eyebrow">Templates</p>
          <h1 className="mkt-heading mkt-hero-heading">Start from a template, or build your own.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Each template comes with its fields and workflow already set up, so you can start
            recording right away - or start from a blank canvas if none of them fit.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--mkt-sp-4)' }}>
            {TEMPLATES.map(({ name, eyebrow, desc, highlights, to }) => (
              <div className="mkt-trust-item" key={name}>
                <p className="mkt-trust-title">{name}</p>
                <p className="mkt-eyebrow" style={{ margin: '0 0 6px' }}>{eyebrow}</p>
                <p className="mkt-trust-desc">{desc}</p>
                <ul className="mkt-checklist" style={{ marginTop: 10 }}>
                  {highlights.map(h => (
                    <li key={h}><Check size={16} strokeWidth={2.5} />{h}</li>
                  ))}
                </ul>
                <div className="mkt-related-links">
                  <Link to={to}>Learn more</Link>
                </div>
              </div>
            ))}
          </div>
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
              <Link to="/product">Product overview</Link>
              <Link to="/for-small-businesses">For small businesses</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
