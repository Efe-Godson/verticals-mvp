// Place at: src/onboarding/WelcomeScreen.jsx
// The very first screen a new visitor sees, reached only via the marketing
// landing page's "Try free demo" - a returning user signs in from there
// instead, so this stays a single, bare Get Started prompt. No logo here -
// the wordmark already showing in OnboardingPage.jsx's own header (on every
// stage after this one) made a second, larger copy here redundant rather
// than reinforcing.
export default function WelcomeScreen({ onGetStarted }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '2rem 1.25rem', gap: '2.5rem',
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.7rem, 6vw, 2.2rem)' }}>Welcome to Verticals</h1>
        <p style={{ margin: '0.6rem 0 0', color: 'var(--color-muted)', fontSize: '1rem', letterSpacing: '0.02em' }}>
          Capture · Understand · Act
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <button type="button" onClick={onGetStarted} style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 600 }}>
          Get started
        </button>
      </div>
    </div>
  )
}
