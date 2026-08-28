// Place at: src/report/engine/fieldMeta.js
// Single source of truth for how the Report Builder classifies a form's
// fields. The rest of the app has ~5 divergent copies of these lists
// (Report.jsx, analysisUtils.js, pivotEngine.js, CrossAnalysis.jsx); this
// one is authoritative for everything under src/report/engine and
// src/report/builder. It intentionally matches Report.jsx's set (autocomplete
// counts as categorical) rather than analysisUtils.js's narrower one.

export const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox', 'autocomplete']
export const NUMERIC_TYPES = ['number', 'rating', 'linearscale']
export const DATE_TYPES = ['date']
// Fields that carry no single-cell analytical value on their own.
const OPAQUE_TYPES = ['section', 'fileupload', 'time', 'multiplechoicegrid', 'checkboxgrid', 'longtext']

// role: 'dimension' (group by), 'measure' (aggregate), 'date' (group by, with
// granularity), 'cart' (special measure source: revenue / qty), 'text'
// (dimension-only, high cardinality), 'opaque' (not offered).
export function fieldRole(field) {
  if (!field || !field.type) return 'opaque'
  if (field.type === 'cart') return 'cart'
  if (DATE_TYPES.includes(field.type)) return 'date'
  if (NUMERIC_TYPES.includes(field.type)) return 'measure'
  if (CATEGORICAL_TYPES.includes(field.type)) return 'dimension'
  if (['text', 'email', 'phone', 'linked_record', 'location'].includes(field.type)) return 'text'
  return 'opaque'
}

export function fieldTypeLabel(field) {
  const role = fieldRole(field)
  if (role === 'measure') return 'number'
  if (role === 'date') return 'date'
  if (role === 'cart') return 'order'
  if (role === 'dimension') return 'category'
  if (role === 'text') return 'text'
  return field.type
}

// Everything the Data panel lists, tagged so the config panel can offer the
// right bindings. Sections and opaque types are dropped.
export function listFields(form) {
  return (form?.fields || [])
    .filter(f => f && f.type !== 'section' && !OPAQUE_TYPES.includes(f.type))
    .map(f => ({ id: f.id, label: f.label || f.id, type: f.type, role: fieldRole(f), field: f }))
}

export function dimensionFields(form) {
  return listFields(form).filter(f => f.role === 'dimension' || f.role === 'date' || f.role === 'text')
}

export function measureFields(form) {
  return listFields(form).filter(f => f.role === 'measure')
}

export function cartFields(form) {
  return listFields(form).filter(f => f.role === 'cart')
}

export function findField(form, fieldId) {
  return (form?.fields || []).find(f => f.id === fieldId) || null
}
