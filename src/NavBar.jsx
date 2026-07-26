import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useRecycleBinTrigger } from './RecycleBinContext'

function NavBar() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPayrollForm, setIsPayrollForm] = useState(false)
  const { trigger: binTrigger } = useRecycleBinTrigger()

  // Manually extract the form ID from paths like /form/abc-123/records
  const match = location.pathname.match(/^\/form\/([^/]+)/)
  const id = match ? match[1] : null
  const isFormContext = !!id

  // Only Employees forms (created by the Staff Payment Tracker template)
  // get a Payroll tab — a lightweight settings-only lookup per form
  // navigation, not worth a shared context for a single boolean.
  useEffect(() => {
    let cancelled = false
    if (!id) { setIsPayrollForm(false); return }
    supabase.from('forms').select('settings').eq('id', id).single().then(({ data }) => {
      if (!cancelled) setIsPayrollForm(data?.settings?.payrollRole === 'employees')
    })
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
          {binTrigger && (
            <button className="secondary" onClick={binTrigger.onOpen}>
              Recycle Bin{binTrigger.count > 0 ? ` (${binTrigger.count})` : ''}
            </button>
          )}
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
        </div>
      )}
    </div>
  )
}

export default NavBar