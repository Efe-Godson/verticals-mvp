// Place at: src/report/analysis/components/CategoryCountChart.jsx
// Sibling to CartCategoryChart.jsx, for forms with no cart field at all -
// Report.jsx's whole category-breakdown charting system used to require
// one (chartTiles built salesByCategoryPairs as a cart x category
// cartesian product), so a non-cart form like Expenses or a survey never
// got a single pie/bar chart no matter how much data it had. This counts
// responses per category value instead of attributing cart revenue - and
// where the form has a designated amount field (settings.reportAmountField,
// same one Expenses' own dashboard already reads via
// src/expenses/expenseFields.js), also sums that field per value, so an
// Expenses report can show "spend by category" instead of just "entries
// by category".
import HorizontalBarChart from '../../components/HorizontalBarChart'
import { getFieldValues, formatNaira } from '../../helpers/analysisUtils'

function aggregate({ categoryField, submissions, amountField }) {
  const countGroups = {}
  const sumGroups = {}
  let totalCount = 0
  let totalSum = 0

  submissions.forEach(sub => {
    const values = getFieldValues(sub, categoryField)
    if (values.length === 0) return
    const amount = amountField ? Number(sub.data[amountField.id]) || 0 : 0
    values.forEach(val => {
      countGroups[val] = (countGroups[val] || 0) + 1
      totalCount += 1
      if (amountField) {
        sumGroups[val] = (sumGroups[val] || 0) + amount
        totalSum += amount
      }
    })
  })

  const countData = Object.entries(countGroups)
    .map(([label, count]) => ({ label, count, percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  const sumData = amountField
    ? Object.entries(sumGroups)
        .map(([label, sum]) => ({ label, count: sum, percent: totalSum > 0 ? Math.round((sum / totalSum) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
    : []

  return { countData, sumData }
}

// Separate tile descriptors for the Reports page, same convention as
// cartCategoryTiles - the sum-by-value chart only appears when there's an
// amount field to sum.
export function categoryCountTiles({ categoryField, submissions, amountField, noun = { plural: 'Responses' } }) {
  const { countData, sumData } = aggregate({ categoryField, submissions, amountField })
  if (countData.length === 0) return []
  const base = `catcount-${categoryField.id}`
  const unitLabel = `${categoryField.label.toLowerCase()}s`

  // Focus Mode drill-down (brief §15): the records behind one category value.
  function getRecords(val) {
    return submissions
      .filter(sub => getFieldValues(sub, categoryField).includes(val))
      .map(sub => ({
        date: new Date(sub.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        ...(amountField ? { amount: Number(sub.data[amountField.id]) || 0 } : {}),
      }))
  }
  const recordColumns = [
    { key: 'date', label: 'Date', align: 'left', sortable: true },
    ...(amountField ? [{ key: 'amount', label: amountField.label, align: 'right', sortable: true, format: r => formatNaira(r.amount) }] : []),
  ]

  const countTitle = `${noun.plural} by ${categoryField.label}`
  const tiles = [
    {
      id: `${base}-count`,
      title: countTitle,
      node: (
        <HorizontalBarChart
          data={countData} bare focusTitle={countTitle} unitLabel={categoryField.label.toLowerCase() + ' values'}
          sourceLabel={noun.plural} getRecords={getRecords} recordColumns={recordColumns}
        />
      ),
    },
  ]
  if (sumData.length > 0) {
    const sumTitle = `${amountField.label} by ${categoryField.label}`
    tiles.unshift({
      id: `${base}-sum`,
      title: sumTitle,
      node: (
        <HorizontalBarChart
          data={sumData} formatValue={(v) => formatNaira(v)} bare focusTitle={sumTitle} unitLabel={categoryField.label.toLowerCase() + ' values'}
          sourceLabel={noun.plural} getRecords={getRecords} recordColumns={recordColumns}
        />
      ),
    })
  }
  return tiles
}
