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
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import Report from '../Report'
import Records from '../Records'
import FormPreviewModal from '../FormPreview'
import { InlineLoader } from '../components/InlineLoader'
import { ErrorState } from '../ErrorState'
import { resolveFallbackDataset } from './entryIntents'
import DemoBuild from '../demoBuild/DemoBuild'

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

const FUNNEL_TABS = [{ id: 'build', label: 'Build' }, { id: 'records', label: 'Records' }, { id: 'report', label: 'Report' }]

// Build's session-only state (per formId, so switching between "other
// datasets" below and back keeps what was built): any field/product edits
// made in Build, plus any records completed through Launch. Plain local
// state is fine here (unlike PublicDemoExperience.jsx's /demo, which
// backs this with sessionStorage) - switching Records/Report/Build or
// switching sample datasets never navigates (no pathname change), so this
// component never remounts and never loses it.
const EMPTY_BUILD_SESSION = { extraSubmissions: [], justAddedId: null, fieldsOverride: null, productsOverride: null }

// Tabs between Build/Records/Report for whichever dataset is currently
// shown, plus a bottom slider to jump to any *other* seeded dataset - both
// entirely local (no re-entering the onboarding flow), so exploring a few
// different sample businesses is just a couple of taps.
//
// The tabs sit inline right after this screen's own title (small, quiet
// styling - they're a secondary control next to the title, not nav-level
// buttons) at every width, rather than living in the header bar.
function RecordsReportFunnel({ form: initialForm, initialView, isFallback }) {
  const [form, setForm] = useState(initialForm)
  const [view, setView] = useState(initialView)
  const [otherDatasets, setOtherDatasets] = useState([])
  const samplesScrollRef = useRef(null)
  const [buildSessionByForm, setBuildSessionByForm] = useState({})
  const buildSession = buildSessionByForm[form.id] || EMPTY_BUILD_SESSION

  function updateBuildSession(formId, patch) {
    setBuildSessionByForm(current => {
      const existing = current[formId] || EMPTY_BUILD_SESSION
      const resolved = typeof patch === 'function' ? patch(existing) : patch
      return { ...current, [formId]: { ...existing, ...resolved } }
    })
  }
  function addBuildSubmission(formId, submission) {
    updateBuildSession(formId, existing => ({ extraSubmissions: [...existing.extraSubmissions, submission], justAddedId: submission.id }))
  }

  function scrollSamples(direction) {
    samplesScrollRef.current?.scrollBy({ left: direction * 220, behavior: 'smooth' })
  }

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

  const titleTabs = (
    <>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{view === 'report' ? 'Report' : view === 'build' ? 'Build' : 'Records'}</h1>
      <span style={{ width: 1, alignSelf: 'stretch', minHeight: '1.4rem', background: 'var(--color-border)', flexShrink: 0 }} />
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {FUNNEL_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={view === tab.id ? '' : 'secondary'}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: 999 }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div style={{ paddingBottom: otherDatasets.length > 1 ? '5rem' : 0 }}>
      <style>{`
        .onboarding-samples-scroll::-webkit-scrollbar { display: none; }
        .onboarding-samples-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .onboarding-title-row {
          display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
          padding: 0.8rem clamp(1rem, 4vw, 2rem) 0;
        }
      `}</style>

      {/* Report's own filter bar has room for the title+tabs on the same
          line as Date range/Options at every width now (see .report-header-
          extra in Report.jsx), so the report view relies on that entirely
          instead of rendering a second copy here - Records/Build have no
          such bar to share, so they still get this row. */}
      {view !== 'report' && (
        <div className="onboarding-title-row">
          {titleTabs}
        </div>
      )}

      {isFallback && (
        <div style={{ padding: '0.6rem clamp(1rem, 4vw, 2rem) 0' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            That one's not set up yet - here's a live sample instead.
          </span>
        </div>
      )}

      <div className="onboarding-embedded-view" style={{ padding: '0 clamp(1rem, 4vw, 2rem)' }}>
        {view === 'records' ? (
          <Records key={form.id} formId={form.id} defaultToAllTime extraSubmissions={buildSession.extraSubmissions} justAddedId={buildSession.justAddedId} />
        ) : view === 'report' ? (
          <Report key={form.id} formId={form.id} headerExtra={titleTabs} extraSubmissions={buildSession.extraSubmissions} />
        ) : (
          <DemoBuild
            formId={form.id}
            formName={form.name}
            hideTitle
            session={buildSession}
            addSubmission={addBuildSubmission}
            setFieldsOverride={(formId, fields) => updateBuildSession(formId, { fieldsOverride: fields })}
            setProductsOverride={(formId, products) => updateBuildSession(formId, { productsOverride: products })}
            onViewRecords={() => setView('records')}
          />
        )}
      </div>

      {otherDatasets.length > 1 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 240,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
          padding: '0.7rem clamp(1rem, 4vw, 2rem) calc(0.7rem + env(safe-area-inset-bottom))',
        }}>
          <span style={{
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Samples
          </span>
          <div style={{ flex: 1, position: 'relative', minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {/* Solid, unmistakably clickable circular buttons - not a fading
                overlay hinting there's more, an actual visible control. Sit
                inline (not absolutely overlapping the scroll strip), so
                they're always fully visible and never clip past the bar. */}
            <button
              type="button"
              onClick={() => scrollSamples(-1)}
              aria-label="Show previous samples"
              style={{
                width: '2.2rem', height: '2.2rem', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)', color: 'var(--color-primary)', cursor: 'pointer',
              }}
            >
              <ChevronLeft size={18} color="var(--color-primary)" strokeWidth={2.5} style={{ width: 18, height: 18, flexShrink: 0 }} />
            </button>
            <div
              ref={samplesScrollRef}
              className="onboarding-samples-scroll"
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', touchAction: 'pan-x', padding: '0.2rem 0' }}
            >
              {otherDatasets.map(d => {
                const active = d.form_id === form.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => switchToDataset(d.form_id)}
                    style={{
                      fontSize: '0.82rem', fontWeight: 600, padding: '0.55rem 0.95rem', borderRadius: 999,
                      whiteSpace: 'nowrap', flexShrink: 0,
                      border: active ? '2px solid var(--color-primary)' : '1px solid transparent',
                      background: active ? 'var(--color-primary-soft)' : 'var(--color-primary)',
                      color: active ? 'var(--color-primary)' : '#fff',
                      boxShadow: active ? 'none' : '0 2px 6px rgba(0,0,0,0.15)',
                    }}
                  >
                    {d.name}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollSamples(1)}
              aria-label="Show more samples"
              style={{
                width: '2.2rem', height: '2.2rem', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)', color: 'var(--color-primary)', cursor: 'pointer',
              }}
            >
              <ChevronRight size={18} color="var(--color-primary)" strokeWidth={2.5} style={{ width: 18, height: 18, flexShrink: 0 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
