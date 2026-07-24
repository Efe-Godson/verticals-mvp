export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: '12months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

export function getDateRangeBounds(range, customStart, customEnd) {
  if (range === 'all') return { start: null, end: null }

  const now = new Date()
  let start = null

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (range === '7days') {
    start = new Date(now); start.setDate(start.getDate() - 7)
  } else if (range === '30days') {
    start = new Date(now); start.setDate(start.getDate() - 30)
  } else if (range === '3months') {
    start = new Date(now); start.setMonth(start.getMonth() - 3)
  } else if (range === '6months') {
    start = new Date(now); start.setMonth(start.getMonth() - 6)
  } else if (range === '12months') {
    start = new Date(now); start.setFullYear(start.getFullYear() - 1)
  } else if (range === 'custom') {
    return {
      start: customStart ? new Date(customStart) : null,
      end: customEnd ? new Date(customEnd + 'T23:59:59') : null
    }
  }

  return { start, end: null }
}

export function compareValues(a, b, field) {
  const valA = a.data[field.id]
  const valB = b.data[field.id]
  if (valA === undefined || valA === null || valA === '') return 1
  if (valB === undefined || valB === null || valB === '') return -1
  if (field.type === 'number') return Number(valA) - Number(valB)
  if (field.type === 'date') return new Date(valA) - new Date(valB)
  return valA.toString().localeCompare(valB.toString())
}

export function passesFilter(sub, field, filter) {
  const value = sub.data[field.id]
  if (field.type === 'number') {
    if (value === undefined || value === '') return false
    const num = Number(value)
    if (filter.condition === 'gt') return num > Number(filter.value)
    if (filter.condition === 'lt') return num < Number(filter.value)
    if (filter.condition === 'eq') return num === Number(filter.value)
    if (filter.condition === 'between') return num >= Number(filter.value) && num <= Number(filter.value2)
  }
  if (field.type === 'date') {
    if (!value) return false
    const d = new Date(value)
    if (filter.condition === 'before') return d < new Date(filter.value)
    if (filter.condition === 'after') return d > new Date(filter.value)
    if (filter.condition === 'between') return d >= new Date(filter.value) && d <= new Date(filter.value2)
  }
  if (field.type === 'dropdown' || field.type === 'multiplechoice') {
    if (!filter.selected || filter.selected.length === 0) return true
    return filter.selected.includes(value)
  }
  if (!value) return false
  return value.toString().toLowerCase().includes((filter.value || '').toLowerCase())
}
