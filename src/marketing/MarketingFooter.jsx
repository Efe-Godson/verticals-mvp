import { Link } from 'react-router-dom'

export default function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mkt-footer">
      <div className="mkt-container">
        <div className="mkt-footer-inner">
          <div className="mkt-footer-cta">
            <div className="mkt-hero-cta-row">
              <Link to="/onboarding" className="mkt-btn mkt-btn--lg mkt-hero-primary-cta">Try a free demo</Link>
            </div>
            <div className="mkt-hero-secondary-actions">
              <Link to="/signup" className="mkt-nav-signin">Sign up</Link>
              <Link to="/login" className="mkt-nav-signin">Sign in</Link>
            </div>
          </div>
        </div>
        {/* Plain, explicit statement of what the product does - so it's
            extractable as fact by search/AI systems rather than only
            implied by the hero copy above (see the SEO Implementation
            plan / brief section 25). */}
        <p className="mkt-footer-description">
          Verticals is a web-based platform for collecting records, managing workflows and
          generating reports. Businesses use it to track things like sales, expenses,
          inventory and staff payments, and individuals use it for anything else worth
          tracking and understanding over time.
        </p>
        <div className="mkt-footer-bottom">
          <div className="mkt-footer-col">
            &copy; {year} Verticals &middot; Contact: <a href="mailto:hello@verticalsapp.com">hello@verticalsapp.com</a>
          </div>
          <div className="mkt-footer-col">
            <Link to="/product">Product</Link> &middot; <Link to="/forms">Forms</Link>
          </div>
          <div className="mkt-footer-col">
            <Link to="/sales-tracking">Sales Tracking</Link> &middot; <Link to="/expense-tracking">Expense Tracking</Link> &middot; <Link to="/inventory-management">Inventory</Link> &middot; <Link to="/payroll">Payroll</Link>
          </div>
          <div className="mkt-footer-col">
            <Link to="/for-small-businesses">Small Businesses</Link> &middot; <Link to="/for-restaurants">Restaurants</Link> &middot; <Link to="/for-retail">Retail</Link>
          </div>
          <div className="mkt-footer-col">
            <Link to="/about">About</Link> &middot; <Link to="/resources">Resources</Link>
          </div>
          <div className="mkt-footer-col">
            <Link to="/contact">Contact</Link> &middot; <Link to="/privacy">Privacy</Link> &middot; <Link to="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
