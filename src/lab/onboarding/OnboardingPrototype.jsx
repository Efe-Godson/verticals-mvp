// Lab page for previewing the real entry/onboarding flow while logged in.
// Used to wrap a separate questionnaire-based prototype (OnboardingScreens,
// its own conditional-flow engine) that had drifted out of sync with the
// real thing once /onboarding was rebuilt into the short Welcome -> Setup
// Selection -> Demo/Preview flow (see src/onboarding/OnboardingPage.jsx) -
// rather than maintain two onboarding experiences that could disagree with
// each other, this just renders the real OnboardingPage directly. Nothing
// gets written until an actual signup happens (IntentDestination.jsx only
// ever reads), so this is safe to click all the way through - "Create your
// workspace" navigates to /signup, which (already being logged in) bounces
// straight back to the real Businesses home instead of faking an ending.
import { useState } from 'react'
import LabSidePanel from '../../LabSidePanel'
import OnboardingPage from '../../onboarding/OnboardingPage'
import { usePageBack } from '../../PageTitleContext'

export default function OnboardingPrototype() {
  usePageBack('/lab', 'Lab')
  const [runId, setRunId] = useState(0) // bump to remount OnboardingPage from Welcome

  return (
    <>
      <LabSidePanel />
      <div style={{ padding: '1rem clamp(1rem, 4vw, 2rem) 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: '0 0 0.2rem' }}>Onboarding preview</h1>
          <button type="button" className="secondary" onClick={() => setRunId(n => n + 1)} style={{ fontSize: '0.85rem' }}>
            Start over
          </button>
        </div>
        <p style={{ marginTop: 0, color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          The real entry flow, live - exactly what a new visitor sees. Nothing is created until an actual account
          signs up; "Create your workspace" from here just bounces back to your own account since you're already
          logged in.
        </p>
      </div>
      <OnboardingPage key={runId} />
    </>
  )
}
