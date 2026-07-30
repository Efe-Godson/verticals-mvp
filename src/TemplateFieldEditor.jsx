// Place at: src/TemplateFieldEditor.jsx
// Compact field-list editor used when building or editing a template. Fields
// are edited in place (no separate "pick an existing form" step) so a
// template doesn't need a throwaway real form behind it. `linkTargets` is
// what a "Linked Record" field on this list can point at: either the
// admin's real forms (single-form templates) or sibling bundle entries
// (multi-form templates), both shaped as [{ id, name, fields }].
const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'longtext', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiplechoice', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'linked_record', label: 'Linked Record' },
  { value: 'autocomplete', label: 'Autocomplete' },
  { value: 'location', label: 'Location (Country/State/City)' },
]

const TYPES_WITH_OPTIONS = ['dropdown', 'multiplechoice', 'checkbox', 'autocomplete']

function newField() {
  return { id: 'f' + Date.now() + Math.random().toString(36).slice(2, 6), type: 'text', label: '', required: false }
}

function TemplateFieldEditor({ fields, onChange, linkTargets = [] }) {
  function updateField(index, patch) {
    onChange(fields.map((f, i) => i === index ? { ...f, ...patch } : f))
  }
  function addField() {
    onChange([...fields, newField()])
  }
  function removeField(index) {
    onChange(fields.filter((_, i) => i !== index))
  }
  function moveField(index, dir) {
    const target = index + dir
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {fields.map((field, index) => {
        const linkedTarget = linkTargets.find(t => t.id === field.linkedFormId)
        return (
          <div key={field.id} className="card" style={{ padding: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="Field label"
                style={{ flex: '2 1 140px', padding: '0.4rem' }}
              />
              <select value={field.type} onChange={(e) => updateField(index, { type: e.target.value, options: undefined, linkedFormId: undefined, linkedDisplayFieldId: undefined })} style={{ flex: '1 1 120px', padding: '0.4rem' }}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={!!field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
                Required
              </label>
              <button type="button" className="secondary" disabled={index === 0} onClick={() => moveField(index, -1)} style={{ padding: '0.3rem 0.5rem' }}>↑</button>
              <button type="button" className="secondary" disabled={index === fields.length - 1} onClick={() => moveField(index, 1)} style={{ padding: '0.3rem 0.5rem' }}>↓</button>
              <button type="button" className="secondary" style={{ color: '#c0392b', padding: '0.3rem 0.5rem' }} onClick={() => removeField(index)}>✕</button>
            </div>

            {TYPES_WITH_OPTIONS.includes(field.type) && (
              <input
                type="text"
                value={field.optionsText !== undefined ? field.optionsText : (field.options || []).join(', ')}
                onChange={(e) => {
                  const text = e.target.value
                  updateField(index, { optionsText: text, options: text.split(',').map(o => o.trim()).filter(Boolean) })
                }}
                placeholder="Options, comma separated"
                style={{ padding: '0.4rem' }}
              />
            )}

            {field.type === 'linked_record' && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <select
                  value={field.linkedFormId || ''}
                  onChange={(e) => updateField(index, { linkedFormId: e.target.value || undefined, linkedDisplayFieldId: undefined })}
                  style={{ flex: 1, padding: '0.4rem' }}
                >
                  <option value="">Link to...</option>
                  {linkTargets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {linkedTarget && (
                  <select
                    value={field.linkedDisplayFieldId || ''}
                    onChange={(e) => updateField(index, { linkedDisplayFieldId: e.target.value || undefined })}
                    style={{ flex: 1, padding: '0.4rem' }}
                  >
                    <option value="">Field to display...</option>
                    {(linkedTarget.fields || []).filter(f => f.type !== 'cart' && f.type !== 'section').map(f => (
                      <option key={f.id} value={f.id}>{f.label || '(untitled)'}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button type="button" className="secondary" onClick={addField}>+ Add Field</button>
    </div>
  )
}

export default TemplateFieldEditor
