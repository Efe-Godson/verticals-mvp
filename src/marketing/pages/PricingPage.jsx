// Place at: src/marketing/pages/PricingPage.jsx
// Route: /pricing - public, unauthenticated. Reuses the same PricingCards
// grid the authenticated Pricing & Usage page uses (src/BillingPage.jsx),
// so the two can never visually drift apart, and the same plan_catalogue
// table both pages read from - never a second hardcoded price list.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../marketing.css'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import PageBreadcrumb from './PageBreadcrumb'
import { useAuth } from '../../AuthContext'
import PricingCards from '../../components/PricingCards'
import { fetchPlanCatalogue, groupCatalogueByPlan, BILLING_INTERVAL_LABELS } from '../../lib/pricingConfig'

const BILLING_INTERVALS = ['monthly', 'quarterly', 'half_year', 'yearly']

const COMPARISON_ROWS = [
  { label: 'Monthly entries', values: ['100', '500', '2,000', '5,000'] },
  { label: 'Multiple workflows', values: ['✓', '✓', '✓', '✓'] },
  { label: 'Forms & records', values: ['✓', '✓', '✓', '✓'] },
  { label: 'Reports', values: ['✓', '✓', '✓', '✓'] },
  { label: 'Exports', values: ['✓', '✓', '✓', '✓'] },
  { label: 'Shared access', values: ['✓', '✓', '✓', '✓'] },
]

export default function PricingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [catalogueRows, setCatalogueRows] = useState([])
  const [billingInterval, setBillingInterval] = useState('monthly')

  useEffect(() => {
    fetchPlanCatalogue().then(setCatalogueRows).catch(() => {})
  }, [])

  function handleSelect(plan, interval) {
    if (session) {
      navigate(`/billing?plan=${plan}&interval=${interval}`)
    } else {
      navigate('/signup')
    }
  }

  const catalogueByPlan = groupCatalogueByPlan(catalogueRows)

  return (
    <div className="mkt">
      <MarketingNav />

      <section className="mkt-section mkt-section--major">
        <div className="mkt-container mkt-page-hero">
          <PageBreadcrumb current="Pricing" />
          <p className="mkt-eyebrow">Pricing</p>
          <h1 className="mkt-heading mkt-hero-heading">Simple pricing based on what you record.</h1>
          <p className="mkt-subheading">
            Choose the number of entries your business needs each month. All your workflows stay in one place.
          </p>
          <p className="mkt-subheading" style={{ fontSize: '0.9rem' }}>100 entries free every month.</p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.6rem' }}>
            <div style={{ display: 'inline-flex', gap: '2px', background: 'var(--color-bg)', borderRadius: '8px', padding: '3px', flexWrap: 'wrap' }}>
              {BILLING_INTERVALS.map(interval => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setBillingInterval(interval)}
                  className={billingInterval === interval ? undefined : 'secondary'}
                  style={{ border: 'none', fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
                >
                  {BILLING_INTERVAL_LABELS[interval]}
                  {interval === 'yearly' && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: billingInterval === interval ? 'white' : 'var(--color-primary)' }}>
                      Save 20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <PricingCards
            catalogue={catalogueByPlan}
            billingInterval={billingInterval}
            mode="marketing"
            onSelect={handleSelect}
            onContactSales={() => navigate('/contact')}
          />
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container" style={{ maxWidth: 'var(--mkt-w-content)', margin: '0 auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem' }}></th>
                <th style={{ textAlign: 'center', padding: '0.6rem' }}>Free</th>
                <th style={{ textAlign: 'center', padding: '0.6rem' }}>Starter</th>
                <th style={{ textAlign: 'center', padding: '0.6rem' }}>Business</th>
                <th style={{ textAlign: 'center', padding: '0.6rem' }}>Growth</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(row => (
                <tr key={row.label} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600 }}>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} style={{ padding: '0.6rem', textAlign: 'center', color: v === '✓' ? 'var(--color-primary)' : 'var(--color-text)' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.82rem', marginTop: '1rem', textAlign: 'center' }}>
            The only reason to upgrade is capacity - every plan gets the same Verticals, no feature gates.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
