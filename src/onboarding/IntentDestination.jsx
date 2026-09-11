// Place at: src/onboarding/IntentDestination.jsx
// Merges Phase 1's PublicDemo.jsx and RealTemplatePreview.jsx into one
// component branching on `route.destination` (from demo_routes) instead of
// on which file was hardcoded per intent - same reuse underneath, now
// driven by admin config instead of a static per-intent fork:
//   'records' / 'report' -> real, read-only data (Records/Report by formId
//     prop, same reuse src/lab/demo/DemoExperience.jsx relied on) from the
//     route's connected demo dataset.
//   'form' -> a non-submitting preview of the template's own field shape
//     (FormPreviewModal) - a form can't actually be created pre-signup
//     (forms' insert policy needs auth.uid()), so this previews the shape;
//     the real workspace is created post-signup, see completeOnboardingEntry.js.
//   'dashboard' / 'payroll' -> not wired to a real view yet (Expenses/
//     Payroll are route-param + Outlet-context "shells", not simple
//     formId-prop components - see the plan this was built from), so this
//     shows the same honest "ready to configure" message a field-less
//     template (Payroll) already falls back to under 'form'.
//
// loadDestinationData(route) is exported so OnboardingPage.jsx can kick it
// off from the *records-method* step and hand the resolved state straight
// to this component once GeneratingScreen's own minimum-duration timer
// finishes too - real network time and the screen a visitor actually sees
// happen in parallel instead of a second fetch (and a second spinner)
// starting only once they land here.
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Report from '../Report'
import Records from '../Records'
import FormPreviewModal from '../FormPreview'
import { InlineLoader } from '../components/InlineLoader'
import { ErrorState } from '../ErrorState'

export async function loadDestinationData(route) {
  if (!route) {
    return { status: 'error', message: "This option isn't available right now." }
  }

  if (route.destination === 'records' || route.destination === 'report') {
    const formId = route.demo_datasets?.form_id
    if (!formId) {
      return { status: 'error', message: "This demo isn't connected to any data yet - you can still create your own workspace." }
    }
    const { data: form, error } = await supabase.from('forms').select('*').eq('id', formId).maybeSingle()
    if (error || !form) {
      return { status: 'error', message: "The demo isn't available right now - you can still create your own workspace." }
    }
    return { status: 'ready', view: route.destination === 'report' ? 'report' : 'records', form }
  }

  // 'form' (and the not-yet-wired 'dashboard'/'payroll', which fall through
  // to the same field-shape preview or its empty-fields fallback).
  if (!route.template_slug) {
    return { status: 'ready', view: 'unavailable', name: 'Coming soon' }
  }
  const { data: template, error } = await supabase.from('templates').select('*').eq('slug', route.template_slug).single()
  if (error || !template) {
    return { status: 'error', message: 'Could not load this template right now.' }
  }
  const fields = template.fields?.length ? template.fields : template.bundle?.[0]?.fields
  if (!fields?.length || route.destination === 'dashboard' || route.destination === 'payroll') {
    return { status: 'ready', view: 'unavailable', name: template.name, description: template.description }
  }
  return { status: 'ready', view: 'form', template, fields }
}

function NotYetAvailableCard({ name, description }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem' }}>
      <div className="card" style={{ maxWidth: 420, padding: '1.6rem', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 0.5rem' }}>{name}</h2>
        <p style={{ color: 'var(--color-muted)', margin: 0 }}>
          {description || "This one's a dedicated workspace, ready to configure as soon as you sign up."}
        </p>
      </div>
    </div>
  )
}

// `state` is normally already resolved by the time this renders (see
// above) - the loading branch here only matters if something renders this
// directly without going through that step first.
export default function IntentDestination({ route, state: providedState, customIntentText }) {
  const [ownState, setOwnState] = useState(null)
  const state = providedState || ownState

  useEffect(() => {
    if (providedState) return
    let cancelled = false
    loadDestinationData(route).then(result => { if (!cancelled) setOwnState(result) })
    return () => { cancelled = true }
  }, [route, providedState])

  if (!state) {
    return <div style={{ padding: '3rem 1rem', textAlign: 'center' }}><InlineLoader label="Loading..." /></div>
  }
  if (state.status === 'error') {
    return <div style={{ padding: '2rem 1rem' }}><ErrorState message={state.message} /></div>
  }

  if (state.view === 'unavailable') {
    return <NotYetAvailableCard name={state.name} description={state.description} />
  }

  if (state.view === 'form') {
    const formName = customIntentText || state.template.name
    return <FormPreviewModal formName={formName} description={state.template.description} fields={state.fields} onClose={() => {}} />
  }

  if (state.view === 'records') {
    return <Records formId={state.form.id} />
  }

  // 'report' - no wrapper here: Report.jsx already renders its own `.page`
  // div internally (same as Records.jsx above), so wrapping it in a second
  // one double-stacked that padding into a visibly oversized gap under the
  // onboarding header.
  return <Report formId={state.form.id} />
}
