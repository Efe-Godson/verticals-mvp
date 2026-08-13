// Place at: src/MoreDetailsManager.jsx
// A cart-based form (Restaurant, Retail, ...) splits its non-cart fields
// into "pinned" (visible right after the catalogue) and "More Details"
// (collapsedInCheckout - tucked behind a "+ More details" toggle at
// checkout, see PublicForm.jsx's cartDefersCheckout rendering and the
// checkout modal's own collapsedInCheckout split). This is the one place
// that manages which is which: every field is pinnable/unpinnable from a
// single tile tray, plus recommended presets (Location, Customer Name, ...)
// that aren't on the form yet can be tapped to add them directly, and
// "+ Add yours" covers anything a preset doesn't.
const RECOMMENDED_FIELD_PRESETS = [
  { label: 'Location', type: 'location' },
  { label: 'Customer Name', type: 'text' },
  { label: 'Phone', type: 'phone' },
  { label: 'Email', type: 'email' },
  { label: 'Sales Person', type: 'text' },
  { label: 'Notes', type: 'longtext' },
]

function pillStyle(pinned) {
  return {
    fontSize: '0.78rem', padding: '0.35rem 0.75rem', borderRadius: '999px',
    borderStyle: pinned ? 'solid' : 'dashed',
  }
}

function presetKey(label, type) {
  return `${(label || '').trim().toLowerCase()}|${type}`
}

function MoreDetailsManager({ fields, setFields, addField, addPresetField }) {
  const configurable = fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type !== 'cart' && f.type !== 'section')

  const pinned = configurable.filter(({ f }) => !f.collapsedInCheckout)
  const unpinned = configurable.filter(({ f }) => f.collapsedInCheckout)

  const existingKeys = new Set(configurable.map(({ f }) => presetKey(f.label, f.type)))
  const recommended = RECOMMENDED_FIELD_PRESETS.filter(p => !existingKeys.has(presetKey(p.label, p.type)))

  function setPinned(index, isPinned) {
    setFields(fields.map((f, i) => i === index ? { ...f, collapsedInCheckout: !isPinned } : f))
  }

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1.1rem', background: 'var(--color-primary-soft)' }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>More Details</div>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.2rem 0 0.8rem' }}>
        Pinned fields show right after the catalogue. Everything else tucks behind "+ More details" at checkout - tap a tile to move it either way.
      </p>

      {pinned.length > 0 && (
        <>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>PINNED</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' }}>
            {pinned.map(({ f, i }) => (
              <button key={f.id} type="button" onClick={() => setPinned(i, false)} style={pillStyle(true)}>
                📌 {f.label || 'Untitled field'}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>MORE DETAILS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {unpinned.map(({ f, i }) => (
          <button key={f.id} type="button" className="secondary" onClick={() => setPinned(i, true)} style={pillStyle(true)}>
            {f.label || 'Untitled field'}
          </button>
        ))}
        {recommended.map(preset => (
          <button key={preset.label} type="button" className="secondary" onClick={() => addPresetField(preset)} style={pillStyle(false)}>
            + {preset.label}
          </button>
        ))}
        <button type="button" className="secondary" onClick={addField} style={{ ...pillStyle(false), fontWeight: 600 }}>
          + Add yours
        </button>
      </div>
    </div>
  )
}

export default MoreDetailsManager
