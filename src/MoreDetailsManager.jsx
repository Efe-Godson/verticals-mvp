// Place at: src/MoreDetailsManager.jsx
// A cart-based form (Restaurant, Retail, ...) splits its non-cart fields
// into "pinned" (shown on the order screen, right after the catalogue) and
// "More Details" (collapsedInCheckout). For a deferCheckout form (Retail)
// this is the ONLY place that split gets decided - whoever's taking an
// order never sees a reveal-more-fields control there anymore, an unpinned
// field simply isn't part of that screen at all (see PublicForm.jsx's
// cartDefersCheckout rendering). A normal embedded-checkout cart
// (Restaurant) still uses collapsedInCheckout for its own "+ More details"
// toggle inside the checkout modal, so pinning still matters there too.
// Every field is pinnable/unpinnable from a single tile tray here, plus
// recommended presets (Location, Customer Name, ...) that aren't on the
// form yet can be tapped to add them directly, and "+ Add yours" covers
// anything a preset doesn't.
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

// One pinned/unpinned tile: the label toggles pin state (the common case),
// a separate small ✎ segment opens that one field's full card below (type,
// required, validation) - two sibling buttons sharing a pill border rather
// than a button nested in a button, which isn't valid HTML.
function FieldTile({ label, pinned, onTogglePin, onEdit, editing }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', borderRadius: '999px', overflow: 'hidden',
      border: `1px solid ${editing ? 'var(--color-primary)' : 'var(--color-border)'}`,
      // A field label with no natural break points (one long word, or just
      // a long name) can't shrink on its own - cap it and ellipsize instead
      // of letting it force this tile, and the flex-wrap row it sits in,
      // wider than the phone screen (same overflow shape as the mobile
      // product grid bug, fixed the same way: bound the width explicitly).
      maxWidth: '100%',
    }}>
      <button
        type="button"
        onClick={onTogglePin}
        style={{
          border: 'none', borderRadius: 0, background: 'var(--color-surface)', color: 'var(--color-text)',
          fontSize: '0.78rem', padding: '0.35rem 0.7rem', minWidth: 0, maxWidth: '55vw',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {pinned ? '📌 ' : ''}{label}
      </button>
      <button
        type="button"
        onClick={onEdit}
        title="Edit field"
        style={{
          border: 'none', borderRadius: 0, borderLeft: '1px solid var(--color-border)',
          background: editing ? 'var(--color-primary-soft)' : '#f3f4f6', color: 'var(--color-muted)',
          fontSize: '0.75rem', padding: '0.35rem 0.5rem',
        }}
      >
        ✎
      </button>
    </div>
  )
}

function MoreDetailsManager({ fields, setFields, addField, addPresetField, editingFieldId, setEditingFieldId, renderFieldCard }) {
  const configurable = fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type !== 'cart' && f.type !== 'section')

  const pinned = configurable.filter(({ f }) => !f.collapsedInCheckout)
  const unpinned = configurable.filter(({ f }) => f.collapsedInCheckout)
  const editing = configurable.find(({ f }) => f.id === editingFieldId)

  const existingKeys = new Set(configurable.map(({ f }) => presetKey(f.label, f.type)))
  const recommended = RECOMMENDED_FIELD_PRESETS.filter(p => !existingKeys.has(presetKey(p.label, p.type)))

  function setPinned(index, isPinned) {
    setFields(fields.map((f, i) => i === index ? { ...f, collapsedInCheckout: !isPinned } : f))
  }

  function toggleEdit(fieldId) {
    setEditingFieldId(current => current === fieldId ? null : fieldId)
  }

  return (
    // No card of its own - the parent in EditForm.jsx already wraps this
    // (plus the "N pinned, M in More Details / Manage Details" summary
    // above it) in one shaded card, matching Manage Products' look. A
    // second nested card here would just double up the same border/shade.
    <div>
      {/* No separate heading here - "Manage Details" right above already
          said what this is; one short line is enough context, not a
          restatement of it plus a paragraph every time it's opened. */}
      <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
        Pinned fields appear on the order screen. Tap a tile to pin or unpin it, or ✎ to edit.
      </p>

      {pinned.length > 0 && (
        <>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>PINNED</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' }}>
            {pinned.map(({ f, i }) => (
              <FieldTile
                key={f.id}
                label={f.label || 'Untitled field'}
                pinned
                editing={editingFieldId === f.id}
                onTogglePin={() => setPinned(i, false)}
                onEdit={() => toggleEdit(f.id)}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>MORE DETAILS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: editing ? '0.9rem' : 0 }}>
        {unpinned.map(({ f, i }) => (
          <FieldTile
            key={f.id}
            label={f.label || 'Untitled field'}
            pinned={false}
            editing={editingFieldId === f.id}
            onTogglePin={() => setPinned(i, true)}
            onEdit={() => toggleEdit(f.id)}
          />
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

      {/* Only the one field being edited gets its full card shown - not
          every field at once, which just duplicated the tile tray above it
          with the same fields' names again. */}
      {editing && renderFieldCard(editing.f, editing.i)}
    </div>
  )
}

export default MoreDetailsManager
