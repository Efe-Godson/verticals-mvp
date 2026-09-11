// Place at: src/onboarding/GeneratingScreen.jsx
// "Creating your {X} workspace..." - personalized from whatever they just
// picked, with a real progress bar (not just rotating text) so it visibly
// builds toward something concrete instead of reading as a generic spinner.
// Calls onDone() once BOTH a fixed minimum duration (long enough to read a
// couple of lines, short enough to stay snappy) AND the real data fetch
// (kicked off by OnboardingPage.jsx the moment the records-method question
// was answered, passed in here as `dataPromise`) have resolved - whichever
// is slower. Real network time and what a visitor actually watches happen
// in parallel, not back to back.
import { useEffect, useState } from 'react'

const STATUS_MESSAGES = ['Setting up your records...', 'Adding sample data...', 'Preparing your reports...', 'Almost ready.']
// What the visitor is about to land on - ticked off as the bar passes each
// one, so the wait itself previews what "your workspace" actually means
// before they've seen a single screen of it.
const FEATURES = ['Records', 'Reports', 'Sample data']
const MIN_DURATION_MS = 2400
const PROGRESS_CEILING = 92
const TICK_MS = 60

export default function GeneratingScreen({ label, dataPromise, onDone }) {
  const [progress, setProgress] = useState(4)
  const [messageIndex, setMessageIndex] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const start = Date.now()

    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      // Eases toward the ceiling over the minimum duration instead of a
      // linear ramp - never implies "done" before the real data actually
      // is, since it only ever reaches 100% once Promise.all below fires.
      setProgress(p => Math.max(p, Math.min(PROGRESS_CEILING, (elapsed / MIN_DURATION_MS) * PROGRESS_CEILING)))
      setMessageIndex(Math.min(Math.floor((elapsed / MIN_DURATION_MS) * STATUS_MESSAGES.length), STATUS_MESSAGES.length - 1))
    }, TICK_MS)

    const minDelay = new Promise(resolve => setTimeout(resolve, MIN_DURATION_MS))
    Promise.all([dataPromise, minDelay]).then(([resolvedState]) => {
      if (cancelled) return
      clearInterval(timer)
      setProgress(100)
      setMessageIndex(STATUS_MESSAGES.length - 1)
      setDone(true)
      // Hold at 100% just long enough to register as "done" rather than
      // cutting straight from ~92% to the next screen.
      setTimeout(() => { if (!cancelled) onDone(resolvedState) }, 350)
    })

    return () => { cancelled = true; clearInterval(timer) }
    // Runs once per mount - dataPromise/onDone are captured from the render
    // that mounted this screen, not meant to restart the timer on a
    // reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', textAlign: 'center' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ margin: '0 0 1.1rem', fontSize: 'clamp(1.3rem, 4.5vw, 1.6rem)' }}>
          Creating your {label} workspace...
        </h1>

        <div style={{ height: 8, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 999, background: 'var(--color-primary)',
            transition: done ? 'width 0.25s ease' : 'width 0.15s linear',
          }} />
        </div>

        <p style={{ margin: '0.7rem 0 1.3rem', color: 'var(--color-muted)', fontSize: '0.95rem' }}>
          {STATUS_MESSAGES[messageIndex]}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {FEATURES.map((feature, i) => {
            const unlocked = progress >= ((i + 1) / FEATURES.length) * 100 - 1
            return (
              <span
                key={feature}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem',
                  padding: '0.3rem 0.7rem', borderRadius: 999, border: '1px solid var(--color-border)',
                  color: unlocked ? 'var(--color-text)' : 'var(--color-muted)',
                  background: unlocked ? 'var(--color-primary-soft)' : 'transparent',
                  borderColor: unlocked ? 'var(--color-primary)' : 'var(--color-border)',
                  transition: 'all 0.25s ease',
                }}
              >
                {unlocked ? '✓' : '·'} {feature}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
