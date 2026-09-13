// /resources - architecture-ready hub for the brief's resource/learning
// section (section 27), deliberately with no individual /resources/:slug
// articles yet rather than publishing placeholder content. Kept genuinely
// useful right now by pointing at the real feature pages that already exist
// instead of promising guides that don't exist yet - see buildArticle() in
// src/seo/structuredData.js, ready for whenever the first real article is
// written (with real, not fabricated, publish dates).
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'

const STARTING_POINTS = [
  { q: 'How do I track daily sales?', to: '/sales-tracking' },
  { q: 'How do I track business expenses?', to: '/expense-tracking' },
  { q: 'How do I build a form to collect records?', to: '/forms' },
  { q: 'How do I create a report from my records?', to: '/product/reports' },
]

export default function ResourcesPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.resources}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Resources' }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Resources" />
          <p className="mkt-eyebrow">Resources</p>
          <h1 className="mkt-heading mkt-hero-heading">Answers to how you'd actually use Verticals.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Longer guides are on the way. For now, here's where to start for the questions
            people ask most.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <ul className="mkt-checklist">
            {STARTING_POINTS.map(({ q, to }) => (
              <li key={q}>
                <Link to={to} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>{q}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
