import { useState } from 'react'

const TYPES_WITH_LENGTH_RULES = ['text', 'longtext']
const TYPES_WITH_NUMBER_RULES = ['number']
const TYPES_WITH_DATE_RULES = ['date']
const TYPES_WITH_TIME_RULES = ['time']
const TYPES_WITH_SELECTION_RULES = ['checkbox']
const TYPES_WITHOUT_VALIDATION = ['cart']

// Pattern borrowed from Google Forms / Jotform: Required is an always-visible
// toggle right on the field row. Everything else (length/value/date rules,
// custom error message) is collapsed behind "More options" and only expands
// on click — no boxed/nested card, just plain text within the field's own card.
function FieldValidationControls({ field, index, updateField }) {
  const [expanded, setExpanded] = useState(false)

  if (TYPES_WITHOUT_VALIDATION.includes(field.type)) return null

  return (
    <div style={{ marginTop: '0.4rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
          <span className="toggle">
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => updateField(index, { required: e.target.checked })}
            />
            <span className="toggle-slider" />
          </span>
          Required
        </label>

        <span
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: '0.8rem', color: 'var(--color-primary)', cursor: 'pointer', userSelect: 'none' }}
        >
          {expanded ? 'Hide options ▲' : 'More options ▾'}
        </span>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
          {TYPES_WITH_LENGTH_RULES.includes(field.type) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', minWidth: '90px' }}>Length</span>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={field.minLength ?? ''}
                onChange={(e) => updateField(index, { minLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={field.maxLength ?? ''}
                onChange={(e) => updateField(index, { maxLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
            </div>
          )}

          {TYPES_WITH_NUMBER_RULES.includes(field.type) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', minWidth: '90px' }}>Value range</span>
              <input
                type="number"
                placeholder="Min"
                value={field.min ?? ''}
                onChange={(e) => updateField(index, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
              <input
                type="number"
                placeholder="Max"
                value={field.max ?? ''}
                onChange={(e) => updateField(index, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
            </div>
          )}

          {TYPES_WITH_DATE_RULES.includes(field.type) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', minWidth: '90px' }}>Date range</span>
              <input
                type="date"
                value={field.minDate ?? ''}
                onChange={(e) => updateField(index, { minDate: e.target.value === '' ? undefined : e.target.value })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
              <input
                type="date"
                value={field.maxDate ?? ''}
                onChange={(e) => updateField(index, { maxDate: e.target.value === '' ? undefined : e.target.value })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
            </div>
          )}

          {TYPES_WITH_TIME_RULES.includes(field.type) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', minWidth: '90px' }}>Time range</span>
              <input
                type="time"
                value={field.minTime ?? ''}
                onChange={(e) => updateField(index, { minTime: e.target.value === '' ? undefined : e.target.value })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
              <input
                type="time"
                value={field.maxTime ?? ''}
                onChange={(e) => updateField(index, { maxTime: e.target.value === '' ? undefined : e.target.value })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
            </div>
          )}

          {TYPES_WITH_SELECTION_RULES.includes(field.type) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', minWidth: '90px' }}>Selections</span>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={field.minSelect ?? ''}
                onChange={(e) => updateField(index, { minSelect: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={field.maxSelect ?? ''}
                onChange={(e) => updateField(index, { maxSelect: e.target.value === '' ? undefined : Number(e.target.value) })}
                style={{ flex: 1, padding: '0.4rem' }}
              />
            </div>
          )}

          <input
            type="text"
            placeholder="Custom error message (optional)"
            value={field.errorMessage ?? ''}
            onChange={(e) => updateField(index, { errorMessage: e.target.value })}
            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
          />
        </div>
      )}
    </div>
  )
}

export default FieldValidationControls
