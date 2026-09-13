// /about - factual only. Deliberately excludes any founding-date, team or
// customer-count claims that aren't verifiable from the codebase (brief
// section 29 explicitly forbids fabricated trust signals).
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'

export default function AboutPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.about}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'About' }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="About" />
          <p className="mkt-eyebrow">About Verticals</p>
          <h1 className="mkt-heading mkt-hero-heading">Capture. Understand. Act.</h1>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What Verticals is</h2>
          <p>
            Verticals is a web-based platform that helps businesses and individuals collect
            records, manage workflows and turn their data into clear reports and insights.
            Instead of scattering information across spreadsheets, notebooks and messages, you
            build a simple form around what you need to track, and Verticals organises every
            submission into structured records you can actually use.
          </p>

          <h2>Who it's for</h2>
          <p>
            Businesses use Verticals to track things like sales, expenses, inventory and staff
            payments, depending on their own workflow - a retail shop, a restaurant, or any
            small business collecting records it needs to make sense of. Individuals use it the
            same way for anything worth tracking and understanding over time.
          </p>

          <h2>How it works</h2>
          <p>
            <strong>Capture</strong> - build a form for whatever you need to record, and collect
            submissions from wherever you work.
          </p>
          <p>
            <strong>Understand</strong> - every submission becomes an organised record, ready to
            search, filter and review without manual cleanup.
          </p>
          <p>
            <strong>Act</strong> - reports turn those records into totals, trends and
            comparisons, so the patterns in your own data are visible instead of hidden across
            individual entries.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <p className="mkt-related-title">Related</p>
            <div className="mkt-related-links">
              <Link to="/product">Product overview</Link>
              <Link to="/sales-tracking">Explore sales tracking</Link>
              <Link to="/expense-tracking">Explore expense tracking</Link>
              <Link to="/contact">Contact Verticals</Link>
              <Link to="/onboarding">Try a free demo</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
