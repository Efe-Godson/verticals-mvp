// Place at: src/onboarding/SetupSelection.jsx
// "What are you looking to set up?" - single-select card grid, no step
// counter, no progress bar, no description text under each card (the icon +
// title should be enough on their own, per the design brief this was built
// from). Max 2 columns on mobile even though there are 7 cards - the grid
// just runs to 4 rows there rather than shrinking tiles to fit more per row.
import { ENTRY_INTENTS, EntryIntentIcon } from './entryIntents'

export default function SetupSelection({ value, onChange, onContinue, onSkip }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(1.5rem, 5vw, 3rem) 1.1rem 3rem' }}>
      <style>{`
        .entry-intent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; }
        @media (max-width: 640px) { .entry-intent-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <h1 style={{ margin: '0 0 1.4rem', fontSize: 'clamp(1.4rem, 4.5vw, 1.7rem)', textAlign: 'center' }}>
        What are you looking to set up?
      </h1>

      <div className="entry-intent-grid">
        {ENTRY_INTENTS.map(intent => {
          const active = value === intent.id
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => onChange(intent.id)}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '0.6rem', padding: '1.3rem 0.8rem', minHeight: 108,
                borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                background: active ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '999px',
                  background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.7rem', lineHeight: 1,
                }}>
                  ✓
                </span>
              )}
              <EntryIntentIcon id={intent.icon} color={active ? 'var(--color-primary)' : 'var(--color-muted)'} />
              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{intent.label}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!value}
        style={{ width: '100%', marginTop: '1.8rem', padding: '0.9rem', fontSize: '1rem', fontWeight: 600, opacity: value ? 1 : 0.55 }}
      >
        Continue →
      </button>

      <button
        type="button"
        onClick={onSkip}
        style={{
          display: 'block', width: '100%', margin: '0.9rem auto 0', padding: '0.5rem',
          background: 'transparent', border: 'none', color: 'var(--color-muted)',
          fontSize: '0.85rem', textAlign: 'center', textDecoration: 'underline', cursor: 'pointer',
        }}
      >
        Skip for now
      </button>
    </div>
  )
}
