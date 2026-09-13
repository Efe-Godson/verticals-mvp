// /privacy
// DRAFT - written to reflect what the app actually does today (Supabase-
// backed auth + storage, no data resale, export/delete on request), but
// this has NOT had a legal review. Treat as a starting point, not a
// finished policy, before relying on it in production.
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'

export default function PrivacyPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.privacy}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Privacy Policy' }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Privacy Policy" />
          <p className="mkt-eyebrow">Legal</p>
          <h1 className="mkt-heading mkt-hero-heading">Privacy Policy</h1>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What we collect</h2>
          <p>
            When you create a Verticals account, we collect the information needed to set it
            up and sign you in - your name, email address and, if you sign in with Google,
            the basic profile information Google provides for identity purposes. We don't
            request access to your Google Drive or Sheets unless you separately choose to
            connect an export feature that needs it.
          </p>
          <p>
            The forms, records and reports you create in Verticals - and the business or
            personal data you choose to enter into them - are stored so the product can work:
            to show you your own records, generate your reports, and keep your workspace
            available across sessions and devices.
          </p>

          <h2>How we use it</h2>
          <p>
            Your information is used to operate your account and the features you use -
            authentication, storing and displaying your records, generating reports, and
            responding if you contact us. We don't sell your data, and we don't share the
            records you create with other users or third parties except where you
            deliberately share something yourself (for example, sharing a report link, or
            publishing a form for others to fill in).
          </p>

          <h2>Where it's stored</h2>
          <p>
            Verticals is built on Supabase for authentication, database storage and file
            storage. Your data is stored and processed through that infrastructure as part of
            running the product.
          </p>

          <h2>Cookies and local storage</h2>
          <p>
            Verticals uses browser storage for things like keeping you signed in and
            remembering interface preferences (such as light/dark mode). This is functional
            storage needed for the app to work, not third-party advertising tracking.
          </p>

          <h2>Your rights</h2>
          <p>
            You can export your records and reports from within the app. You can request a
            copy of your account data, or request that your account and its data be deleted,
            by contacting us. We aim to handle GDPR and NDPA-relevant requests - access,
            export, correction and deletion - in that spirit.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy or your data can be sent to{' '}
            <a href="mailto:hello@verticalsapp.com">hello@verticalsapp.com</a>.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <div className="mkt-related-links">
              <Link to="/terms">Terms of Service</Link>
              <Link to="/contact">Contact Verticals</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
