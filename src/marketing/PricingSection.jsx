import ScrollReveal from './ScrollReveal'

export default function PricingSection() {
  return (
    <section className="mkt-section" id="pricing">
      <div className="mkt-container">
        <div className="mkt-section-head">
          <h2 className="mkt-heading">Simple pricing.</h2>
          <p className="mkt-subheading" style={{ margin: '0 auto' }}>Start with the full Verticals experience.</p>
        </div>
        <ScrollReveal className="mkt-pricing-grid">
          <div className="mkt-pricing-card">
            <p className="mkt-pricing-name">Standard</p>
            <p className="mkt-pricing-desc">
              Workflows, records and reports, all included.
            </p>
          </div>
          <div className="mkt-pricing-card mkt-pricing-card--sponsored">
            <span className="mkt-pricing-badge">Sponsored</span>
            <p className="mkt-pricing-desc">
              Same experience, part of it covered for you.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
