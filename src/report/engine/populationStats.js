// Place at: src/report/engine/populationStats.js
// The "context around the visual" the brief (§10) asks for - percentage of
// total, rank, contribution, distance from the mean - computed once by the
// engine so no chart component (and no AI call) re-derives basic stats.
import { median } from '../helpers/analysisUtils'

export function computePopulationStats(values) {
  const nums = values.map(Number).filter(n => !isNaN(n))
  if (nums.length === 0) {
    return { total: 0, count: 0, mean: 0, median: 0, min: 0, max: 0 }
  }
  const total = nums.reduce((a, b) => a + b, 0)
  return {
    total,
    count: nums.length,
    mean: total / nums.length,
    median: median(nums),
    min: Math.min(...nums),
    max: Math.max(...nums),
  }
}

// rows: [{ key, label, value }]. Returns a parallel array with the derived
// figures, plus writes them back onto each row object for convenience.
export function enrichRows(rows, stats) {
  const total = stats.total
  const mean = stats.mean
  const ranked = [...rows].sort((a, b) => b.value - a.value)
  const rankByKey = new Map(ranked.map((r, i) => [r.key, i + 1]))

  return rows.map(r => {
    const percentOfTotal = total !== 0 ? (r.value / total) * 100 : 0
    const diffFromMean = r.value - mean
    const pctDiffFromMean = mean !== 0 ? (diffFromMean / mean) * 100 : 0
    const enriched = {
      ...r,
      percentOfTotal,
      rank: rankByKey.get(r.key),
      diffFromMean,
      pctDiffFromMean,
      contribution: percentOfTotal,
    }
    return enriched
  })
}
