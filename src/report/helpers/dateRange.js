// Shared by Report.jsx and AIAnalystPage.jsx so the two pages' date-range
// filtering can't drift out of sync.
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

export function getDateRangeLabel(dateRange, customStart, customEnd) {
  if (dateRange === 'all') return 'All time'
  if (dateRange === 'custom') return `${customStart || '…'} to ${customEnd || '…'}`
  return DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || ''
}
