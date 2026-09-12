// Place at: src/lab/DemoSetupPage.jsx
// Lab: connect each onboarding entry option to what it actually opens - the
// admin-editable half of the entry/onboarding flow (see src/onboarding/
// entryIntents.jsx's loadActiveDemoRoutes, which is what the real flow
// reads). One row per entry_intent, editable and saved independently -
// changing a row here takes effect on the next onboarding visit with no
// redeploy, since the flow reads demo_routes live.
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import LabSidePanel from '../LabSidePanel'
import PageSkeleton from '../components/PageSkeleton'
import { useDeferredLoading } from '../components/loadingHooks'
import { ErrorState } from '../ErrorState'
import { ENTRY_INTENTS, EntryIntentIcon } from '../onboarding/entryIntents'
import { usePageBack } from '../PageTitleContext'

const DESTINATIONS = [
  { value: 'form', label: 'Form (preview)' },
  { value: 'records', label: 'Records' },
  { value: 'report', label: 'Report' },
  { value: 'dashboard', label: 'Dashboard (coming soon)' },
  { value: 'payroll', label: 'Payroll (coming soon)' },
]

const DEFAULT_ROW = { template_slug: '', demo_dataset_id: '', destination: 'form', cta_text: 'Create your workspace', active: false }

// starts = how many sessions picked this intent at all (selected_intent);
// the brief's own funnel example ("Sales: 1,284 starts...") counts per-
// option starts, not the intent-agnostic started_onboarding welcome-screen
// event. Distinct session_id so a retried/duplicate event never inflates a
// count.
function computeFunnel(events, intentId) {
  const forIntent = events.filter(e => e.entry_intent === intentId)
  const distinctSessions = (type) => new Set(forIntent.filter(e => e.event_type === type).map(e => e.session_id)).size
  const starts = distinctSessions('selected_intent')
  const openedDemo = distinctSessions('opened_demo')
  const signedUp = distinctSessions('completed_signup')
  if (starts === 0) return null
  return {
    starts,
    openedDemoPct: Math.round((openedDemo / starts) * 100),
    signedUpPct: Math.round((signedUp / starts) * 100),
  }
}

function DemoSetupPage() {
  usePageBack('/lab', 'Lab')
  const { showToast } = useToast()
  const [templates, setTemplates] = useState([])
  const [datasets, setDatasets] = useState([])
  const [rows, setRows] = useState(null) // { [intentId]: row } once loaded
  const [savingId, setSavingId] = useState(null)
  const [funnelByIntent, setFunnelByIntent] = useState({})
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const [{ data: templatesData, error: templatesError }, { data: datasetsData }, { data: routesData }, { data: eventsData }] = await Promise.all([
      supabase.from('templates').select('slug, name').order('name'),
      supabase.from('demo_datasets').select('id, name').order('name'),
      supabase.from('demo_routes').select('*'),
      supabase.from('onboarding_events').select('entry_intent, event_type, session_id').not('entry_intent', 'is', null),
    ])
    if (templatesError) {
      setError('Could not load templates: ' + templatesError.message)
      return
    }
    setTemplates(templatesData || [])
    setDatasets(datasetsData || [])

    const routesByIntent = {}
    ;(routesData || []).forEach(r => { routesByIntent[r.entry_intent] = r })
    const nextRows = {}
    ENTRY_INTENTS.forEach(intent => {
      const existing = routesByIntent[intent.id]
      nextRows[intent.id] = existing
        ? {
            template_slug: existing.template_slug || '', demo_dataset_id: existing.demo_dataset_id || '',
            destination: existing.destination, cta_text: existing.cta_text, active: existing.active,
          }
        : { ...DEFAULT_ROW }
    })
    setRows(nextRows)

    const funnel = {}
    ENTRY_INTENTS.forEach(intent => { funnel[intent.id] = computeFunnel(eventsData || [], intent.id) })
    setFunnelByIntent(funnel)
  }

  useEffect(() => { load() }, [])

  function updateRow(intentId, patch) {
    setRows(current => ({ ...current, [intentId]: { ...current[intentId], ...patch } }))
  }

  async function saveRow(intentId) {
    setSavingId(intentId)
    const row = rows[intentId]
    const { error: saveError } = await supabase.from('demo_routes').upsert({
      entry_intent: intentId,
      template_slug: row.template_slug || null,
      demo_dataset_id: row.demo_dataset_id || null,
      destination: row.destination,
      cta_text: row.cta_text.trim() || 'Create your workspace',
      active: row.active,
    }, { onConflict: 'entry_intent' })
    setSavingId(null)
    if (saveError) {
      showToast('Could not save: ' + saveError.message, 'error')
      return
    }
    showToast('Connection saved.', 'success')
  }

  const showSkel = useDeferredLoading(rows === null)
  if (rows === null) return showSkel ? <PageSkeleton variant="cards" /> : null
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <LabSidePanel />
      <h1 style={{ marginBottom: '0.3rem' }}>Demo Setup</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>
        What each Setup Selection option opens during onboarding. Inactive options don't show up there at all.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {ENTRY_INTENTS.map(intent => {
          const row = rows[intent.id]
          const funnel = funnelByIntent[intent.id]
          return (
            <div key={intent.id} className="card" style={{ padding: '1.1rem 1.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <EntryIntentIcon id={intent.icon} color="var(--color-primary)" size={22} />
                  <span style={{ fontWeight: 700, fontSize: '1.02rem' }}>{intent.label}</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={row.active} onChange={(e) => updateRow(intent.id, { active: e.target.checked })} />
                  Active
                </label>
              </div>

              <div style={{ display: 'grid', gap: '0.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Template</label>
                  <select value={row.template_slug} onChange={(e) => updateRow(intent.id, { template_slug: e.target.value })} style={{ width: '100%', padding: '0.4rem' }}>
                    <option value="">None</option>
                    {templates.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Demo Data</label>
                  <select value={row.demo_dataset_id} onChange={(e) => updateRow(intent.id, { demo_dataset_id: e.target.value })} style={{ width: '100%', padding: '0.4rem' }}>
                    <option value="">None</option>
                    {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Starting Screen</label>
                  <select value={row.destination} onChange={(e) => updateRow(intent.id, { destination: e.target.value })} style={{ width: '100%', padding: '0.4rem' }}>
                    {DESTINATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>CTA text</label>
                  <input type="text" value={row.cta_text} onChange={(e) => updateRow(intent.id, { cta_text: e.target.value })} style={{ width: '100%', padding: '0.4rem' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                  {funnel
                    ? `${funnel.starts.toLocaleString()} start${funnel.starts !== 1 ? 's' : ''} · ${funnel.openedDemoPct}% opened · ${funnel.signedUpPct}% signed up`
                    : 'No activity yet'}
                </span>
                <button type="button" disabled={savingId === intent.id} onClick={() => saveRow(intent.id)}>
                  {savingId === intent.id ? 'Saving...' : 'Save connection'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DemoSetupPage
