// /inventory-management - grounded in the real Inventory.jsx module
// (stock quantity, restock, low-stock threshold, stocktake reset).
import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import SEO from '../../seo/SEO'
import { seoPages } from '../../config/seo'
import { buildBreadcrumbList, buildFAQPage } from '../../seo/structuredData'
import { INVENTORY_FAQS as FAQS } from '../../seo/faqContent'

const CAPABILITIES = [
  'Stock quantity tracked per product',
  'Restock by adding to current stock',
  'Reset to an exact count after a stocktake',
  'Automatic low-stock warnings',
]

export default function InventoryManagementPage() {
  return (
    <div className="mkt">
      <SEO
        {...seoPages.inventoryManagement}
        structuredData={[
          buildBreadcrumbList([{ name: 'Home', path: '/' }, { name: 'Inventory Management' }]),
          buildFAQPage(FAQS),
        ]}
      />
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Inventory Management" />
          <p className="mkt-eyebrow">Inventory management</p>
          <h1 className="mkt-heading mkt-hero-heading">Know what's in stock without counting it yourself.</h1>
          <p className="mkt-subheading" style={{ maxWidth: 640 }}>
            Stock levels stay attached to the same products your sales are recorded against, so
            selling something and restocking it both update the same number.
          </p>
          <div className="mkt-hero-cta-row" style={{ marginTop: 'var(--mkt-sp-3)' }}>
            <Link to="/onboarding" className="mkt-btn mkt-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-prose">
          <h2>What you can do</h2>
          <ul className="mkt-checklist">
            {CAPABILITIES.map(item => (
              <li key={item}><Check size={18} strokeWidth={2.5} />{item}</li>
            ))}
          </ul>

          <h2>Stock and sales, in sync</h2>
          <p>
            Because inventory lives on the same product catalogue your sales use, stock counts
            don&apos;t drift out of sync with what&apos;s actually being sold.
          </p>
        </div>
      </section>

      <section className="mkt-section" id="faq">
        <div className="mkt-container">
          <div className="mkt-faq">
            <h2 className="mkt-heading" style={{ textAlign: 'left', marginBottom: 'var(--mkt-sp-3)' }}>Common questions</h2>
            {FAQS.map(({ q, a }) => (
              <details className="mkt-faq-item" key={q}>
                <summary>
                  {q}
                  <Plus size={18} className="mkt-faq-icon" aria-hidden="true" />
                </summary>
                <p className="mkt-faq-answer">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-related">
            <p className="mkt-related-title">Related</p>
            <div className="mkt-related-links">
              <Link to="/sales-tracking">Sales tracking</Link>
              <Link to="/for-retail">For retail</Link>
              <Link to="/product/reports">Explore reports</Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
