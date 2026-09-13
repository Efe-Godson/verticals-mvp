// Catch-all for any unmatched route (brief section 33) - there was none
// before this, so a bad URL previously rendered a blank page. Kept
// intentionally simple: explain the page wasn't found, link back to
// somewhere useful, and stay out of search results.
import { Link } from 'react-router-dom'
import './marketing/marketing.css'
import SEO from './seo/SEO'
import { seoPages } from './config/seo'

export default function NotFound() {
  return (
    <div className="mkt">
      <SEO {...seoPages.notFound} />
      <section className="mkt-section mkt-section--major">
        <div className="mkt-container" style={{ textAlign: 'center' }}>
          <p className="mkt-eyebrow">404</p>
          <h1 className="mkt-heading">This page doesn't exist.</h1>
          <p className="mkt-subheading" style={{ margin: '0 auto var(--mkt-sp-4)' }}>
            The link might be out of date, or the page may have moved.
          </p>
          <div className="mkt-hero-cta-row" style={{ justifyContent: 'center' }}>
            <Link to="/" className="mkt-btn">Go to Verticals</Link>
            <Link to="/demo" className="mkt-btn mkt-btn--secondary">Try the demo</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
