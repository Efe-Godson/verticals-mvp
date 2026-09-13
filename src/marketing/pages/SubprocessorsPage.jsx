// /subprocessors - optional Markdown intro (from legal_pages, slug
// 'subprocessors') plus a table of active providers (from the
// `subprocessors` table). Both managed from Lab -> Trust & Legal.
import { useEffect, useState } from 'react'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList } from '../../seo/structuredData'
import { getSubprocessors } from '../../lib/legalContentClient'
import MarkdownContent from '../../lib/MarkdownContent'

export default function SubprocessorsPage() {
  const [data, setData] = useState(null) // null while loading, else { intro, providers }

  useEffect(() => {
    let cancelled = false
    getSubprocessors()
      .then(result => { if (!cancelled) setData(result) })
      .catch(() => { if (!cancelled) setData({ intro: null, providers: [] }) })
    return () => { cancelled = true }
  }, [])

  const intro = data?.intro
  const providers = data?.providers || []

  return (
    <div className="mkt">
      <SEO
        title={intro?.seo_title || seoPages.subprocessors?.title}
        description={intro?.seo_description || seoPages.subprocessors?.description}
        canonical={seoPages.subprocessors?.canonical}
        structuredData={buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Subprocessors' }])}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Subprocessors" />
          <p className="mkt-eyebrow">Trust</p>
          <h1 className="mkt-heading mkt-hero-heading">Subprocessors</h1>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          {intro?.published_content ? (
            <MarkdownContent content={intro.published_content} />
          ) : data !== null ? (
            <p style={{ color: 'var(--color-muted)' }}>[Subprocessors introduction will appear here.]</p>
          ) : null}
        </div>
      </section>

      {data !== null && (
        <section className="mkt-section mkt-section--compact">
          <div className="mkt-container">
            {providers.length === 0 ? (
              <p style={{ color: 'var(--color-muted)' }}>No subprocessors listed yet.</p>
            ) : (
              <div className="mkt-table-wrap">
                <table className="mkt-subprocessors-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Purpose</th>
                      <th>Data involved</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map(p => (
                      <tr key={p.id}>
                        <td>{p.provider_name}</td>
                        <td>{p.purpose}</td>
                        <td>{p.data_involved}</td>
                        <td>
                          {p.link ? (
                            <a href={p.link} target="_blank" rel="noopener noreferrer">Website</a>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <MarketingFooter />
    </div>
  )
}
