// Place at: src/marketing/BridgeStatement.jsx
// A single centred sentence between the "what could you understand" bento
// and the connecting-canvas section - deliberate whitespace acting as
// punctuation in the page rather than another full section.
import ScrollReveal from './ScrollReveal'

export default function BridgeStatement() {
  return (
    <section className="mkt-section--compact">
      <div className="mkt-container">
        <ScrollReveal className="mkt-bridge">
          <h2 className="mkt-heading">Different things to track. The same idea.</h2>
          <p className="mkt-subheading">
            Keep the information that matters organised enough to actually use it.
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
