// Place at: src/onboarding/OnboardingPage.jsx
// The public, first-time entry flow shown to a new visitor before they
// create an account. Rebuilt from a multi-screen questionnaire into a short
// routing experience per the design brief this was built from: Welcome ->
// Setup Selection -> (a follow-up question, only for Workflow/Other) ->
// straight into a working experience (a real demo, or a preview of the
// real template they'd get) -> Sign up only once they've seen it. No step
// counters, no progress bar, no Back/Next form-navigation feel.
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { markVisited } from '../firstVisit'
import { track } from '../lib/onboardingEvents'
import { getEntryIntent } from './entryIntents'
import WelcomeScreen from './WelcomeScreen'
import SetupSelection from './SetupSelection'
import IntentTextPrompt from './IntentTextPrompt'
import PublicDemo from './PublicDemo'
import RealTemplatePreview from './RealTemplatePreview'

export const ONBOARDING_STORAGE_KEY = 'verticals_onboarding'

function saveIntent(payload) {
  try { sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload)) } catch { /* private mode */ }
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [stage, setStage] = useState('welcome') // welcome | selection | text_prompt | destination
  const [selectedId, setSelectedId] = useState(null)
  const [customText, setCustomText] = useState('')

  useEffect(() => { track('started_onboarding') }, [])

  const intent = getEntryIntent(selectedId)

  function enterDestination(chosenIntent, text) {
    track('opened_demo', { entryIntent: chosenIntent.id, customIntentText: text || undefined })
    setStage('destination')
  }

  function handleContinueFromSelection() {
    const chosen = getEntryIntent(selectedId)
    if (!chosen) return
    track('selected_intent', { entryIntent: chosen.id })
    if (chosen.kind === 'text-prompt') setStage('text_prompt')
    else enterDestination(chosen, null)
  }

  function handleContinueFromTextPrompt() {
    if (!intent || !customText.trim()) return
    enterDestination(intent, customText.trim())
  }

  function handleCreateWorkspace() {
    if (!intent) return
    saveIntent({ entry_intent: intent.id, custom_intent_text: customText.trim() || undefined })
    markVisited()
    navigate('/signup')
  }

  // "Skip for now" - straight to signup with no chosen intent at all,
  // rather than forcing a pick. Still counts as "been through onboarding"
  // (markVisited), same as actually finishing it - a second visit should
  // land on Login, not show this again.
  function handleSkip() {
    markVisited()
    navigate('/signup')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {stage !== 'welcome' && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          padding: '0.65rem clamp(1rem, 4vw, 2rem)',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
        }}>
          <img src="/verticals-logo.png" alt="Verticals" style={{ height: 20, width: 'auto' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)' }}>Log in</Link>
          </span>
        </header>
      )}

      {stage === 'welcome' && (
        <WelcomeScreen onGetStarted={() => setStage('selection')} onSignIn={() => navigate('/login')} />
      )}

      {stage === 'selection' && (
        <SetupSelection value={selectedId} onChange={setSelectedId} onContinue={handleContinueFromSelection} onSkip={handleSkip} />
      )}

      {stage === 'text_prompt' && intent && (
        <IntentTextPrompt intent={intent} value={customText} onChange={setCustomText} onContinue={handleContinueFromTextPrompt} />
      )}

      {stage === 'destination' && intent && (
        intent.kind === 'demo'
          ? <PublicDemo onCreateWorkspace={handleCreateWorkspace} />
          : <RealTemplatePreview intent={intent} customIntentText={customText.trim()} onCreateWorkspace={handleCreateWorkspace} />
      )}
    </div>
  )
}
