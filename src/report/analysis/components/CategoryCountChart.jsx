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
export function categoryCountTiles({ categoryField, submissions, amountField }) {
  const { countData, sumData } = aggregate({ categoryField, submissions, amountField })
  if (countData.length === 0) return []
  const base = `catcount-${categoryField.id}`
  const tiles = [
    { id: `${base}-count`, title: `Responses by ${categoryField.label}`, node: <HorizontalBarChart data={countData} bare /> },
  ]
  if (sumData.length > 0) {
    tiles.unshift({
      id: `${base}-sum`,
      title: `${amountField.label} by ${categoryField.label}`,
      node: <HorizontalBarChart data={sumData} formatValue={(v) => formatNaira(v)} bare />,
    })
  }
  return tiles
}
