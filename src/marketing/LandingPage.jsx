// Place at: src/marketing/LandingPage.jsx
// The public marketing site, mounted at "/" only for anonymous visitors
// (see App.jsx's RootRoute) - a signed-in visitor at "/" still gets
// BusinessesHome as before. One long page with in-page anchors for
// Product/Use Cases/Pricing/FAQ rather than separate routes.
//
// Sections are grouped into "chapters" (see marketing.css's Chapters block)
// so backgrounds read as a handful of continuous canvases the visitor
// scrolls through, rather than every section alternating its own stripe.
import './marketing.css'
import MarketingNav from './MarketingNav'
import Hero from './Hero'
import ProductWalkthrough from './ProductWalkthrough'
import OutcomeExamples from './OutcomeExamples'
import BridgeStatement from './BridgeStatement'
import ConnectingCanvas from './ConnectingCanvas'
import DemoConversion from './DemoConversion'
import TrustSection from './TrustSection'
import PricingSection from './PricingSection'
import FAQSection from './FAQSection'
import MarketingFooter from './MarketingFooter'

export default function LandingPage() {
  return (
    <div className="mkt">
      <MarketingNav />

      {/* Chapter I - Discover: the hero. */}
      <div className="mkt-chapter mkt-chapter--discover">
        <Hero />
      </div>

      {/* Chapter II - How it works: the alternating Capture/Organise/
          Understand product story. */}
      <div className="mkt-chapter mkt-chapter--how">
        <ProductWalkthrough />
      </div>

      {/* Chapter III - Understanding: bento results + the bridge statement,
          on a barely-there tinted surface. */}
      <div className="mkt-chapter mkt-chapter--understanding">
        <OutcomeExamples />
        <BridgeStatement />
      </div>

      {/* Chapter IV - Everything connects: the Form -> Records -> Report
          architecture diagram. */}
      <div className="mkt-chapter mkt-chapter--connects">
        <ConnectingCanvas />
      </div>

      {/* Chapter V - Conversion: the one bold accent-color visual break. The
          fade strip right after it eases into the Trust chapter's
          background, independent of how tall this chapter's content is. */}
      <div className="mkt-chapter mkt-chapter--conversion">
        <DemoConversion />
      </div>
      <div className="mkt-chapter-fade--conversion-trust" aria-hidden="true" />

      <div className="mkt-chapter mkt-chapter--trust">
        <TrustSection />
        <PricingSection />
      </div>

      <div className="mkt-chapter mkt-chapter--faq">
        <FAQSection />
      </div>

      <div className="mkt-chapter mkt-chapter--closing">
        <MarketingFooter />
      </div>
    </div>
  )
}
