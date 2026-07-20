import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

function ConfirmEmail() {
  const location = useLocation()
  const email = location.state?.email || ''

  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState('')

  async function resendEmail() {
    if (!email) return
    setResending(true)
    setMessage('')
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    setMessage(error ? error.message : 'Confirmation email resent.')
  }

  return (
    <div className="page" style={{ maxWidth: '420px', textAlign: 'center' }}>
      <h1>Confirm your email</h1>

      <p style={{ color: 'var(--color-muted)', marginTop: '1rem' }}>
        We've sent a confirmation link to{email ? <> <strong>{email}</strong></> : ' your email address'}.
        Click the link in that email to activate your account — this page will move on by itself
        once it's confirmed.
      </p>

      {email && (
        <button onClick={resendEmail} disabled={resending} style={{ marginTop: '1.5rem' }}>
          {resending ? 'Resending...' : 'Resend confirmation email'}
        </button>
      )}

      {message && <p style={{ marginTop: '1rem', color: '#666' }}>{message}</p>}

      <p style={{ marginTop: '2rem', fontSize: '0.9rem' }}>
        <Link to="/login" style={{ color: 'var(--color-primary)' }}>Back to log in</Link>
      </p>
    </div>
  )
}

export default ConfirmEmail