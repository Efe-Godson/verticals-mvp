// /resources/:slug - full article view. Content, SEO and related articles
// all come from resource_articles via the public-content edge function
// (Lab -> Trust & Legal -> Resources is where these are written/published).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import SEO from '../../seo/SEO'
import { buildBreadcrumbList } from '../../seo/structuredData'
import { getResource } from '../../lib/legalContentClient'
import MarkdownContent from '../../lib/MarkdownContent'
import NotFound from '../../NotFound'
import { LoadingState } from '../../LoadingState'

export default function ResourceArticlePage() {
  const { slug } = useParams()
  const [state, setState] = useState(null) // null while loading, { article, related } once resolved (article may be null)

  useEffect(() => {
    let cancelled = false
    setState(null)
    getResource(slug)
      .then(result => { if (!cancelled) setState(result) })
      .catch(() => { if (!cancelled) setState({ article: null, related: [] }) })
    return () => { cancelled = true }
  }, [slug])

  if (state === null) return <LoadingState />
  if (!state.article) return <NotFound />

  const { article, related } = state

  return (
    <div className="mkt">
      <SEO
        title={article.seo_title || `${article.title} | Verticals`}
        description={article.seo_description || article.short_description}
        canonical={`/resources/${article.slug}`}
        type="article"
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Resources', path: '/resources' }, { name: article.title }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero mkt-article-hero">
          <nav className="mkt-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link to="/resources">Resources</Link>
            <span aria-hidden="true">/</span>
            <span className="mkt-breadcrumb-current">{article.category}</span>
          </nav>
          <h1 className="mkt-heading mkt-hero-heading">{article.title}</h1>
          {article.short_description && (
            <p className="mkt-subheading" style={{ maxWidth: 'var(--mkt-w-content)' }}>{article.short_description}</p>
          )}
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-article-body">
          <MarkdownContent content={article.published_content} />

          <div className="mkt-article-contact">
            <p className="mkt-related-title">Still have questions?</p>
            <p>Contact us at <a href="mailto:hello@verticalsapp.com">hello@verticalsapp.com</a></p>
          </div>

          {related.length > 0 && (
            <div className="mkt-related">
              <p className="mkt-related-title">Related articles</p>
              <div className="mkt-related-links">
                {related.map(r => (
                  <Link key={r.slug} to={`/resources/${r.slug}`}>{r.title}</Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
