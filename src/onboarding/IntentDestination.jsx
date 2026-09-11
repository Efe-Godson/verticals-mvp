// Place at: src/onboarding/IntentDestination.jsx
// Merges Phase 1's PublicDemo.jsx and RealTemplatePreview.jsx into one
// component branching on `route.destination` (from demo_routes) instead of
// on which file was hardcoded per intent - same reuse underneath, now
// driven by admin config instead of a static per-intent fork:
//   'records' / 'report' -> real, read-only data (Records/Report by formId
//     prop, same reuse src/lab/demo/DemoExperience.jsx relied on) from the
//     route's connected demo dataset. Both are always reachable from here
//     via RecordsReportFunnel's own tabs, regardless of which one Demo
//     Setup configured as the default - and a bottom slider lets a visitor
//     jump to any *other* seeded dataset too, without leaving onboarding.
//   'form' -> a non-submitting preview of the template's own field shape
//     (FormPreviewModal) - only reached when the template actually has
//     fields to show; a form can't be created pre-signup (forms' insert
//     policy needs auth.uid()), so this previews the shape and the real
//     workspace is created post-signup, see completeOnboardingEntry.js.
//   nothing connected (no route, an empty-fields template, or 'dashboard'/
//     'payroll' - not wired to a real view yet, Expenses/Payroll are
//     route-param + Outlet-context "shells", not simple formId-prop
//     components) -> resolveFallbackDataset() drops the visitor into the
//     flagship demo instead of a dead-end placeholder. Whatever they
//     picked didn't have its own sample yet, but there's always something
//     real to show.
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
import { resolveFallbackDataset } from './entryIntents'

async function loadFallback() {
  const dataset = await resolveFallbackDataset()
  if (!dataset) return { status: 'error', message: "The demo isn't available right now - you can still create your own workspace." }
  const { data: form, error } = await supabase.from('forms').select('*').eq('id', dataset.form_id).maybeSingle()
  if (error || !form) return { status: 'error', message: "The demo isn't available right now - you can still create your own workspace." }
  return { status: 'ready', view: 'report', form, isFallback: true }
}

export async function loadDestinationData(route) {
  if (!route) return loadFallback()

  if (route.destination === 'records' || route.destination === 'report') {
    const formId = route.demo_datasets?.form_id
    if (!formId) return loadFallback()
    const { data: form, error } = await supabase.from('forms').select('*').eq('id', formId).maybeSingle()
    if (error || !form) return loadFallback()
    return { status: 'ready', view: route.destination === 'report' ? 'report' : 'records', form }
  }

  // 'form' (and the not-yet-wired 'dashboard'/'payroll', which fall through
  // to the same fallback an empty-fields template does).
  if (!route.template_slug) return loadFallback()
  const { data: template, error } = await supabase.from('templates').select('*').eq('slug', route.template_slug).single()
  if (error || !template) return loadFallback()
  const fields = template.fields?.length ? template.fields : template.bundle?.[0]?.fields
  if (!fields?.length || route.destination === 'dashboard' || route.destination === 'payroll') {
    return loadFallback()
  }
  return { status: 'ready', view: 'form', template, fields }
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

  if (state.view === 'form') {
    const formName = customIntentText || state.template.name
    return <FormPreviewModal formName={formName} description={state.template.description} fields={state.fields} onClose={() => {}} />
  }

  // 'records' / 'report'
  return <RecordsReportFunnel key={state.form.id} form={state.form} initialView={state.view} isFallback={state.isFallback} />
}

// Tabs between Records/Report for whichever dataset is currently shown, plus
// a bottom slider to jump to any *other* seeded dataset - both entirely
// local (no re-entering the onboarding flow), so exploring a few different
// sample businesses is just a couple of taps.
function RecordsReportFunnel({ form: initialForm, initialView, isFallback }) {
  const [form, setForm] = useState(initialForm)
  const [view, setView] = useState(initialView)
  const [otherDatasets, setOtherDatasets] = useState([])

  useEffect(() => {
    let cancelled = false
    supabase.from('demo_datasets').select('id, name, form_id').order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled) setOtherDatasets(data || []) })
    return () => { cancelled = true }
  }, [])

  async function switchToDataset(datasetFormId) {
    if (datasetFormId === form.id) return
    const { data } = await supabase.from('forms').select('*').eq('id', datasetFormId).maybeSingle()
    if (data) setForm(data)
  }

  return (
    <div style={{ paddingBottom: otherDatasets.length > 1 ? '5.5rem' : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', padding: '0.8rem clamp(1rem, 4vw, 2rem) 0' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[{ id: 'records', label: 'Records' }, { id: 'report', label: 'Report' }].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={view === tab.id ? '' : 'secondary'}
              style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', borderRadius: 999 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isFallback && (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            That one's not set up yet - here's a live sample instead.
          </span>
        )}
      </div>

      {view === 'records' ? <Records key={form.id} formId={form.id} /> : <Report key={form.id} formId={form.id} />}

      {otherDatasets.length > 1 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 240,
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
          padding: '0.7rem 0 calc(0.7rem + env(safe-area-inset-bottom))',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', padding: '0 clamp(1rem, 4vw, 2rem)', marginBottom: '0.4rem' }}>
            See other samples
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0 clamp(1rem, 4vw, 2rem)' }}>
            {otherDatasets.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => switchToDataset(d.form_id)}
                className={d.form_id === form.id ? '' : 'secondary'}
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
