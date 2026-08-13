// Shared by Report.jsx and AIAnalystPage.jsx so the two pages' date-range
// filtering can't drift out of sync. Mirrors records/recordsUtils.js's
// DATE_RANGE_OPTIONS/getDateRangeBounds (Records.jsx's own copy, kept
// separate since Records predates this file) - keep the two in sync if
// either changes.
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
    // range - customStart doubles as the picked day here.
    return {
      start: customStart ? new Date(customStart) : null,
      end: customStart ? new Date(customStart + 'T23:59:59') : null,
    }
  } else if (range === 'custom') {
    // Optional end: fill in just the start to filter to that one day, add
    // an end to turn it into a real range.
    return {
      start: customStart ? new Date(customStart) : null,
      end: customEnd ? new Date(customEnd + 'T23:59:59') : (customStart ? new Date(customStart + 'T23:59:59') : null),
    }
  }

  return { start, end: null }
}

export function getDateRangeLabel(dateRange, customStart, customEnd) {
  if (dateRange === 'all') return 'All time'
  if (dateRange === 'specific') return customStart || '…'
  if (dateRange === 'custom') return customEnd ? `${customStart || '…'} to ${customEnd}` : (customStart || '…')
  return DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || ''
}
