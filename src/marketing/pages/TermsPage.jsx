// /terms
// DRAFT - same status as PrivacyPage.jsx: written to reflect the product as
// it actually works today, not legally reviewed yet.
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'

export default function TermsPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.terms}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Terms of Service' }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Terms of Service" />
          <p className="mkt-eyebrow">Legal</p>
          <h1 className="mkt-heading mkt-hero-heading">Terms of Service</h1>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>Using Verticals</h2>
          <p>
            Verticals is provided as a web-based platform for collecting records, managing
            workflows and generating reports. By creating an account or using the product, you
            agree to use it lawfully and not to misuse it - including attempting to access
            other users' data, disrupt the service, or use it to store or share unlawful
            content.
          </p>

          <h2>Your account and your data</h2>
          <p>
            You're responsible for the accuracy of the information you enter into Verticals
            and for keeping your account credentials secure. The records, forms and reports you
            create remain yours - Verticals stores and organises them so you can use the
            product, and doesn't claim ownership of your content.
          </p>

          <h2>Public forms</h2>
          <p>
            If you publish a form for others to submit responses to, you're responsible for
            what you collect through it and for how you use the responses. Publicly shared
            forms are accessible to anyone with the link; don't use them to collect information
            you aren't entitled to collect.
          </p>

          <h2>Availability</h2>
          <p>
            We aim to keep Verticals available and reliable, but the service is provided as-is,
            without guaranteeing it will be uninterrupted or error-free. We recommend exporting
            important records and reports periodically using the export tools built into the
            product.
          </p>

          <h2>Changes</h2>
          <p>
            These terms may be updated from time to time as the product changes. Continued use
            of Verticals after an update means you accept the current terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms can be sent to{' '}
            <a href="mailto:hello@verticalsapp.com">hello@verticalsapp.com</a>.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <div className="mkt-related-links">
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/contact">Contact Verticals</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
