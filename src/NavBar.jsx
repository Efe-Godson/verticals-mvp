import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

function NavBar() {
  const location = useLocation()

  // Manually extract the form ID from paths like /form/abc-123/records
  const match = location.pathname.match(/^\/form\/([^/]+)/)
  const id = match ? match[1] : null
  const isFormContext = !!id

  return (
    <div style={{
      background: 'white', borderBottom: '1px solid var(--color-border)',
      padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>Verticals</Link>

        {isFormContext && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
            <Link to="/" style={{ color: 'var(--color-muted)' }}>Home</Link>
            <Link to={`/form/${id}/edit`} style={{ color: location.pathname.includes('/edit') ? 'var(--color-primary)' : 'var(--color-muted)' }}>Builder</Link>
            <Link to={`/form/${id}/records`} style={{ color: location.pathname.includes('/records') ? 'var(--color-primary)' : 'var(--color-muted)' }}>Records</Link>
            <Link to={`/form/${id}/report`} style={{ color: location.pathname.includes('/report') ? 'var(--color-primary)' : 'var(--color-muted)' }}>Report</Link>
            <Link to={`/form/${id}/settings`} style={{ color: location.pathname.includes('/settings') ? 'var(--color-primary)' : 'var(--color-muted)' }}>Settings</Link>
          </div>
        )}
      </div>

      <button className="secondary" onClick={() => supabase.auth.signOut()}>Log out</button>
    </div>
  )
}

export default NavBar