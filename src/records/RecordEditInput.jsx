export function RecordEditInput({ field, value, onChange }) {
  if (field.type === 'linked_record') {
    // Editing this inline would need to re-fetch the linked form's records
    // (RecordEditInput has no access to the other form's data) — shown
    // read-only here for now; edit it from the linked form's own record.
    return (
      <input
        type="text"
        value={value?.label || ''}
        disabled
        style={{ padding: '0.5rem', width: '100%', color: 'var(--color-muted)' }}
      />
    )
  }
  if (field.type === 'longtext') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '0.5rem', width: '100%', minHeight: '70px' }}
      />
    )
  }
  if (field.type === 'dropdown') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ padding: '0.5rem', width: '100%' }}>
        <option value="">Select an option</option>
        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }
  if (field.type === 'multiplechoice') {
    return (
      <div>
        {field.options?.map(opt => (
          <label key={opt} style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'normal' }}>
            <input
              type="radio"
              name={`edit-${field.id}`}
              checked={value === opt}
              onChange={() => onChange(opt)}
            /> {opt}
          </label>
        ))}
      </div>
    )
  }
  const inputType =
    field.type === 'number' ? 'number' :
    field.type === 'email' ? 'email' :
    field.type === 'phone' ? 'tel' :
    field.type === 'date' ? 'date' :
    'text'
  return (
    <input
      type={inputType}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '0.5rem', width: '100%' }}
    />
  )
}
