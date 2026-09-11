import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { DEFAULT_COUNTRY, loadCountries } from './lib/locationData'
import PasswordInput from './PasswordInput'
import { track } from './lib/onboardingEvents'
import { ONBOARDING_STORAGE_KEY } from './onboarding/OnboardingPage'

// Whatever the new entry flow (src/onboarding/OnboardingPage.jsx) stashed
// before handing off here - { entry_intent, custom_intent_text?,
// current_records_method? } - or null if this account is being created
// without going through onboarding at all (e.g. an existing visitor who
// skipped straight to /signup).
function readOnboardingIntent() {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  )
}

function SignUp() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const [countries, setCountries] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    let alive = true
    loadCountries().then(list => { if (alive) setCountries(list) })
    return () => { alive = false }
  }, [])

  async function handleGoogleSignUp() {
    setGoogleLoading(true)
    setMessage('')
    const pending = readOnboardingIntent()
    if (pending) track('started_signup', { entryIntent: pending.entry_intent, customIntentText: pending.custom_intent_text })
    // Google's OAuth flow has no equivalent to signUp()'s own `data` option -
    // entry_intent gets backfilled onto user_metadata post-redirect instead,
    // see completeOnboardingEntry.js (called from BusinessesHome.jsx, the
    // first page this redirect actually lands back on).
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

    const pending = readOnboardingIntent()
    if (pending) track('started_signup', { entryIntent: pending.entry_intent, customIntentText: pending.custom_intent_text })

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm-email`,
        data: {
          // Lets a "Location" field on any form this account builds default
          // its Country to wherever the business actually operates, instead
          // of asking the respondent to pick it every time.
          country,
          // Set here too (not just backfilled post-confirmation by
          // completeOnboardingEntry.js) so it's on the account from the
          // moment it exists, in case anything reads it before that runs.
          ...(pending ? { entry_intent: pending.entry_intent, custom_intent_text: pending.custom_intent_text || null, current_records_method: pending.current_records_method || null } : {}),
        },
      }
    })

    setLoading(false)
    if (error) {
      setMessage(error.message)
    } else {
      navigate('/confirm-email', { state: { email } })
    }
  }

  const fromOnboarding = !!readOnboardingIntent()

  return (
    <div className="page" style={{ maxWidth: '380px' }}>
      <h1>Create account</h1>

      {fromOnboarding && (
        <p style={{
          margin: '0.4rem 0 0', padding: '0.6rem 0.8rem', borderRadius: 8,
          background: 'var(--color-primary-soft)', color: 'var(--color-text)', fontSize: '0.85rem',
        }}>
          Your setup is ready. Create an account to save it and get started.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
        <div>
          <label>Email</label><br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label>Password</label><br />
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Country</label><br />
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: '100%' }}>
            {countries.length === 0 && <option value={country}>{country}</option>}
            {countries.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : 'Sign up'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '1rem 0', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
        or
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
      </div>
      <button
        type="button"
        className="secondary"
        onClick={handleGoogleSignUp}
        disabled={googleLoading}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
      >
        <GoogleLogo />
        {googleLoading ? 'Redirecting to Google...' : 'Sign up with Google'}
      </button>

      {message && <p style={{ marginTop: '1rem', color: '#c0392b' }}>{message}</p>}

      <div style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--color-primary)' }}>Log in</Link>
      </div>
    </div>
  )
}

export default SignUp