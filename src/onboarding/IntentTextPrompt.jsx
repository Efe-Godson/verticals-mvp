// Place at: src/onboarding/IntentTextPrompt.jsx
// The one follow-up question for "A Workflow" / "Something Else" - the only
// two entry intents where the brief allows a question before showing
// anything, since there's no real destination to route to without it.
// Placeholder examples rotate subtly while the field is empty; typed input
// takes over immediately and the rotation stops.
import { useEffect, useState } from 'react'

export default function IntentTextPrompt({ intent, value, onChange, onContinue }) {
  const examples = intent.placeholderExamples || []
  const [exampleIndex, setExampleIndex] = useState(0)

  useEffect(() => {
    if (examples.length < 2 || value) return
    const id = setInterval(() => setExampleIndex(i => (i + 1) % examples.length), 2600)
    return () => clearInterval(id)
  }, [examples.length, value])

  const placeholder = examples.length > 0 ? `e.g. ${examples[exampleIndex]}...` : ''

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ margin: '0 0 1.2rem', fontSize: 'clamp(1.4rem, 4.5vw, 1.7rem)', textAlign: 'center' }}>
          {intent.prompt}
        </h1>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onContinue() }}
          placeholder={placeholder}
          style={{ width: '100%', padding: '0.9rem 1rem', fontSize: '1rem' }}
        />
        <button
          type="button"
          onClick={onContinue}
          disabled={!value.trim()}
          style={{ width: '100%', marginTop: '1rem', padding: '0.9rem', fontSize: '1rem', fontWeight: 600, opacity: value.trim() ? 1 : 0.55 }}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
