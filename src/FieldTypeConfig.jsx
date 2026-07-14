const TYPES_WITH_GRID = ['multiplechoicegrid', 'checkboxgrid']

function updateListField(field, index, updateField, key, text) {
  const items = text.split(',').map(o => o.trim()).filter(o => o !== '')
  updateField(index, { [`${key}Text`]: text, [key]: items })
}

// Renders the extra builder inputs a field type needs beyond label/type/options —
// grid rows & columns, scale range, star count, or upload constraints.
function FieldTypeConfig({ field, index, updateField }) {
  if (TYPES_WITH_GRID.includes(field.type)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.3rem' }}>
        <input
          type="text"
          value={field.rowsText !== undefined ? field.rowsText : (field.rows || []).join(', ')}
          onChange={(e) => updateListField(field, index, updateField, 'rows', e.target.value)}
          placeholder="Rows (questions), comma separated e.g. Quality, Price, Service"
          style={{ padding: '0.5rem' }}
        />
        <input
          type="text"
          value={field.columnsText !== undefined ? field.columnsText : (field.columns || []).join(', ')}
          onChange={(e) => updateListField(field, index, updateField, 'columns', e.target.value)}
          placeholder="Columns (options), comma separated e.g. Poor, Average, Good"
          style={{ padding: '0.5rem' }}
        />
      </div>
    )
  }

  if (field.type === 'linearscale') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
        <input
          type="number"
          placeholder="Min (e.g. 1)"
          value={field.scaleMin ?? ''}
          onChange={(e) => updateField(index, { scaleMin: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ flex: 1, padding: '0.4rem', minWidth: '80px' }}
        />
        <input
          type="number"
          placeholder="Max (e.g. 5)"
          value={field.scaleMax ?? ''}
          onChange={(e) => updateField(index, { scaleMax: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ flex: 1, padding: '0.4rem', minWidth: '80px' }}
        />
        <input
          type="text"
          placeholder="Min label (optional)"
          value={field.minLabel ?? ''}
          onChange={(e) => updateField(index, { minLabel: e.target.value })}
          style={{ flex: 2, padding: '0.4rem', minWidth: '120px' }}
        />
        <input
          type="text"
          placeholder="Max label (optional)"
          value={field.maxLabel ?? ''}
          onChange={(e) => updateField(index, { maxLabel: e.target.value })}
          style={{ flex: 2, padding: '0.4rem', minWidth: '120px' }}
        />
      </div>
    )
  }

  if (field.type === 'rating') {
    return (
      <div style={{ marginTop: '0.3rem' }}>
        <input
          type="number"
          min="2"
          max="10"
          placeholder="Number of stars (default 5)"
          value={field.maxStars ?? ''}
          onChange={(e) => updateField(index, { maxStars: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ padding: '0.4rem', width: '220px' }}
        />
      </div>
    )
  }

  if (field.type === 'fileupload') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Accepted file types e.g. .pdf,.jpg,.png (optional)"
          value={field.acceptTypes ?? ''}
          onChange={(e) => updateField(index, { acceptTypes: e.target.value })}
          style={{ flex: 2, padding: '0.4rem', minWidth: '200px' }}
        />
        <input
          type="number"
          min="1"
          placeholder="Max size MB (default 5)"
          value={field.maxSizeMB ?? ''}
          onChange={(e) => updateField(index, { maxSizeMB: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ flex: 1, padding: '0.4rem', minWidth: '140px' }}
        />
      </div>
    )
  }

  return null
}

export default FieldTypeConfig
