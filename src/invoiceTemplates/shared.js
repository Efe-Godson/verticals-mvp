// Place at: src/invoiceTemplates/shared.js
// Pulled out of the old single-layout InvoiceModal.jsx so all 4 template
// styles (and InvoiceModal.jsx itself) format submission field values the
// same way, without duplicating this switch four times.

// A4Template-only (the 4 compact styles keep their existing plain
// toLocaleString() formatting unchanged, to avoid changing already-shipped
// designs).
export function formatCurrency(amount) {
  return `₦${Number(amount || 0).toLocaleString()}`
}

export function formatFieldValue(field, value) {
  if (Array.isArray(value)) return value.join(', ')
  if (field.type === 'multiplechoicegrid' && value && typeof value === 'object') {
    return Object.entries(value).map(([row, col]) => `${row}: ${col}`).join('; ')
  }
  if (field.type === 'checkboxgrid' && value && typeof value === 'object') {
    return Object.entries(value).map(([row, cols]) => `${row}: ${(cols || []).join(', ')}`).join('; ')
  }
  if (field.type === 'rating') return `${value} / ${field.maxStars ?? 5} stars`
  if (field.type === 'linked_record') return value?.label ? value.label.toString() : ''
  if (field.type === 'location') return [value?.city, value?.state, value?.country].filter(Boolean).join(', ')
  return value.toString()
}
