import { Link } from 'react-router-dom'
import ScrollReveal from './ScrollReveal'

export default function DemoConversion() {
  return (
    <section className="mkt-section">
      <div className="mkt-container">
        <ScrollReveal className="mkt-demo-cta-card">
          <p className="mkt-eyebrow">See it for yourself</p>
          <h2 className="mkt-heading">Don&apos;t imagine how Verticals would work for you. See it.</h2>
          <p className="mkt-subheading" style={{ margin: '0 auto' }}>
            Tell us what you want to keep track of and we&apos;ll prepare a sample workspace with
            realistic records for you to explore.
          </p>
          <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Create my free demo</Link>
          <span className="mkt-hint">No account required &middot; No setup required</span>
        </ScrollReveal>
      </div>
    </section>
  )
}
