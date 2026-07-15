// Place at: src/Login.jsx
import { useState } from 'react'
import { supabase } from './supabaseClient'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) {
        setMessage(error.message)
      } else if (data?.session) {
        // Email confirmation is off (or already confirmed) — they're signed in already.
        setMessage("Account created! You're all set.")
      } else {
        // Session is null: Supabase is waiting on email confirmation.
        // Drop them into the login view so the next step is obvious once they've confirmed.
        setPassword('')
        setMode('login')
        setMessage("Check your email, we have sent a SUP" + email + ". Click it, then log in below.")
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) setMessage(error.message)
      else setMessage('Check your email for a password reset link.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Supabase returns a generic "Invalid login credentials" for both a
        // wrong password and an unconfirmed email — nudge toward the likely cause.
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          setMessage("Invalid login credentials. If you just signed up, make sure you've clicked the confirmation link in your email first.")
        } else {
          setMessage(error.message)
        }
      }
    }
    setLoading(false)
  }

  function switchMode(newMode) {
    setMode(newMode)
    setMessage('')
  }

  return (
    <div className="page" style={{ maxWidth: '380px' }}>
      <h1>
        {mode === 'login' && 'Log in'}
        {mode === 'signup' && 'Create account'}
        {mode === 'forgot' && 'Reset password'}
      </h1>

      {mode === 'forgot' && (
        <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>
          Enter your email and we'll send you a link to reset your password.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
        <div>
          <label>Email</label><br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%' }} />
        </div>

        {mode !== 'forgot' && (
          <div>
            <label>Password</label><br />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%' }} />
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' :
            mode === 'login' ? 'Log in' :
            mode === 'signup' ? 'Sign up' :
            'Send reset link'}
        </button>
      </form>

      {message && (
        <p style={{
          marginTop: '1rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius)',
          background: '#f3f4f6', color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 1.4
        }}>
          {message}
        </p>
      )}

      <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {mode === 'login' && (
          <>
            <span>
              Don't have an account?{' '}
              <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => switchMode('signup')}>Sign up</span>
            </span>
            <span
              style={{ color: 'var(--color-primary)', cursor: 'pointer' }}
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </span>
          </>
        )}

        {mode === 'signup' && (
          <span>
            Already have an account?{' '}
            <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => switchMode('login')}>Log in</span>
          </span>
        )}

        {mode === 'forgot' && (
          <span>
            Remembered it?{' '}
            <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => switchMode('login')}>Back to log in</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default Login