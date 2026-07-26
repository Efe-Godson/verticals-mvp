// Place at: src/recordsImport.js
// Bulk-fill a form's records from a spreadsheet instead of one submission at
// a time — mirrors the "Download Template / Upload Filled Sheet" pattern
// already used for product carts in CreateForm.jsx, applied to whole
// submissions. Import-only field types (cart, fileupload, grids) are
// skipped since they don't have a sane single-cell spreadsheet shape.

import * as XLSX from 'xlsx'

const UNSUPPORTED_TYPES = ['cart', 'fileupload', 'multiplechoicegrid', 'checkboxgrid']

export function isImportableField(field) {
  return !UNSUPPORTED_TYPES.includes(field.type)
}

// `linkedOptionsByFieldId`: { [fieldId]: [{ recordId, label }] } — needed to
// resolve a linked_record column's text value back to a record id. Fetch
// this from the linked form's submissions before calling downloadTemplate
// (so the example row can show a real label) or parseFile.
export function downloadRecordsTemplate(form, linkedOptionsByFieldId = {}) {
  const fields = form.fields.filter(isImportableField)
  const exampleRow = {}
  fields.forEach(field => {
    if (field.type === 'date') exampleRow[field.label] = '2026-01-31'
    else if (field.type === 'number') exampleRow[field.label] = 0
    else if (field.type === 'dropdown' || field.type === 'multiplechoice') exampleRow[field.label] = field.options?.[0] || ''
    else if (field.type === 'checkbox') exampleRow[field.label] = (field.options || []).slice(0, 2).join(', ')
    else if (field.type === 'linked_record') exampleRow[field.label] = linkedOptionsByFieldId[field.id]?.[0]?.label || ''
    else exampleRow[field.label] = ''
  })

  const worksheet = XLSX.utils.json_to_sheet([exampleRow])
  worksheet['!cols'] = fields.map(() => ({ wch: 24 }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Records')
  XLSX.writeFile(workbook, `${form.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-fill-in-template.xlsx`)
}

function coerceCell(rawValue, field, linkedOptionsByFieldId) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return { value: undefined, warning: null }
  const text = rawValue.toString().trim()
  if (text === '') return { value: undefined, warning: null }

  if (field.type === 'number') {
    const num = Number(text)
    return isNaN(num) ? { value: undefined, warning: `"${text}" is not a number` } : { value: num, warning: null }
  }

  if (field.type === 'date') {
    // XLSX with cellDates:true hands us a JS Date for real date cells;
    // plain text cells (e.g. typed "2026-01-31") come through as a string.
    const date = rawValue instanceof Date ? rawValue : new Date(text)
    if (isNaN(date)) return { value: undefined, warning: `"${text}" is not a valid date` }
    return { value: date.toISOString().slice(0, 10), warning: null }
  }

  if (field.type === 'dropdown' || field.type === 'multiplechoice') {
    const match = field.options?.find(o => o.toLowerCase() === text.toLowerCase())
    return match ? { value: match, warning: null } : { value: undefined, warning: `"${text}" is not one of ${field.label}'s options` }
  }

  if (field.type === 'checkbox') {
    const parts = text.split(',').map(p => p.trim()).filter(Boolean)
    const matched = parts.map(p => field.options?.find(o => o.toLowerCase() === p.toLowerCase())).filter(Boolean)
    return { value: matched.length > 0 ? matched : undefined, warning: matched.length < parts.length ? `Some ${field.label} values didn't match its options` : null }
  }

  if (field.type === 'linked_record') {
    const options = linkedOptionsByFieldId[field.id] || []
    const match = options.find(o => (o.label || '').toString().toLowerCase() === text.toLowerCase())
    return match
      ? { value: { recordId: match.recordId, label: match.label }, warning: null }
      : { value: undefined, warning: `"${text}" was not found in ${field.label}'s linked records` }
  }

  return { value: text, warning: null }
}

// Returns { submissions: [{ data }], warnings: string[] }. Rows that end up
// with no fields filled in at all are skipped (treated as blank rows).
export function parseRecordsFile(rows, form, linkedOptionsByFieldId = {}) {
  const fields = form.fields.filter(isImportableField)
  const submissions = []
  const warnings = []

  rows.forEach((row, rowIndex) => {
    const data = {}
    let hasAnyValue = false

    fields.forEach(field => {
      const { value, warning } = coerceCell(row[field.label], field, linkedOptionsByFieldId)
      if (warning) warnings.push(`Row ${rowIndex + 2}: ${warning}`)
      if (value !== undefined) {
        data[field.id] = value
        hasAnyValue = true
      }
    })

    if (hasAnyValue) submissions.push({ data })
  })

  return { submissions, warnings }
}

export function readWorkbookRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(sheet))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsArrayBuffer(file)
  })
}
