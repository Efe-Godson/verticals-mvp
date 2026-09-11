// Place at: src/onboarding/IntentDestination.jsx
// Merges Phase 1's PublicDemo.jsx and RealTemplatePreview.jsx into one
// component branching on `route.destination` (from demo_routes) instead of
// on which file was hardcoded per intent - same reuse underneath, now
// driven by admin config instead of a static per-intent fork:
//   'records' / 'report' -> real, read-only data (Records/Report by formId
//     prop, same reuse src/lab/demo/DemoExperience.jsx relied on) from the
//     route's connected demo dataset. 'report' also shows a small stats
//     tile above it (Today's sales/orders, top-selling items).
//   'form' -> a non-submitting preview of the template's own field shape
//     (FormPreviewModal) - a form can't actually be created pre-signup
//     (forms' insert policy needs auth.uid()), so this previews the shape;
//     the real workspace is created post-signup, see completeOnboardingEntry.js.
//   'dashboard' / 'payroll' -> not wired to a real view yet (Expenses/
//     Payroll are route-param + Outlet-context "shells", not simple
//     formId-prop components - see the plan this was built from), so this
//     shows the same honest "ready to configure" message a field-less
//     template (Payroll) already falls back to under 'form'.
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Report from '../Report'
import Records from '../Records'
import FormPreviewModal from '../FormPreview'
import { InlineLoader } from '../components/InlineLoader'
import { ErrorState } from '../ErrorState'

function computeReportStats(form, submissions) {
  const cartField = form.fields.find(f => f.type === 'cart')
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let todaySales = 0
  let todayOrders = 0
  const itemCounts = {}

  submissions.forEach(sub => {
    const cartData = cartField ? sub.data[cartField.id] : null
    if (!cartData) return
    if (new Date(sub.created_at) >= todayStart) {
      todayOrders += 1
      todaySales += (cartData.total || 0) + (Number(cartData.deliveryFee) || 0)
    }
    ;(cartData.items || []).forEach(item => { itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity })
  })

  const topSelling = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name)
  return { todaySales, todayOrders, topSelling }
}

// Fixed above everything (Report/Records' own modals included) so "keep a
// clear CTA available" per the design brief holds regardless of what's
// rendered below - FormPreviewModal's overlay is z-index 200, this sits above it.
function CreateWorkspaceBar({ ctaText, onClick }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 250,
      padding: '0.8rem 1rem calc(0.8rem + env(safe-area-inset-bottom))',
      background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
    }}>
      <button type="button" onClick={onClick} style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', padding: '0.85rem', fontSize: '1rem', fontWeight: 600 }}>
        {ctaText} →
      </button>
    </div>
  )
}

function NotYetAvailableCard({ name, description }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem 6rem' }}>
      <div className="card" style={{ maxWidth: 420, padding: '1.6rem', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 0.5rem' }}>{name}</h2>
        <p style={{ color: 'var(--color-muted)', margin: 0 }}>
          {description || "This one's a dedicated workspace, ready to configure as soon as you sign up."}
        </p>
      </div>
    </div>
  )
}

export default function IntentDestination({ route, customIntentText, onCreateWorkspace }) {
  const [state, setState] = useState({ status: 'loading' })
  const ctaText = route?.cta_text || 'Create your workspace'

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!route) {
        setState({ status: 'error', message: "This option isn't available right now." })
        return
      }

      if (route.destination === 'records' || route.destination === 'report') {
        const formId = route.demo_datasets?.form_id
        if (!formId) {
          setState({ status: 'error', message: "This demo isn't connected to any data yet - you can still create your own workspace." })
          return
        }
        const { data: form, error } = await supabase.from('forms').select('*').eq('id', formId).maybeSingle()
        if (cancelled) return
        if (error || !form) {
          setState({ status: 'error', message: "The demo isn't available right now - you can still create your own workspace." })
          return
        }
        if (route.destination === 'report') {
          const { data: submissions } = await supabase
            .from('submissions').select('data, created_at').eq('form_id', form.id).is('deleted_at', null)
          if (cancelled) return
          setState({ status: 'ready', view: 'report', form, stats: computeReportStats(form, submissions || []) })
        } else {
          setState({ status: 'ready', view: 'records', form })
        }
        return
      }

      // 'form' (and the not-yet-wired 'dashboard'/'payroll', which fall
      // through to the same field-shape preview or its empty-fields fallback).
      if (!route.template_slug) {
        setState({ status: 'ready', view: 'unavailable', name: 'Coming soon' })
        return
      }
      const { data: template, error } = await supabase.from('templates').select('*').eq('slug', route.template_slug).single()
      if (cancelled) return
      if (error || !template) {
        setState({ status: 'error', message: 'Could not load this template right now.' })
        return
      }
      const fields = template.fields?.length ? template.fields : template.bundle?.[0]?.fields
      if (!fields?.length || route.destination === 'dashboard' || route.destination === 'payroll') {
        setState({ status: 'ready', view: 'unavailable', name: template.name, description: template.description })
      } else {
        setState({ status: 'ready', view: 'form', template, fields })
      }
    }
    load()
    return () => { cancelled = true }
  }, [route])

  if (state.status === 'loading') {
    return <div style={{ padding: '3rem 1rem', textAlign: 'center' }}><InlineLoader label="Loading..." /></div>
  }
  if (state.status === 'error') {
    return (
      <>
        <CreateWorkspaceBar ctaText={ctaText} onClick={onCreateWorkspace} />
        <div style={{ padding: '2rem 1rem' }}><ErrorState message={state.message} /></div>
      </>
    )
  }

  if (state.view === 'unavailable') {
    return (
      <>
        <CreateWorkspaceBar ctaText={ctaText} onClick={onCreateWorkspace} />
        <NotYetAvailableCard name={state.name} description={state.description} />
      </>
    )
  }

  if (state.view === 'form') {
    const formName = customIntentText || state.template.name
    return (
      <>
        <CreateWorkspaceBar ctaText={ctaText} onClick={onCreateWorkspace} />
        <FormPreviewModal formName={formName} description={state.template.description} fields={state.fields} onClose={onCreateWorkspace} />
      </>
    )
  }

  if (state.view === 'records') {
    return (
      <>
        <CreateWorkspaceBar ctaText={ctaText} onClick={onCreateWorkspace} />
        <div style={{ paddingBottom: '5rem' }}>
          <Records formId={state.form.id} />
        </div>
      </>
    )
  }

  // 'report'
  return (
    <div style={{ paddingBottom: '5rem' }}>
      <CreateWorkspaceBar ctaText={ctaText} onClick={onCreateWorkspace} />
      <div className="page" style={{ maxWidth: 860 }}>
        <div style={{ display: 'grid', gap: '0.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', margin: '0 0 1.4rem' }}>
          <div className="card" style={{ padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>Today</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: 2 }}>₦{state.stats.todaySales.toLocaleString()}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{state.stats.todayOrders} order{state.stats.todayOrders !== 1 ? 's' : ''}</div>
          </div>
          {state.stats.topSelling.length > 0 && (
            <div className="card" style={{ padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700, marginBottom: '0.4rem' }}>Top Selling</div>
              {state.stats.topSelling.map((name, i) => (
                <div key={name} style={{ fontSize: '0.9rem', fontWeight: i === 0 ? 700 : 500 }}>{name}</div>
              ))}
            </div>
          )}
        </div>
        <Report formId={state.form.id} />
      </div>
    </div>
  )
}
