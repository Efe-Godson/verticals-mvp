// Place at: src/onboarding/OnboardingPage.jsx
// The public, first-time entry flow shown to a new visitor before they
// create an account. A short routing experience, not a questionnaire:
// Welcome -> Setup Selection -> (a follow-up question, only for Workflow/
// Other) -> "How do you currently keep records?" -> a short "Creating your
// workspace..." beat -> straight into a working experience (real demo
// data, or a preview of the real template they'd get). No step counters,
// no progress bar, no Back/Next form-navigation feel. Benchmark: Get
// Started -> pick -> pick -> demo is the whole thing, 3 interactions.
//
// Where each intent actually goes (template/dataset/screen/CTA) is admin-
// configurable via the Lab's Demo Setup page - see entryIntents.jsx's
// loadActiveDemoRoutes() and demo_routes. Only Workflow/Other's follow-up
// question, and the records-keeping question, are fixed shape, not admin-
// configurable (see needsTextPrompt).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { markVisited } from '../firstVisit'
import { track } from '../lib/onboardingEvents'
import { ENTRY_INTENTS, getEntryIntent, needsTextPrompt, loadActiveDemoRoutes, resolveWorkflowExample } from './entryIntents'
import WelcomeScreen from './WelcomeScreen'
import SetupSelection from './SetupSelection'
import IntentTextPrompt from './IntentTextPrompt'
import RecordsMethodPrompt from './RecordsMethodPrompt'
import GeneratingScreen from './GeneratingScreen'
import IntentDestination, { loadDestinationData } from './IntentDestination'

export const ONBOARDING_STORAGE_KEY = 'verticals_onboarding'

function saveIntent(payload) {
  try { sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload)) } catch { /* private mode */ }
}

// Persistent, hard-to-miss top-right auth entry point - present on every
// stage but Welcome (which already has its own full-width Get started/Sign
// in buttons), including while looking at the demo itself. One header
// instead of special-casing just the destination screen.
function AuthHeader({ onCreateAccount, onSignIn }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      padding: '0.65rem clamp(1rem, 4vw, 2rem)',
      background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      position: 'sticky', top: 0, zIndex: 260,
    }}>
      <img src="/verticals-logo.png" alt="Verticals" style={{ height: 20, width: 'auto' }} />
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button type="button" className="secondary" onClick={onSignIn} style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}>
          Sign in
        </button>
        <button type="button" onClick={onCreateAccount} style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem', fontWeight: 700 }}>
          Create account
        </button>
      </div>
    </header>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [stage, setStage] = useState('welcome') // welcome | selection | text_prompt | records_method | generating | destination
  const [selectedId, setSelectedId] = useState(null)
  const [customText, setCustomText] = useState('')
  const [recordsMethod, setRecordsMethod] = useState(null)
  const [destinationState, setDestinationState] = useState(null) // resolved by loadDestinationData, handed to IntentDestination once GeneratingScreen finishes
  // null while loading, then either the fetched map or 'all' meaning "show
  // every intent" (the fetch failed - see loadActiveDemoRoutes's own note).
  const [routesById, setRoutesById] = useState(null)
  // Set only when Workflow/Other's typed answer matches a seeded workflow
  // example (resolveWorkflowExample) - takes priority over the intent's own
  // (empty) demo_routes entry when present. Cleared on every fresh
  // selection so a stale match from a previous attempt never leaks in.
  const [matchedRoute, setMatchedRoute] = useState(null)
  const dataPromiseRef = useRef(null) // in-flight loadDestinationData() call, kicked off from the records-method step
  // A second, harder-to-miss nudge toward Create account once they've had a
  // moment to actually look at the destination screen - the persistent
  // header button is easy to tune out entirely on a first look.
  const [showNudge, setShowNudge] = useState(false)

  useEffect(() => {
    track('started_onboarding')
    loadActiveDemoRoutes().then(result => setRoutesById(result || 'all'))
  }, [])

  useEffect(() => {
    if (stage !== 'destination') { setShowNudge(false); return }
    const timer = setTimeout(() => setShowNudge(true), 4500)
    return () => clearTimeout(timer)
  }, [stage])

  const intent = getEntryIntent(selectedId)
  const route = routesById && routesById !== 'all' ? routesById[selectedId] : null
  const visibleIntents = routesById === 'all' || !routesById
    ? ENTRY_INTENTS
    : ENTRY_INTENTS.filter(i => routesById[i.id])

  function handleContinueFromSelection() {
    if (!selectedId) return
    track('selected_intent', { entryIntent: selectedId })
    setMatchedRoute(null)
    setStage(needsTextPrompt(selectedId) ? 'text_prompt' : 'records_method')
  }

  async function handleContinueFromTextPrompt() {
    if (!selectedId || !customText.trim()) return
    const match = await resolveWorkflowExample(customText.trim())
    setMatchedRoute(match)
    setStage('records_method')
  }

  function handleContinueFromRecordsMethod() {
    if (!recordsMethod) return
    track('selected_records_method', { entryIntent: selectedId, recordsMethod })
    track('opened_demo', { entryIntent: selectedId, customIntentText: customText.trim() || undefined })
    dataPromiseRef.current = loadDestinationData(matchedRoute || route)
    setStage('generating')
  }

  function handleGeneratingDone(resolvedState) {
    setDestinationState(resolvedState)
    setStage('destination')
  }

  function handleCreateWorkspace() {
    if (!selectedId) return
    saveIntent({
      entry_intent: selectedId,
      custom_intent_text: customText.trim() || undefined,
      current_records_method: recordsMethod || undefined,
    })
    markVisited()
    navigate('/signup')
  }

  function handleSkip() {
    markVisited()
    navigate('/signup')
  }

  const generatingLabel = (customText.trim() || intent?.label || 'new').toLowerCase()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {stage !== 'welcome' && (
        <AuthHeader onCreateAccount={handleCreateWorkspace} onSignIn={() => navigate('/login')} />
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

      {stage === 'records_method' && (
        <RecordsMethodPrompt value={recordsMethod} onChange={setRecordsMethod} onContinue={handleContinueFromRecordsMethod} />
      )}

      {stage === 'generating' && (
        <GeneratingScreen label={generatingLabel} dataPromise={dataPromiseRef.current} onDone={handleGeneratingDone} />
      )}

      {stage === 'destination' && (
        <>
          <IntentDestination state={destinationState} customIntentText={customText.trim()} />
          {showNudge && (
            <div style={{
              position: 'fixed', left: '50%', bottom: '1.1rem', transform: 'translateX(-50%)', zIndex: 280,
              display: 'flex', alignItems: 'center', gap: '0.8rem', maxWidth: 'calc(100vw - 2rem)',
              background: 'var(--color-text)', color: 'var(--color-bg)', borderRadius: 999,
              padding: '0.6rem 0.6rem 0.6rem 1.1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Like what you see? Make it yours.</span>
              <button
                type="button"
                onClick={handleCreateWorkspace}
                style={{ fontSize: '0.85rem', padding: '0.45rem 1rem', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setShowNudge(false)}
                aria-label="Dismiss"
                style={{
                  background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer',
                  fontSize: '1.1rem', lineHeight: 1, padding: '0 0.3rem',
                }}
              >
                ×
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
