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
        <div className="mkt-footer-bottom">
          <div className="mkt-footer-col">
            &copy; {year} Verticals &middot; Contact: <a href="mailto:hello@verticalsapp.com">hello@verticalsapp.com</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
