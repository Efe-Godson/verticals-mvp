import { Link } from 'react-router-dom'

export default function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mkt-footer">
      <div className="mkt-container">
        <div className="mkt-footer-inner">
          <div className="mkt-hero-cta-row mkt-footer-cta">
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
            <Link to="/signup" className="mkt-btn mkt-btn--secondary">Sign up</Link>
            <Link to="/login" className="mkt-nav-signin">Sign in</Link>
          </div>
        </div>
        <div className="mkt-footer-bottom">
          <div>&copy; {year} Verticals</div>
          <div>Contact: <a href="mailto:hello@verticalsapp.com">hello@verticalsapp.com</a></div>
        </div>
      </div>
    </footer>
  )
}
