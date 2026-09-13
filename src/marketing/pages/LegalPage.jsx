// /trust, /security, /privacy, /terms, /cookies - one generic component,
// content read live from Lab -> Trust & Legal (src/lib/legalContentClient.js)
// instead of being hardcoded per page. Renders the neutral placeholder
// (brief section 2) until something's actually published for a slug - never
// invents legal/compliance content here.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'
import { getPage } from '../../lib/legalContentClient'
import MarkdownContent from '../../lib/MarkdownContent'

const PAGE_META = {
  trust: { title: 'Trust Center', eyebrow: 'Trust', seoKey: 'trust' },
  security: { title: 'Security', eyebrow: 'Trust', seoKey: 'security' },
  privacy: { title: 'Privacy Policy', eyebrow: 'Legal', seoKey: 'privacy' },
  terms: { title: 'Terms of Service', eyebrow: 'Legal', seoKey: 'terms' },
  cookies: { title: 'Cookie Policy', eyebrow: 'Legal', seoKey: 'cookies' },
}

const RELATED = [
  { slug: 'trust', to: '/trust', label: 'Trust Center' },
  { slug: 'security', to: '/security', label: 'Security' },
  { slug: 'privacy', to: '/privacy', label: 'Privacy Policy' },
  { slug: 'terms', to: '/terms', label: 'Terms of Service' },
  { slug: 'cookies', to: '/cookies', label: 'Cookie Policy' },
  { slug: 'subprocessors', to: '/subprocessors', label: 'Subprocessors' },
]

export default function LegalPage({ slug }) {
  const meta = PAGE_META[slug]
  const [page, setPage] = useState(null) // null while loading, {} object once resolved (possibly with page: null inside)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPage(null)
    setLoadError(false)
    getPage(slug)
      .then(result => { if (!cancelled) setPage(result.page || false) })
      .catch(() => { if (!cancelled) { setPage(false); setLoadError(true) } })
    return () => { cancelled = true }
  }, [slug])

  const seoTitle = page ? page.seo_title || seoPages[meta.seoKey]?.title : seoPages[meta.seoKey]?.title
  const seoDescription = page ? page.seo_description || seoPages[meta.seoKey]?.description : seoPages[meta.seoKey]?.description

  return (
    <div className="mkt">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={seoPages[meta.seoKey]?.canonical}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: meta.title }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current={meta.title} />
          <p className="mkt-eyebrow">{meta.eyebrow}</p>
          <h1 className="mkt-heading mkt-hero-heading">{meta.title}</h1>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          {page && page.published_content ? (
            <>
              {page.last_updated && (
                <p style={{ color: 'var(--color-muted)', fontSize: 'var(--mkt-fs-xs)', marginTop: 0 }}>
                  Last updated: {new Date(page.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
              <MarkdownContent content={page.published_content} />
            </>
          ) : page !== null ? (
            <>
              <p style={{ color: 'var(--color-muted)', fontSize: 'var(--mkt-fs-xs)', marginTop: 0 }}>Last updated: [DATE]</p>
              <p style={{ color: 'var(--color-muted)' }}>[{meta.title} content will appear here.]</p>
              {loadError && (
                <p style={{ color: 'var(--color-muted)', fontSize: 'var(--mkt-fs-2xs)' }}>
                  (Couldn't reach the content service - try reloading.)
                </p>
              )}
            </>
          ) : null}
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <p className="mkt-related-title">See also</p>
            <div className="mkt-related-links">
              {RELATED.filter(r => r.slug !== slug).map(r => (
                <Link key={r.slug} to={r.to}>{r.label}</Link>
              ))}
              <Link to="/contact">Contact Verticals</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
