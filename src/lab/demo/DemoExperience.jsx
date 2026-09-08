// Lab-only: a contained demo environment for the sample (is_demo) business.
// Its own top bar (logo + Log in / Create account) and a Home / Records /
// Report tab nav - the real pages, real data, but boxed off from the rest
// of the app. Nothing here writes data or creates accounts.
import { useEffect, useState } from 'react'
import { NavLink, Link, Outlet, useOutletContext } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { ErrorState } from '../../ErrorState'
import PageSkeleton from '../../components/PageSkeleton'
import Records from '../../Records'
import Report from '../../Report'

export function useDemo() {
  return useOutletContext()
}

const TABS = [
  { to: '/lab/demo', end: true, label: 'Home' },
  { to: '/lab/demo/records', label: 'Records' },
  { to: '/lab/demo/report', label: 'Report' },
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

export default function DemoShell() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    supabase.from('forms').select('id, name').eq('is_demo', true).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setState({ status: 'error', message: error.message })
        else if (!data) setState({ status: 'none' })
        else setState({ status: 'ready', formId: data.id, formName: data.name })
      })
    return () => { cancelled = true }
  }, [])

  if (state.status !== 'ready') {
    return (
      <>
        <TopBar />
        <div className="page" style={{ maxWidth: 560 }}>
          {state.status === 'loading' && <PageSkeleton variant="table" />}
          {state.status === 'error' && <ErrorState message={state.message} />}
          {state.status === 'none' && (
            <>
              <h1>Demo</h1>
              <p style={{ color: 'var(--color-muted)' }}>
                No form is set as the demo yet. Open any form&apos;s <strong>Settings</strong> and turn on
                <strong> &ldquo;Use as the demo business&rdquo;</strong> (admin only), then come back here.
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

export function DemoRecords() {
  const { formId } = useDemo()
  return <Records formId={formId} />
}

export function DemoReport() {
  const { formId } = useDemo()
  return <Report formId={formId} />
}

export function DemoHome() {
  const { formId, formName } = useDemo()
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
        <Link to="/lab/demo/records" style={{ textDecoration: 'none' }}>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: '1.1rem 1.2rem', background: 'var(--color-surface)', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-text)' }}>Records →</div>
            <div style={{ fontSize: '0.86rem', color: 'var(--color-muted)', marginTop: 3 }}>Every entry, filterable, sortable and exportable.</div>
          </div>
        </Link>
        <Link to="/lab/demo/report" style={{ textDecoration: 'none' }}>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: '1.1rem 1.2rem', background: 'var(--color-surface)', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-text)' }}>Report →</div>
            <div style={{ fontSize: '0.86rem', color: 'var(--color-muted)', marginTop: 3 }}>Trends, top performers and changes over time.</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
