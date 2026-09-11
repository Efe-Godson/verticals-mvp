// Place at: src/onboarding/GeneratingScreen.jsx
// "Creating your {X} workspace..." - personalized from whatever they just
// picked, rotating through a few short status lines rather than a bare
// "Loading...". Calls onDone() once BOTH a fixed minimum duration (long
// enough to read a couple of lines, short enough to stay snappy) AND the
// real data fetch (kicked off by OnboardingPage.jsx the moment the records-
// method question was answered, passed in here as `dataPromise`) have
// resolved - whichever is slower. Real network time and what a visitor
// actually watches happen in parallel, not back to back.
import { useEffect, useState } from 'react'

const STATUS_MESSAGES = ['Setting up your records...', 'Adding sample data...', 'Preparing your reports...', 'Almost ready.']
const MIN_DURATION_MS = 1800
const MESSAGE_INTERVAL_MS = 500

export default function GeneratingScreen({ label, dataPromise, onDone }) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(i => Math.min(i + 1, STATUS_MESSAGES.length - 1))
    }, MESSAGE_INTERVAL_MS)

    let cancelled = false
    const minDelay = new Promise(resolve => setTimeout(resolve, MIN_DURATION_MS))
    Promise.all([dataPromise, minDelay]).then(([resolvedState]) => {
      if (!cancelled) onDone(resolvedState)
    })

    return () => { cancelled = true; clearInterval(interval) }
    // Runs once per mount - dataPromise/onDone are captured from the render
    // that mounted this screen, not meant to restart the timer on a
    // reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', textAlign: 'center' }}>
      <div>
        <h1 style={{ margin: '0 0 0.8rem', fontSize: 'clamp(1.3rem, 4.5vw, 1.6rem)' }}>
          Creating your {label} workspace...
        </h1>
        <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.95rem' }}>
          {STATUS_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  )
}
