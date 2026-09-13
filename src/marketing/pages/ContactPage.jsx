// /contact - the only verified contact address in the codebase is
// hello@verticalsapp.com (see MarketingFooter.jsx); not inventing a
// support@ inbox the brief only mentions as an example.
import { Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'

export default function ContactPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.contact}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Contact' }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Contact" />
          <p className="mkt-eyebrow">Contact</p>
          <h1 className="mkt-heading mkt-hero-heading">Get in touch.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 560 }}>
            Questions about Verticals, your account, or anything you're trying to track -
            reach out directly.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <a
            href="mailto:hello@verticalsapp.com"
            className="mkt-btn mkt-btn--secondary"
            style={{ width: 'fit-content' }}
          >
            <Mail size={18} strokeWidth={2} />
            hello@verticalsapp.com
          </a>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <p className="mkt-related-title">Related</p>
            <div className="mkt-related-links">
              <Link to="/about">Learn what Verticals is</Link>
              <Link to="/onboarding">Try a free demo</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
