// Place at: src/onboarding/OnboardingPage.jsx
// The public, first-time entry flow shown to a new visitor before they
// create an account. A short routing experience, not a questionnaire:
// Welcome -> Setup Selection -> (a follow-up question, only for Workflow/
// Other) -> straight into a working experience (real demo data, or a
// preview of the real template they'd get) -> Sign up only once they've
// seen it. No step counters, no progress bar, no Back/Next form-navigation
// feel.
//
// Where each intent actually goes (template/dataset/screen/CTA) is admin-
// configurable via the Lab's Demo Setup page - see entryIntents.jsx's
// loadActiveDemoRoutes() and demo_routes. Only Workflow/Other's follow-up
// question is fixed shape, not admin-configurable (see needsTextPrompt).
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { markVisited } from '../firstVisit'
import { track } from '../lib/onboardingEvents'
import { ENTRY_INTENTS, getEntryIntent, needsTextPrompt, loadActiveDemoRoutes } from './entryIntents'
import WelcomeScreen from './WelcomeScreen'
import SetupSelection from './SetupSelection'
import IntentTextPrompt from './IntentTextPrompt'
import IntentDestination from './IntentDestination'

export const ONBOARDING_STORAGE_KEY = 'verticals_onboarding'

function saveIntent(payload) {
  try { sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload)) } catch { /* private mode */ }
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [stage, setStage] = useState('welcome') // welcome | selection | text_prompt | destination
  const [selectedId, setSelectedId] = useState(null)
  const [customText, setCustomText] = useState('')
  // null while loading, then either the fetched map or 'all' meaning "show
  // every intent" (the fetch failed - see loadActiveDemoRoutes's own note).
  const [routesById, setRoutesById] = useState(null)

  useEffect(() => {
    track('started_onboarding')
    loadActiveDemoRoutes().then(result => setRoutesById(result || 'all'))
  }, [])

  const intent = getEntryIntent(selectedId)
  const route = routesById && routesById !== 'all' ? routesById[selectedId] : null
  const visibleIntents = routesById === 'all' || !routesById
    ? ENTRY_INTENTS
    : ENTRY_INTENTS.filter(i => routesById[i.id])

  function enterDestination(chosenIntentId, text) {
    track('opened_demo', { entryIntent: chosenIntentId, customIntentText: text || undefined })
    setStage('destination')
  }

  function handleContinueFromSelection() {
    if (!selectedId) return
    track('selected_intent', { entryIntent: selectedId })
    if (needsTextPrompt(selectedId)) setStage('text_prompt')
    else enterDestination(selectedId, null)
  }

  function handleContinueFromTextPrompt() {
    if (!selectedId || !customText.trim()) return
    enterDestination(selectedId, customText.trim())
  }

  function handleCreateWorkspace() {
    if (!selectedId) return
    saveIntent({ entry_intent: selectedId, custom_intent_text: customText.trim() || undefined })
    markVisited()
    navigate('/signup')
  }

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
        <SetupSelection intents={visibleIntents} value={selectedId} onChange={setSelectedId} onContinue={handleContinueFromSelection} onSkip={handleSkip} />
      )}

      {stage === 'text_prompt' && intent && (
        <IntentTextPrompt intent={intent} value={customText} onChange={setCustomText} onContinue={handleContinueFromTextPrompt} />
      )}

      {stage === 'destination' && (
        <IntentDestination route={route} customIntentText={customText.trim()} onCreateWorkspace={handleCreateWorkspace} />
      )}
    </div>
  )
}
