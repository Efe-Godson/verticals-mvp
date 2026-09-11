// Place at: src/onboarding/RecordsMethodPrompt.jsx
// "How do you currently keep records?" - the one other question the whole
// flow asks, right before the demo. Same card-grid visual language as
// SetupSelection.jsx (active state: brand border + soft tint + check) - a
// second, differently-styled card grid two screens later would feel like a
// different product. Genuinely valuable data, not just UI theater: it's
// what Verticals is replacing for this visitor (see the design brief this
// was built from - "46% of new users previously relied on notebooks").
const RECORDS_METHODS = [
  { id: 'notebook_paper', label: 'Notebook / Paper', emoji: '📓' },
  { id: 'spreadsheet', label: 'Excel / Google Sheets', emoji: '📊' },
  { id: 'pos_app', label: 'Another App / POS', emoji: '💻' },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
  { id: 'memory', label: 'Mostly from memory', emoji: '🧠' },
  { id: 'none', label: "I don't currently keep records", emoji: '○' },
]

export default function RecordsMethodPrompt({ value, onChange, onContinue }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(1.5rem, 5vw, 3rem) 1.1rem 3rem' }}>
      <style>{`
        .records-method-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
      `}</style>

      <h1 style={{ margin: '0 0 1.4rem', fontSize: 'clamp(1.4rem, 4.5vw, 1.7rem)', textAlign: 'center' }}>
        How do you currently keep records?
      </h1>

      <div className="records-method-grid">
        {RECORDS_METHODS.map(method => {
          const active = value === method.id
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onChange(method.id)}
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
              <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{method.emoji}</span>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{method.label}</span>
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
    </div>
  )
}
