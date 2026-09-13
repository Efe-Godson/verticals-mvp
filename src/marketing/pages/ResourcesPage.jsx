// /resources - keeps the original "quick answers" block (genuinely useful,
// zero fabrication risk - points at real feature pages) and adds a
// DB-driven article grid below it, populated from Lab -> Trust & Legal ->
// Resources. Falls back to an empty state rather than placeholder content
// when nothing's published yet.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'
import { listResources } from '../../lib/legalContentClient'

const STARTING_POINTS = [
  { q: 'How do I track daily sales?', to: '/sales-tracking' },
  { q: 'How do I track business expenses?', to: '/expense-tracking' },
  { q: 'How do I build a form to collect records?', to: '/forms' },
  { q: 'How do I create a report from my records?', to: '/product/reports' },
]

const CATEGORIES = ['All', 'Privacy', 'Security', 'Data', 'AI', 'Guides', 'Product', 'Business']

export default function ResourcesPage() {
  const [articles, setArticles] = useState(null) // null while loading
  const [category, setCategory] = useState('All')

  useEffect(() => {
    let cancelled = false
    listResources()
      .then(result => { if (!cancelled) setArticles(result.articles || []) })
      .catch(() => { if (!cancelled) setArticles([]) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!articles) return []
    return category === 'All' ? articles : articles.filter(a => a.category === category)
  }, [articles, category])

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
            Guides on privacy, security, data and getting the most out of the product.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-section--compact">
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

      <section className="mkt-section">
        <div className="mkt-container">
          {articles && articles.length > 0 && (
            <div className="mkt-resource-filters">
              {CATEGORIES.map(c => (
                <button
                  key={c} type="button"
                  className={`mkt-resource-filter${category === c ? ' is-active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {articles === null ? null : articles.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No articles published yet - check back soon.</p>
          ) : (
            <div className="mkt-resource-grid">
              {filtered.map(a => (
                <Link key={a.slug} to={`/resources/${a.slug}`} className="mkt-resource-card">
                  <span className="mkt-resource-card-category">{a.category}</span>
                  <h3 className="mkt-resource-card-title">{a.title}</h3>
                  {a.short_description && <p className="mkt-resource-card-desc">{a.short_description}</p>}
                  <span className="mkt-resource-card-cta">Read article &rarr;</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
