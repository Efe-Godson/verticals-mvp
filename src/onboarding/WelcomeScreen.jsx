// Place at: src/onboarding/WelcomeScreen.jsx
// The very first screen a new visitor sees. Deliberately bare - see the
// entry/onboarding design brief this was built from: no feature copy, no
// testimonials, just the two places a visitor could be trying to go.
// "Sign in" is a full button, not a small link under Get Started, so a
// returning user's eye lands on it just as fast as a new one's does on
// Get Started.
export default function WelcomeScreen({ onGetStarted, onSignIn }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '2rem 1.25rem', gap: '2.5rem',
    }}>
      <div>
        <img src="/verticals-logo.png" alt="" style={{ height: 34, width: 'auto', marginBottom: '1.4rem' }} />
        <h1 style={{ margin: 0, fontSize: 'clamp(1.7rem, 6vw, 2.2rem)' }}>Welcome to Verticals</h1>
        <p style={{ margin: '0.6rem 0 0', color: 'var(--color-muted)', fontSize: '1rem', letterSpacing: '0.02em' }}>
          Capture · Understand · Act
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <button type="button" onClick={onGetStarted} style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 600 }}>
          Get started
        </button>
        <button type="button" className="secondary" onClick={onSignIn} style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 600 }}>
          Sign in
        </button>
      </div>
    </div>
  )
}
