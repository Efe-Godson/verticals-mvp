export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'specific', label: 'Pick a date' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisweek', label: 'This week' },
  { value: 'lastweek', label: 'Last week' },
  { value: 'thismonth', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: '12months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

// Monday, matching how a week actually reads on a calendar - not the rolling
// "7 days back from whatever moment it happens to be" a plain -7-days offset
// gives you, which cuts a week in half and calls it "this week."
function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() // 0 = Sun ... 6 = Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1) - day)
  return d
}

export function getDateRangeBounds(range, customStart, customEnd) {
  if (range === 'all') return { start: null, end: null }

  const now = new Date()
  let start = null

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (range === 'yesterday') {
    // Unlike the other presets (start bound only, open-ended up to now),
    // Yesterday needs both ends pinned to that one day, or it'd silently
    // include everything from yesterday through right now.
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
    return { start: yesterdayStart, end: yesterdayEnd }
  } else if (range === 'thisweek') {
    start = startOfWeek(now)
  } else if (range === 'lastweek') {
    const thisWeekStart = startOfWeek(now)
    const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() - 1); lastWeekEnd.setHours(23, 59, 59)
    return { start: lastWeekStart, end: lastWeekEnd }
  } else if (range === 'thismonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (range === 'lastmonth') {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) // day 0 of this month = last day of the previous one
    return { start: lastMonthStart, end: lastMonthEnd }
  } else if (range === '3months') {
    start = new Date(now); start.setMonth(start.getMonth() - 3)
  } else if (range === '6months') {
    start = new Date(now); start.setMonth(start.getMonth() - 6)
  } else if (range === '12months') {
    start = new Date(now); start.setFullYear(start.getFullYear() - 1)
  } else if (range === 'specific') {
    // One clearly-labeled single-date picker, kept separate from Custom
    // range - customStart doubles as the picked day here (Custom range's
    // own start/end still work independently of this).
    return {
      start: customStart ? new Date(customStart) : null,
      end: customStart ? new Date(customStart + 'T23:59:59') : null,
    }
  } else if (range === 'custom') {
    return {
      start: customStart ? new Date(customStart) : null,
      end: customEnd ? new Date(customEnd + 'T23:59:59') : (customStart ? new Date(customStart + 'T23:59:59') : null),
    }
  }

  return { start, end: null }
}


// True when a cell holds nothing worth showing - mirrors Records.jsx's
// hasValue(), negated. Used for the "(Blanks)" filter option and to push
// empty cells to the end when sorting.
export function isBlankValue(v) {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return !Object.values(v).some(x => x !== null && x !== undefined && x !== '')
  return String(v).trim() === ''
}

// The plain-text form of a cell, matching what formatCell() renders on
// screen so the value list in the column menu lines up with the table.
export function valueDisplayString(value, field) {
  if (isBlankValue(value)) return ''
  switch (field.type) {
    case 'date': {
      const d = new Date(value)
      return isNaN(d) ? String(value) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    case 'number': {
      const n = Number(value)
      return isNaN(n) ? String(value) : n.toLocaleString()
    }
    case 'linked_record':
      return value?.label ? String(value.label) : ''
    case 'location':
      return [value.city, value.state, value.country].filter(Boolean).join(', ')
    default:
      if (Array.isArray(value)) return value.join(', ')
      if (typeof value === 'object') return Object.values(value).filter(Boolean).join(', ')
      return String(value)
  }
}

// Comparator for column sort. Blanks always sink to the bottom regardless of
// direction (how a spreadsheet behaves); everything else compares by number,
// timestamp, or locale string depending on the field type.
export function makeSortComparator(field, dir) {
  const mult = dir === 'desc' ? -1 : 1
  const key = (sub) => {
    const v = sub.data?.[field.id]
    if (isBlankValue(v)) return null
    if (field.type === 'number') { const n = Number(v); return isNaN(n) ? null : n }
    if (field.type === 'date') { const t = new Date(v).getTime(); return isNaN(t) ? null : t }
    return valueDisplayString(v, field).toLowerCase()
  }
  return (a, b) => {
    const ka = key(a), kb = key(b)
    if (ka === null && kb === null) return 0
    if (ka === null) return 1
    if (kb === null) return -1
    if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * mult
    return String(ka).localeCompare(String(kb)) * mult
  }
}

export function passesFilter(sub, field, filter) {
  const value = sub.data[field.id]

  // Excel-style value picker: a set of ticked values plus an optional
  // "(Blanks)" and a contains-text box. `values: null` means "any non-blank".
  if (filter.kind === 'values') {
    if (isBlankValue(value)) return !!filter.includeBlanks
    const disp = valueDisplayString(value, field)
    if (filter.text && !disp.toLowerCase().includes(filter.text.toLowerCase())) return false
    if (filter.values == null) return true
    return filter.values.includes(disp)
  }

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
  if (field.type === 'linked_record') {
    return (value.label || '').toString().toLowerCase().includes((filter.value || '').toLowerCase())
  }
  if (field.type === 'location') {
    const combined = [value.city, value.state, value.country].filter(Boolean).join(' ').toLowerCase()
    return combined.includes((filter.value || '').toLowerCase())
  }
  return value.toString().toLowerCase().includes((filter.value || '').toLowerCase())
}
