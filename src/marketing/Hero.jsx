import { Link } from 'react-router-dom'
import HeroPreview from './HeroPreview'

export default function Hero() {
  return (
    <div className="mkt-container mkt-hero-grid">
      <div className="mkt-hero-text">
        <p className="mkt-hero-eyebrow">Capture&nbsp;&nbsp;&middot;&nbsp;&nbsp;Understand&nbsp;&nbsp;&middot;&nbsp;&nbsp;Act</p>
        <h1 className="mkt-heading mkt-hero-heading">Turn what you track into something useful.</h1>
        <p className="mkt-subheading">
          Create simple workflows, organise your records and understand what&apos;s happening
          through clear reports and insights.
        </p>
        <div className="mkt-hero-cta-row">
          <Link to="/onboarding" className="mkt-btn mkt-btn--lg mkt-hero-primary-cta">Try a free demo</Link>
        </div>
        <div className="mkt-hero-secondary-actions">
          <Link to="/signup" className="mkt-nav-signin">Sign up</Link>
          <Link to="/login" className="mkt-nav-signin">Sign in</Link>
        </div>
      </div>
      <HeroPreview />
    </div>
  )
}
