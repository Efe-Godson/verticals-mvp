// Lab page for the pre-signup onboarding prototype. Wraps the shared
// OnboardingScreens flow with Lab-only bits: Start over, a full-screen
// Simulate popup, and a secondary "collected data" debug view. No Supabase,
// no signup - "Create my workspace" only toasts.
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../Toast'
import LabSidePanel from '../../LabSidePanel'
import Modal from '../../components/Modal'
import OnboardingScreens from './OnboardingScreens'
import { buildInternalFeatures } from './recommendations'

const SESSION_STARTED_AT = new Date().toISOString()

export default function OnboardingPrototype() {
  const { showToast } = useToast()
  const [runId, setRunId] = useState(0)          // bump to reset the Lab flow
  const [labAnswers, setLabAnswers] = useState({})
  const [showData, setShowData] = useState(false)

  const [simOpen, setSimOpen] = useState(false)
  const [simRunId, setSimRunId] = useState(0)
  const [simDone, setSimDone] = useState(false)

  const onAnswersChange = useCallback((a) => setLabAnswers(a), [])

  const collected = useMemo(() => ({
    ...labAnswers,
    // Internal only - never shown to the customer. The recommendation
    // engine maps outcome cards to these real Verticals capabilities.
    _internal_features: buildInternalFeatures(labAnswers),
    _system: {
      started_at: SESSION_STARTED_AT,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      converted: false,
    },
  }), [labAnswers])

  function startOver() {
    setRunId((n) => n + 1)
    setShowData(false)
  }

  function openSim() {
    setSimDone(false)
    setSimRunId((n) => n + 1)
    setSimOpen(true)
  }

  return (
    <>
      <LabSidePanel />
      <div className="page" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: '0 0 0.2rem' }}>Onboarding prototype</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to="/lab/demo-data"><button type="button" className="secondary" style={{ fontSize: '0.85rem' }}>🎬 See demo data</button></Link>
            <button type="button" onClick={openSim} style={{ fontSize: '0.85rem' }}>▶ Simulate</button>
            <button type="button" className="secondary" onClick={startOver} style={{ fontSize: '0.85rem' }}>Start over</button>
          </div>
        </div>
        <p style={{ marginTop: 0, color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          Lab only. Four short screens on the shared conditional-flow engine - change an earlier answer and the
          focus question, Step&nbsp;4 summary and recommendations re-resolve. Nothing is saved.
        </p>

        <div style={{ marginTop: '1.5rem' }}>
          <OnboardingScreens
            key={runId}
            onAnswersChange={onAnswersChange}
            onComplete={() => {
              showToast('Prototype - no account or workspace is created. Signup would start here.', 'info')
              setShowData(true)
            }}
          />
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '2rem', paddingTop: '1rem' }}>
          <button
            type="button" className="secondary" onClick={() => setShowData((v) => !v)}
            style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}
          >
            {showData ? 'Hide' : 'Show'} collected data (debug)
          </button>
          {showData && (
            <pre style={{
              marginTop: '0.8rem', padding: '0.9rem', borderRadius: 8, overflowX: 'auto',
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              fontSize: '0.76rem', lineHeight: 1.5,
            }}>
              {JSON.stringify(collected, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {simOpen && (
        <Modal size="full" title="Simulation preview" onClose={() => setSimOpen(false)}>
          <p style={{ margin: '0 0 1.4rem', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
            This is how the flow would feel to a new customer. Prototype only - nothing is saved.
          </p>

          {simDone ? (
            <div style={{ maxWidth: 480, margin: '2rem auto', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem' }}>✓</div>
              <h2 style={{ margin: '0.4rem 0' }}>That's the whole flow</h2>
              <p style={{ color: 'var(--color-muted)' }}>
                In production this is where the account is created, the first business is set up, and the
                recommended workflows are configured.
              </p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '1.2rem', flexWrap: 'wrap' }}>
                <Link to="/lab/demo-data"><button type="button">See demo data →</button></Link>
                <button type="button" className="secondary" onClick={() => { setSimDone(false); setSimRunId((n) => n + 1) }}>Run again</button>
                <button type="button" className="secondary" onClick={() => setSimOpen(false)}>Close</button>
              </div>
            </div>
          ) : (
            <OnboardingScreens key={simRunId} onComplete={() => setSimDone(true)} />
          )}
        </Modal>
      )}
    </>
  )
}
