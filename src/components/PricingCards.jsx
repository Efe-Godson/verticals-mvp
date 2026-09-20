// Place at: src/components/PricingCards.jsx
// Shared plan-card grid for both the public marketing Pricing page
// (src/marketing/pages/PricingPage.jsx) and the authenticated Pricing &
// Usage page (src/BillingPage.jsx) - one rendering of a plan_catalogue row,
// so the two pages can never drift out of visual sync with each other.
import { PLAN_ORDER, PLAN_LABELS, formatNaira, perMonthEquivalent, yearlySaving } from '../lib/pricingConfig'

const INTERVAL_UNIT = { monthly: '/month', quarterly: 'every 3 months', half_year: 'every 6 months', yearly: '/year' }

function PlanCard({ plan, catalogueForPlan, billingInterval, isCurrent, mode, onSelect, onContactSales, busy }) {
  const row = catalogueForPlan?.[billingInterval]
  const isFree = plan === 'free'
  const isEnterprise = plan === 'enterprise'
  const isMostPopular = plan === 'business'
  const saving = billingInterval === 'yearly' ? yearlySaving(catalogueForPlan) : null
  const perMonth = !isFree && !isEnterprise ? perMonthEquivalent(row) : null

  const ctaLabel = isEnterprise ? 'Contact Sales'
    : isCurrent ? 'Current plan'
    : busy ? 'Updating…'
    : isFree ? (mode === 'authenticated' ? 'Downgrade to Free' : 'Start free')
    : `${mode === 'authenticated' ? 'Switch to' : 'Choose'} ${PLAN_LABELS[plan]}`

  return (
    <div
      className="card"
      style={{
        padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative',
        border: isMostPopular ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        height: '100%', boxSizing: 'border-box',
      }}
    >
      {isMostPopular && (
        <span style={{
          position: 'absolute', top: '-0.7rem', left: '1.2rem', fontSize: '0.7rem', fontWeight: 700,
          padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'var(--color-primary)', color: 'white',
          textTransform: 'uppercase', letterSpacing: '0.03em',
        }}>
          Most Popular
        </span>
      )}
      <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-muted)', marginTop: isMostPopular ? '0.4rem' : 0 }}>
        {PLAN_LABELS[plan]}
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1.1 }}>
        {isEnterprise ? 'Custom' : (row?.entry_limit ?? '—').toLocaleString?.() ?? row?.entry_limit}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '-0.3rem' }}>
        {isEnterprise ? 'usage capacity' : 'entries / month'}
      </div>

      <div style={{ marginTop: '0.5rem', minHeight: '3.2rem' }}>
        {isEnterprise ? (
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Custom pricing</div>
        ) : isFree ? (
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>₦0</div>
        ) : (
          <>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {formatNaira(row?.price_ngn)}{' '}
              <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 400 }}>{INTERVAL_UNIT[billingInterval]}</span>
            </div>
            {billingInterval !== 'monthly' && perMonth != null && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Equivalent to {formatNaira(perMonth)}/month</div>
            )}
            {billingInterval === 'yearly' && saving > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 600 }}>Save {formatNaira(saving)}/year</div>
            )}
          </>
        )}
      </div>

      {/* marginTop: 'auto' - not a fixed gap - pins every card's button to the
          same bottom edge regardless of how tall its own content block above
          happens to be (Enterprise's "Custom pricing" vs. a priced plan's
          extra "Equivalent to.../Save..." lines), so the CTA row reads as one
          consistent strip across the whole grid. */}
      <button
        className={isCurrent ? 'secondary' : undefined}
        disabled={isCurrent || busy}
        onClick={() => isEnterprise ? onContactSales?.() : onSelect?.(plan, billingInterval)}
        style={{ marginTop: 'auto', width: '100%' }}
      >
        {ctaLabel}
      </button>
    </div>
  )
}

// mode: 'marketing' (public, no current-plan state) | 'authenticated'
// (highlights the current plan and disables its own button).
export default function PricingCards({ catalogue, billingInterval, currentPlan, mode = 'marketing', onSelect, onContactSales, busyPlan }) {
  return (
    <div
      className="pricing-cards-grid"
      // --pricing-plan-count drives the desktop one-row layout below - reads
      // straight off PLAN_ORDER.length so adding/removing a plan (as just
      // happened with Scale) never needs a matching CSS edit.
      style={{ '--pricing-plan-count': PLAN_ORDER.length }}
    >
      <style>{`
        .pricing-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; align-items: stretch; }
        @media (min-width: 900px) {
          .pricing-cards-grid { grid-template-columns: repeat(var(--pricing-plan-count), minmax(0, 1fr)); }
        }
      `}</style>
      {PLAN_ORDER.map(plan => (
        <PlanCard
          key={plan}
          plan={plan}
          catalogueForPlan={catalogue[plan]}
          billingInterval={billingInterval}
          isCurrent={mode === 'authenticated' && currentPlan === plan}
          mode={mode}
          onSelect={onSelect}
          onContactSales={onContactSales}
          busy={busyPlan === plan}
        />
      ))}
    </div>
  )
}
