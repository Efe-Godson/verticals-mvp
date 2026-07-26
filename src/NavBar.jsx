import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useRecycleBinTrigger } from './RecycleBinContext'

function NavBar() {
  const location = useLocation()
  const { session } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [linkedMenuOpen, setLinkedMenuOpen] = useState(false)
  const [isPayrollForm, setIsPayrollForm] = useState(false)
  const [linkedForms, setLinkedForms] = useState([]) // sibling forms in the same bundle, excluding self
  const { trigger: binTrigger } = useRecycleBinTrigger()

  const displayName = session?.user?.user_metadata?.full_name || ''
  const initials = (displayName || session?.user?.email || '?').trim().slice(0, 1).toUpperCase()

  // Manually extract the form ID from paths like /form/abc-123/records
  const match = location.pathname.match(/^\/form\/([^/]+)/)
  const id = match ? match[1] : null
  const isFormContext = !!id

  // Lightweight settings-only lookup per form navigation — cheap enough not
  // to be worth a shared context for a couple of booleans/a short list.
  // Only Employees forms (Staff Payment Tracker) get a Payroll tab; any
  // form that's part of a bundle template (primary or secondary) gets a
  // Linked Forms menu, since secondary forms are hidden from Home's list
  // and this is otherwise the only way back to them.
  useEffect(() => {
    let cancelled = false
    if (!id) { setIsPayrollForm(false); setLinkedForms([]); return }

    async function load() {
      const { data: current } = await supabase.from('forms').select('id, name, settings').eq('id', id).single()
      if (cancelled || !current) return
      setIsPayrollForm(current.settings?.payrollRole === 'employees')

      const groupPrimaryId = current.settings?.primaryFormId || current.id
      const [{ data: primary }, { data: siblings }] = await Promise.all([
        groupPrimaryId !== current.id
          ? supabase.from('forms').select('id, name').eq('id', groupPrimaryId).is('deleted_at', null).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('forms').select('id, name').eq('settings->>primaryFormId', groupPrimaryId).is('deleted_at', null),
      ])
      if (cancelled) return

      const group = [primary, ...(siblings || [])].filter(f => f && f.id !== current.id)
      setLinkedForms(group)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  function linkColor(segment) {
    return location.pathname.includes(segment) ? 'var(--color-primary)' : 'var(--color-muted)'
  }

  return (
    <div style={{
      background: 'white', borderBottom: '1px solid var(--color-border)',
      padding: '0.8rem 1.5rem'
    }}>
      <div className="navbar-row" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>Verticals</Link>
          <Link to="/templates" style={{ color: location.pathname === '/templates' ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: '0.9rem' }}>Templates</Link>

          {isFormContext && (
            <div className="navbar-links-desktop" style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
              <Link to="/" style={{ color: 'var(--color-muted)' }}>Home</Link>
              <Link to={`/form/${id}/edit`} style={{ color: linkColor('/edit') }}>Builder</Link>
              <Link to={`/form/${id}/records`} style={{ color: linkColor('/records') }}>Records</Link>
              <Link to={`/form/${id}/report`} style={{ color: linkColor('/report') }}>Report</Link>
              {isPayrollForm && <Link to={`/form/${id}/payroll`} style={{ color: linkColor('/payroll') }}>Payroll</Link>}
              <Link to={`/form/${id}/ai-analyst`} style={{ color: linkColor('/ai-analyst') }}>AI Analyst</Link>
              <Link to={`/form/${id}/settings`} style={{ color: linkColor('/settings') }}>Settings</Link>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {linkedForms.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button className="secondary" onClick={() => setLinkedMenuOpen(!linkedMenuOpen)}>
                Linked Forms ▾
              </button>
              {linkedMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setLinkedMenuOpen(false)} />
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                    background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '180px', overflow: 'hidden'
                  }}>
                    {linkedForms.map(f => (
                      <Link
                        key={f.id}
                        to={`/form/${f.id}/records`}
                        onClick={() => setLinkedMenuOpen(false)}
                        style={{ display: 'block', padding: '0.55rem 0.9rem', fontSize: '0.85rem', color: 'inherit' }}
                      >
                        {f.name}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {binTrigger && (
            <button className="secondary" onClick={binTrigger.onOpen}>
              Recycle Bin{binTrigger.count > 0 ? ` (${binTrigger.count})` : ''}
            </button>
          )}
          <Link
            to="/account"
            title="Account"
            style={{
              width: '30px', height: '30px', borderRadius: '50%', background: 'var(--color-primary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
              outline: location.pathname === '/account' ? '2px solid var(--color-primary)' : 'none',
              outlineOffset: '2px'
            }}
          >
            {initials}
          </Link>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>Log out</button>

          {isFormContext && (
            <button
              className="secondary navbar-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              style={{ padding: '0.5rem 0.7rem' }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>
      </div>

      {isFormContext && (
        <div className={`navbar-links-mobile ${menuOpen ? 'open' : ''}`} style={{ fontSize: '0.9rem' }}>
          <Link to="/" style={{ color: 'var(--color-muted)' }} onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to={`/form/${id}/edit`} style={{ color: linkColor('/edit') }} onClick={() => setMenuOpen(false)}>Builder</Link>
          <Link to={`/form/${id}/records`} style={{ color: linkColor('/records') }} onClick={() => setMenuOpen(false)}>Records</Link>
          <Link to={`/form/${id}/report`} style={{ color: linkColor('/report') }} onClick={() => setMenuOpen(false)}>Report</Link>
          {isPayrollForm && <Link to={`/form/${id}/payroll`} style={{ color: linkColor('/payroll') }} onClick={() => setMenuOpen(false)}>Payroll</Link>}
          <Link to={`/form/${id}/ai-analyst`} style={{ color: linkColor('/ai-analyst') }} onClick={() => setMenuOpen(false)}>AI Analyst</Link>
          <Link to={`/form/${id}/settings`} style={{ color: linkColor('/settings') }} onClick={() => setMenuOpen(false)}>Settings</Link>
          {linkedForms.map(f => (
            <Link key={f.id} to={`/form/${f.id}/records`} style={{ color: 'var(--color-muted)' }} onClick={() => setMenuOpen(false)}>
              → {f.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default NavBar