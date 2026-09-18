// Place at: src/BillingPage.jsx
// Route: /billing
// "Pricing & Usage" - a usage-analytics dashboard first, a pricing page
// second (see the approved plan). Subscription/usage rows are read
// directly via RLS (owner_id = auth.uid()) rather than through an edge
// function - only the mutating "activate a plan" action needs one
// (manage-billing), since that's the one place a price/limit gets written
// and must never be trusted from the client.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import { usePageTitle, usePageBack } from './PageTitleContext'
import PageSkeleton from './components/PageSkeleton'
import { useDeferredLoading } from './components/loadingHooks'
import { ErrorState } from './ErrorState'
import StatTile from './report/components/StatTile'
import HorizontalBarChart from './report/components/HorizontalBarChart'
import TrendLineChart from './report/components/TrendLineChart'
import { UsageGauge, UsageBar } from './components/UsageMeter'
import UsageDonutChart from './components/UsageDonutChart'
import CumulativeUsageChart from './components/CumulativeUsageChart'
import PricingCards from './components/PricingCards'
import ConfirmDialog from './ConfirmDialog'
import {
  fetchPlanCatalogue, groupCatalogueByPlan, PLAN_LABELS, BILLING_INTERVAL_LABELS, formatNaira,
} from './lib/pricingConfig'

const BILLING_INTERVALS = ['monthly', 'quarterly', 'half_year', 'yearly']

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(value) {
  if (!value) return null
  return Math.max(0, Math.ceil((new Date(value) - new Date()) / 86400000))
}

// Per spec section 7 - normal usage gets no message at all.
function usageStateBanner(percentage, remaining) {
  if (percentage >= 100) {
    return {
      tone: 'critical',
      title: "You've reached your monthly entry limit.",
      body: 'Upgrade your plan to continue creating new entries, or wait until your allowance resets.',
    }
  }
  if (percentage >= 90) {
    return {
      tone: 'warning',
      title: "You're close to your monthly entry limit.",
      body: `${remaining.toLocaleString()} entries remaining.`,
    }
  }
  if (percentage >= 70) {
    return { tone: 'info', title: "You're using more of your monthly allowance.", body: null }
  }
  return null
}

const BANNER_STYLE = {
  critical: { background: 'var(--color-warning-soft)', color: '#a8382a' },
  warning: { background: 'var(--color-warning-soft)', color: '#8a5a12' },
  info: { background: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
}

const STATUS_LABELS = {
  active: 'Active',
  expiring_soon: 'Renewing soon',
  grace_period: 'Grace period',
  restricted: 'Restricted',
  cancelled: 'Cancelled',
  past_due: 'Past due',
  expired: 'Expired',
}

export default function BillingPage() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  usePageTitle('Pricing & Usage')
  usePageBack('/', 'Home')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)
  const [catalogueRows, setCatalogueRows] = useState([])
  const [distribution, setDistribution] = useState([])
  const [workflowDist, setWorkflowDist] = useState([])
  const [timeseries, setTimeseries] = useState([])
  const [history, setHistory] = useState([])
  const [billingInterval, setBillingInterval] = useState('monthly')
  const [confirmPlan, setConfirmPlan] = useState(null) // { plan, interval } | null
  const [activatingPlan, setActivatingPlan] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving from the marketing /pricing page with a pre-selected plan
  // (?plan=&interval=) - open the same confirm dialog a card click would,
  // once the catalogue's loaded, then drop the params so a refresh doesn't
  // re-trigger it.
  useEffect(() => {
    if (loading) return
    const plan = searchParams.get('plan')
    const interval = searchParams.get('interval')
    if (plan && interval) {
      setConfirmPlan({ plan, interval })
      setSearchParams({}, { replace: true })
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      // get_or_create_subscription() rather than a plain select - a
      // brand-new account that hasn't created a single record yet has no
      // subscriptions row (it's provisioned lazily, same as
      // account_settings), so a plain .single() would fail here.
      const [{ data: sub, error: subErr }, cat] = await Promise.all([
        supabase.rpc('get_or_create_subscription'),
        fetchPlanCatalogue(),
      ])
      if (subErr) throw subErr
      setSubscription(sub)
      setCatalogueRows(cat)
      setBillingInterval(sub.billing_interval)

      const [{ data: usageRow }, { data: dist }, { data: wf }, { data: series }, { data: hist }] = await Promise.all([
        supabase.from('workspace_usage').select('*')
          .eq('owner_id', session.user.id).eq('usage_period_start', sub.usage_period_start).maybeSingle(),
        supabase.rpc('get_usage_distribution'),
        supabase.rpc('get_workflow_distribution'),
        supabase.rpc('get_usage_timeseries', { p_since: sub.usage_period_start, p_until: sub.usage_period_end }),
        supabase.rpc('get_usage_history', { p_periods: 6 }),
      ])
      setUsage(usageRow || { entries_used: 0, entry_limit: sub.entry_limit })
      setDistribution(dist || [])
      setWorkflowDist(wf || [])
      setTimeseries(series || [])
      setHistory(hist || [])
    } catch (err) {
      setError(err.message || 'Could not load your billing information.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectPlan(plan, interval) {
    setConfirmPlan({ plan, interval })
  }

  async function handleConfirmActivate() {
    if (!confirmPlan) return
    const { plan, interval } = confirmPlan
    setActivatingPlan(plan)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-billing', {
        body: { action: 'activate', plan, billing_interval: interval },
      })
      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)
      showToast(`You're now on ${PLAN_LABELS[plan]}.`, 'success')
      setConfirmPlan(null)
      await loadAll()
    } catch (err) {
      showToast('Could not update your plan: ' + err.message, 'error')
    } finally {
      setActivatingPlan(null)
    }
  }

  async function handleConfirmCancel() {
    setConfirmCancel(false)
    setActivatingPlan('free')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-billing', {
        body: { action: 'activate', plan: 'free', billing_interval: 'monthly' },
      })
      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)
      showToast('Your subscription will move to Free.', 'success')
      await loadAll()
    } catch (err) {
      showToast('Could not cancel: ' + err.message, 'error')
    } finally {
      setActivatingPlan(null)
    }
  }

  const showSkel = useDeferredLoading(loading)
  if (loading) return showSkel ? <PageSkeleton variant="report" /> : null
  if (error) return <ErrorState message={error} onRetry={loadAll} />

  const used = usage?.entries_used ?? 0
  const limit = subscription?.entry_limit ?? 100
  // Existing accounts get grandfathered onto a very high placeholder limit
  // when this system first ships (see the migration's backfill comment) so
  // nobody already using Verticals gets capped by surprise - shown as
  // "Unlimited" rather than the literal 9-digit number.
  const isUnlimited = limit >= 999999999
  const remaining = isUnlimited ? null : Math.max(0, limit - used)
  const percentage = isUnlimited ? 0 : (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0)
  const resetDays = daysUntil(subscription?.usage_period_end)
  const banner = isUnlimited ? null : usageStateBanner(percentage, remaining)

  const catalogueByPlan = groupCatalogueByPlan(catalogueRows)

  const donutData = distribution.map(d => ({ label: d.entry_type || 'other', count: Number(d.entries) }))
  const workflowBarData = workflowDist.map(d => ({ label: d.workflow || 'Uncategorized', count: Number(d.entries) }))
  const timeseriesPoints = timeseries.map(d => ({ date: new Date(d.day), value: Number(d.entries) }))
  const cumulativeDaily = timeseries.map(d => ({
    label: new Date(d.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    entries: Number(d.entries),
  }))
  const avgDaily = timeseries.length > 0 ? Math.round(used / timeseries.length) : 0
  const busiestDay = timeseries.reduce((best, d) => (Number(d.entries) > (best?.entries ?? -1) ? { day: d.day, entries: Number(d.entries) } : best), null)

  const hasPendingChange = !!subscription?.pending_plan

  return (
    <div className="page" style={{ maxWidth: '1080px' }}>
      <h1 style={{ marginBottom: '0.2rem' }}>Pricing &amp; Usage</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: 0, marginBottom: '1.4rem' }}>
        See what your business is recording, monitor your allowance and manage your subscription.
      </p>

      {/* 1. Subscription status / warnings */}
      {hasPendingChange && (
        <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
          Your {PLAN_LABELS[subscription.pending_plan]} plan will begin on {formatDate(subscription.current_period_end)}.
        </div>
      )}
      {subscription?.status === 'grace_period' && (
        <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem', background: 'var(--color-warning-soft)', color: '#8a5a12', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>GRACE PERIOD - {daysUntil(subscription.grace_period_ends_at) ?? 0} days remaining</div>
            <div style={{ fontSize: '0.85rem' }}>Renew before {formatDate(subscription.grace_period_ends_at)} to keep adding new entries.</div>
          </div>
          <button onClick={() => document.getElementById('choose-plan')?.scrollIntoView({ behavior: 'smooth' })}>Renew subscription</button>
        </div>
      )}
      {subscription?.status === 'restricted' && (
        <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem', background: 'var(--color-warning-soft)', color: '#a8382a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Your subscription needs to be renewed</div>
            <div style={{ fontSize: '0.85rem' }}>Your data is safe and remains available, but new entries are paused until you renew.</div>
          </div>
          <button onClick={() => document.getElementById('choose-plan')?.scrollIntoView({ behavior: 'smooth' })}>Renew subscription</button>
        </div>
      )}
      {banner && (
        <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem', ...BANNER_STYLE[banner.tone] }}>
          <div style={{ fontWeight: 700 }}>{banner.title}</div>
          {banner.body && <div style={{ fontSize: '0.88rem', marginTop: '0.2rem' }}>{banner.body}</div>}
        </div>
      )}

      {/* 2. Current usage overview - KPIs */}
      <div className="stat-tiles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.7rem', marginBottom: '1.2rem' }}>
        <StatTile label="Entries Used" value={used.toLocaleString()} />
        <StatTile label="Monthly Limit" value={isUnlimited ? 'Unlimited' : limit.toLocaleString()} />
        <StatTile label="Entries Left" value={isUnlimited ? 'Unlimited' : remaining.toLocaleString()} />
        <StatTile label="Days Until Reset" value={resetDays ?? '—'} />
      </div>

      {/* Gauge + meter, and current plan, side by side on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.6rem' }}>
        <div className="card" style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}>
          {isUnlimited ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{used.toLocaleString()}</div>
              <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>entries recorded · unlimited allowance</div>
            </div>
          ) : (
            <>
              <UsageGauge percentage={percentage} />
              <div style={{ width: '100%', maxWidth: '260px' }}>
                <UsageBar used={used} limit={limit} percentage={percentage} />
              </div>
            </>
          )}
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Resets {formatDate(subscription?.usage_period_end)}</div>
        </div>

        <div className="card" style={{ padding: '1.3rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
            Current Plan
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{PLAN_LABELS[subscription?.plan] || 'Free'}</div>
          <div style={{ color: 'var(--color-muted)', marginBottom: '0.6rem' }}>{isUnlimited ? 'Unlimited' : limit.toLocaleString()} entries / month</div>
          {subscription?.plan !== 'free' && (
            <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>
              {formatNaira(subscription.price_ngn)} {subscription.billing_interval === 'yearly' ? '/year' : subscription.billing_interval === 'monthly' ? '/month' : subscription.billing_interval === 'quarterly' ? 'every 3 months' : 'every 6 months'}
            </div>
          )}
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span>Status: {STATUS_LABELS[subscription?.status] || subscription?.status}</span>
            <span>{BILLING_INTERVAL_LABELS[subscription?.billing_interval] || 'Monthly'} billing</span>
          </div>
          <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid var(--color-border)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div><strong>Entry allowance resets</strong><br />{formatDate(subscription?.usage_period_end)}</div>
            {subscription?.plan !== 'free' && (
              <div style={{ marginTop: '0.3rem' }}><strong>Subscription renews</strong><br />{formatDate(subscription?.current_period_end)}</div>
            )}
          </div>
          {subscription?.plan !== 'free' && !hasPendingChange && (
            <button className="secondary" style={{ marginTop: '0.9rem', width: '100%', color: '#c0392b' }} onClick={() => setConfirmCancel(true)}>
              Cancel subscription
            </button>
          )}
        </div>
      </div>

      {/* 3. Usage analytics */}
      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.8rem' }}>Your Entry Usage</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '1.3rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>Entry Distribution</div>
          <UsageDonutChart data={donutData} centerValue={used.toLocaleString()} centerLabel="Total entries" />
        </div>
        <div className="card" style={{ padding: '1.3rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>Entries by Workflow</div>
          <HorizontalBarChart data={workflowBarData} bare controls={false} maxBars={8} />
        </div>
      </div>

      <div className="card" style={{ padding: '1.3rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>Entry Activity Over Time</div>
        <TrendLineChart points={timeseriesPoints} defaultGranularity="day" sourceLabel="Entries" />
      </div>

      <div className="card" style={{ padding: '1.3rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>Cumulative Usage This Period</div>
        <CumulativeUsageChart dailyCounts={cumulativeDaily} entryLimit={isUnlimited ? null : limit} />
      </div>

      <div className="stat-tiles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem', marginBottom: '1.6rem' }}>
        <StatTile label="Average Daily Entries" value={avgDaily.toLocaleString()} />
        <StatTile label="Highest Activity Day" value={busiestDay ? `${busiestDay.entries.toLocaleString()} entries` : '—'} />
        <StatTile label="Current Period" value={`${formatDate(subscription?.usage_period_start)} – ${formatDate(subscription?.usage_period_end)}`} />
      </div>

      {/* Usage history */}
      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.8rem' }}>Usage History</h2>
      <div className="card" style={{ padding: '1.3rem', marginBottom: '1.6rem', overflowX: 'auto' }}>
        {history.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>No previous usage periods yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Period</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Entries</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Limit</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Usage</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.usage_period_start}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>{formatDate(h.usage_period_start)}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{h.entries_used.toLocaleString()}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-muted)' }}>{h.entry_limit.toLocaleString()}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{Math.round((h.entries_used / h.entry_limit) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Entry explanation */}
      <div className="card" style={{ padding: '1.3rem', marginBottom: '1.6rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>What counts as an entry?</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: 0 }}>
          One entry is recorded whenever a new operational record is created - a sale, an expense, an inventory record, a payroll
          record or a form submission. Viewing, editing, exporting or reporting on existing records never counts, and your
          existing data always stays fully accessible.
        </p>
      </div>

      {/* Billing selector + plan cards */}
      <h2 id="choose-plan" style={{ fontSize: '1.05rem', marginBottom: '0.4rem' }}>Choose Your Plan</h2>
      <p style={{ color: 'var(--color-muted)', marginTop: 0, marginBottom: '1rem', fontSize: '0.88rem' }}>
        Pick the number of entries your business needs each month - all your workflows stay in one place.
      </p>
      <div style={{ display: 'inline-flex', gap: '2px', background: 'var(--color-bg)', borderRadius: '8px', padding: '3px', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {BILLING_INTERVALS.map(interval => (
          <button
            key={interval}
            type="button"
            onClick={() => setBillingInterval(interval)}
            className={billingInterval === interval ? undefined : 'secondary'}
            style={{ border: 'none', fontSize: '0.85rem', padding: '0.4rem 0.8rem', position: 'relative' }}
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

      <PricingCards
        catalogue={catalogueByPlan}
        billingInterval={billingInterval}
        currentPlan={subscription?.plan}
        mode="authenticated"
        onSelect={handleSelectPlan}
        onContactSales={() => navigate('/contact')}
        busyPlan={activatingPlan}
      />

      {confirmPlan && (
        <ConfirmDialog
          title={`Switch to ${PLAN_LABELS[confirmPlan.plan]}?`}
          message={
            confirmPlan.plan === 'free'
              ? `Your Free plan will begin on ${formatDate(subscription?.current_period_end)}. You'll keep your current allowance until then.`
              : `New allowance: ${(catalogueByPlan[confirmPlan.plan]?.[confirmPlan.interval]?.entry_limit ?? 0).toLocaleString()} entries/month for ${formatNaira(catalogueByPlan[confirmPlan.plan]?.[confirmPlan.interval]?.price_ngn)} ${BILLING_INTERVAL_LABELS[confirmPlan.interval].toLowerCase()}. Your current usage (${used.toLocaleString()} entries) carries over.`
          }
          confirmLabel="Confirm"
          onConfirm={handleConfirmActivate}
          onCancel={() => setConfirmPlan(null)}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel subscription?"
          message={`Your subscription remains active until ${formatDate(subscription?.current_period_end)}. After that, your workspace moves to Free (100 entries/month) unless you choose another plan first.`}
          confirmLabel="Cancel subscription"
          danger
          onConfirm={handleConfirmCancel}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  )
}
