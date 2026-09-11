// Place at: src/onboarding/RecordsMethodPrompt.jsx
// "How do you currently keep records?" - the one other question the whole
// flow asks, right before the demo. Same card-grid visual language as
// SetupSelection.jsx (active state: brand border + soft tint + check) - a
// second, differently-styled card grid two screens later would feel like a
// different product. Genuinely valuable data, not just UI theater: it's
// what Verticals is replacing for this visitor (see the design brief this
// was built from - "46% of new users previously relied on notebooks").
const RECORDS_METHODS = [
  { id: 'notebook_paper', label: 'Notebook / Paper', icon: 'notebook' },
  { id: 'spreadsheet', label: 'Excel / Google Sheets', icon: 'spreadsheet' },
  { id: 'pos_app', label: 'Another App / POS', icon: 'pos_app' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
  { id: 'memory', label: 'Mostly from memory', icon: 'memory' },
  { id: 'none', label: "I don't currently keep records", icon: 'none' },
]

// Same flat, single-color line-icon convention as entryIntents.jsx's
// EntryIntentIcon (24x24 viewBox, stroke only, no fill, 1.6 stroke width) -
// this screen used emoji before, which read as a visibly different, less
// polished style right next to Setup Selection's flat icons in the same flow.
function RecordsMethodIcon({ id, color = 'currentColor', size = 26 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (id) {
    case 'notebook':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M5 7h3M9 11h6M9 15h6" />
        </svg>
      )
    case 'spreadsheet':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M4 9h16M9 9v11" />
        </svg>
      )
    case 'pos_app':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 18h6" />
          <path d="M8 7h8v5H8z" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg {...common}>
          <path d="M12 21c-1.4 0-2.7-.35-3.9-1L4 21l1.05-4a8 8 0 1 1 6.95 4Z" />
          <path d="M8.5 10.2c0 3 2.3 5.3 5.3 5.3" />
        </svg>
      )
    case 'memory':
      return (
        <svg {...common}>
          <path d="M9 3a4 4 0 0 0-3.9 5A4 4 0 0 0 6 15.6V19a2 2 0 0 0 2 2h1v-3" />
          <path d="M15 3a4 4 0 0 1 3.9 5A4 4 0 0 1 18 15.6V19a2 2 0 0 1-2 2h-1v-3" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      )
    default: // 'none'
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
  }
}

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
              <RecordsMethodIcon id={method.icon} color={active ? 'var(--color-primary)' : 'var(--color-text)'} />
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
