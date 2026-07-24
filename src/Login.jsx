import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setMessage('')
    // Identity only — deliberately not requesting Sheets/Drive scopes here.
    // Those are requested separately, incrementally, only when the user
    // actually tries to use the Google Sheets export (see recordsExport.js).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'openid email profile'
      }
    })
    if (error) {
      setMessage(error.message)
      setGoogleLoading(false)
    }
    // On success the browser navigates to Google, so nothing further runs here.
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
 
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) setMessage(error.message)
      else setMessage('Check your email for a password reset link.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
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
            'Send reset link'}
        </button>
      </form>

      {mode === 'login' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '1rem 0', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            or
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          </div>
          <button
            type="button"
            className="secondary"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            style={{ width: '100%' }}
          >
            {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
          </button>
        </>
      )}

      {message && <p style={{ marginTop: '1rem', color: '#666' }}>{message}</p>}
 
      <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {mode === 'login' && (
          <>
            <span>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: 'var(--color-primary)' }}>Sign up</Link>
            </span>
            <span
              style={{ color: 'var(--color-primary)', cursor: 'pointer' }}
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </span>
          </>
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
 
