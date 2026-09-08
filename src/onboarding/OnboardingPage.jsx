// The public, first-time onboarding shown to a new visitor before they
// create an account. Same shared flow as the Lab prototype
// (src/lab/onboarding); here "Get my Verticals setup" stashes the answers
// and hands off to Sign Up. Nothing is written until an account exists.
import { useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OnboardingScreens from '../lab/onboarding/OnboardingScreens'
import { markVisited } from '../firstVisit'

export const ONBOARDING_STORAGE_KEY = 'verticals_onboarding'

function readSaved() {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch { return undefined }
}

function save(answers) {
  try { sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(answers)) } catch { /* private mode */ }
}

export default function OnboardingPage() {
  const navigate = useNavigate()

  const onAnswersChange = useCallback((a) => save(a), [])
  const onComplete = useCallback((a) => {
    save(a)
    markVisited()
    navigate('/signup')
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          padding: '0.65rem clamp(1rem, 4vw, 2rem)',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
        }}
      >
        <img src="/verticals-logo.png" alt="Verticals" style={{ height: 20, width: 'auto' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)' }}>Log in</Link>
        </span>
      </header>

      <div style={{ padding: 'clamp(1.5rem, 5vw, 3rem) 1rem 4rem' }}>
        <OnboardingScreens
          initialAnswers={readSaved()}
          onAnswersChange={onAnswersChange}
          onComplete={onComplete}
        />
      </div>
    </div>
  )
}
