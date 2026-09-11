// Place at: src/PublicDemoExperience.jsx
// A genuinely public "see a live demo" page - own top bar (logo + Log in /
// Create account) and a Home / Records / Report tab nav, no app NavBar, no
// login required. Rebuilt from the old admin-only /lab/demo (src/lab/demo/
// DemoExperience.jsx, retired when Demo Setup/Demo Data shipped) at the
// user's request, specifically so this one can be linked to directly from
// an outside marketing site - same real pages, real data, boxed off from
// the rest of the app, just reachable by anyone now instead of only the
// admin. Nothing here writes data or creates accounts.
//
// Shows whichever dataset is connected to the "sales" onboarding intent in
// demo_routes (the same one Get Started -> Sales shows) - the flagship demo
// businesses generally point new visitors at anyway - falling back to
// whichever demo_datasets row is oldest if that connection doesn't exist
// yet. One dataset for now, matching the old page's own simplicity; a
// specific-dataset route (e.g. /demo/:formId) is a natural follow-up if a
// second demo ever needs its own link.
import { useEffect, useState } from 'react'
import { NavLink, Link, Outlet, useOutletContext } from 'react-router-dom'
import { supabase } from './supabaseClient'
import PageSkeleton from './components/PageSkeleton'
import Records from './Records'
import Report from './Report'

export function usePublicDemo() {
  return useOutletContext()
}

const TABS = [
  { to: '/demo', end: true, label: 'Home' },
  { to: '/demo/records', label: 'Records' },
  { to: '/demo/report', label: 'Report' },
]

function TopBar() {
  return (
    <header
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        padding: '0.6rem clamp(1rem, 4vw, 2rem)',
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
        <img src="/verticals-logo.png" alt="Verticals" style={{ height: 20, width: 'auto' }} />
        <span style={{
          fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
          color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 999, padding: '2px 8px',
        }}>Demo</span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <Link to="/login"><button type="button" className="secondary" style={{ fontSize: '0.85rem' }}>Log in</button></Link>
        <Link to="/signup"><button type="button" style={{ fontSize: '0.85rem' }}>Create account</button></Link>
      </div>
    </header>
  )
}

export default function PublicDemoShell() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: route } = await supabase
        .from('demo_routes').select('demo_datasets(form_id, name)').eq('entry_intent', 'sales').maybeSingle()
      let formId = route?.demo_datasets?.form_id
      let name = route?.demo_datasets?.name

      if (!formId) {
        const { data: fallback } = await supabase
          .from('demo_datasets').select('form_id, name').order('created_at', { ascending: true }).limit(1).maybeSingle()
        formId = fallback?.form_id
        name = fallback?.name
      }

      if (cancelled) return
      if (!formId) { setState({ status: 'none' }); return }
      setState({ status: 'ready', formId, formName: name })
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (state.status !== 'ready') {
    return (
      <>
        <TopBar />
        <div className="page" style={{ maxWidth: 560 }}>
          {state.status === 'loading' && <PageSkeleton variant="table" />}
          {state.status === 'none' && (
            <>
              <h1>Demo</h1>
              <p style={{ color: 'var(--color-muted)' }}>
                No demo dataset is set up yet. Add one in the Lab&apos;s <strong>Demo Data</strong> page, then come
                back here.
              </p>
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="demo-env">
      <TopBar />
      <nav className="demo-tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? 'demo-tab is-active' : 'demo-tab')}
          >
            {t.label}
          </NavLink>
        ))}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          Sample: <strong style={{ color: 'var(--color-text)' }}>{state.formName}</strong>
        </span>
      </nav>
      <Outlet context={{ formId: state.formId, formName: state.formName }} />
    </div>
  )
}

// --- the three pages -------------------------------------------------------

export function PublicDemoRecords() {
  const { formId } = usePublicDemo()
  return <Records formId={formId} />
}

export function PublicDemoReport() {
  const { formId } = usePublicDemo()
  return <Report formId={formId} />
}

export function PublicDemoHome() {
  const { formId, formName } = usePublicDemo()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.from('submissions').select('created_at').eq('form_id', formId).is('deleted_at', null)
      .then(({ data }) => {
        if (cancelled) return
        const rows = data || []
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const last = rows.map((r) => new Date(r.created_at)).sort((a, b) => b - a)[0]
        setStats({
          total: rows.length,
          thisMonth: rows.filter((r) => new Date(r.created_at) >= monthStart).length,
          last,
        })
      })
    return () => { cancelled = true }
  }, [formId])

  const tile = (label, value) => (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: '1rem 1.1rem', background: 'var(--color-surface)' }}>
      <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  )

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 style={{ marginBottom: '0.2rem' }}>{formName}</h1>
      <p style={{ marginTop: 0, color: 'var(--color-muted)' }}>
        A sample business with real data. Explore its records, then see what the reports make of them.
      </p>

      <div style={{ display: 'grid', gap: '0.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', margin: '1.4rem 0 1.8rem' }}>
        {tile('Records', stats ? stats.total.toLocaleString() : '…')}
        {tile('This month', stats ? stats.thisMonth.toLocaleString() : '…')}
        {tile('Last entry', stats?.last ? stats.last.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '…')}
      </div>

      <div style={{ display: 'grid', gap: '0.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Link to="/demo/records" style={{ textDecoration: 'none' }}>
          <div className="demo-cta">
            <div className="demo-cta-title">Records →</div>
            <div className="demo-cta-desc">Every entry, filterable, sortable and exportable.</div>
          </div>
        </Link>
        <Link to="/demo/report" style={{ textDecoration: 'none' }}>
          <div className="demo-cta">
            <div className="demo-cta-title">Report →</div>
            <div className="demo-cta-desc">Trends, top performers and changes over time.</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
