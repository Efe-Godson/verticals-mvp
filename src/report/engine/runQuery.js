// Place at: src/report/engine/runQuery.js
// THE ENGINE. Visual Configuration -> Query Builder -> Analytics Engine ->
// Standard Result (brief §11). One function turns a query config + a set of
// submissions into a shape-stable result that any renderer (bar / line /
// pie / donut / table / pivot / scatter / kpi) can draw without re-running
// analytical logic. Generalises src/report/helpers/pivotEngine.js.
import { getFieldValues } from '../helpers/analysisUtils'
import { findField, fieldRole } from './fieldMeta'
import { bucketDate } from './dateBuckets'
import { aggregateValues } from './aggregate'
import { computePopulationStats, enrichRows } from './populationStats'

const NULL_LABEL = '—'

// ---- metric --------------------------------------------------------------

// The raw number one submission contributes toward the metric, or null when
// it has nothing to contribute (unanswered number field, empty cart) - null
// is dropped, never coerced to 0, so averages aren't dragged down.
function metricValue(sub, query, form) {
  if (!query.metric) return 1 // count
  const field = findField(form, query.metric)
  if (!field) return null

  if (field.type === 'cart') {
    const v = sub.data[query.metric]
    if (!v || !Array.isArray(v.items) || v.items.length === 0) return null
    if (query.cartMode === 'qty') return v.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    return (Number(v.total) || 0) + (Number(v.deliveryFee) || 0) // revenue (grand total)
  }

  const n = Number(sub.data[query.metric])
  return isNaN(n) ? null : n
}

function effectiveAggregation(query) {
  if (!query.metric) return 'count'
  return query.aggregation || 'sum'
}

function metricRole(query, form) {
  if (!query.metric) return 'count'
  const field = findField(form, query.metric)
  if (field?.type === 'cart') return query.cartMode === 'qty' ? 'cartQty' : 'cartRevenue'
  return 'number'
}

// ---- dimension ---------------------------------------------------------

// [{ key, label }] this submission falls into for the given dimension field.
// Multi-valued for checkbox fields; date fields bucket by granularity.
function dimensionKeys(sub, field, granularity) {
  if (!field) return [{ key: '__all__', label: 'All' }]
  if (field.type === 'date') {
    const b = bucketDate(sub.data[field.id], granularity || 'month')
    return b ? [b] : []
  }
  const role = fieldRole(field)
  if (role === 'dimension') {
    return getFieldValues(sub, field).map(v => ({ key: String(v), label: String(v) }))
  }
  // text-ish
  const raw = sub.data[field.id]
  if (raw === undefined || raw === null || raw === '') return [{ key: NULL_LABEL, label: NULL_LABEL }]
  if (typeof raw === 'object') {
    const label = raw.label || [raw.city, raw.state, raw.country].filter(Boolean).join(', ') || JSON.stringify(raw)
    return [{ key: String(label), label: String(label) }]
  }
  return [{ key: String(raw), label: String(raw) }]
}

// ---- filters ---------------------------------------------------------

function passesVisualFilters(sub, filters, form) {
  if (!filters || filters.length === 0) return true
  return filters.every(f => {
    const field = findField(form, f.fieldId)
    if (!field) return true
    const raw = sub.data[f.fieldId]
    if (f.op === 'in' || f.op === 'eq') {
      const want = Array.isArray(f.value) ? f.value : [f.value]
      const have = field.type === 'checkbox' && Array.isArray(raw) ? raw : [raw]
      return have.some(h => want.map(String).includes(String(h)))
    }
    if (f.op === 'not') {
      return String(raw) !== String(f.value)
    }
    const n = Number(raw)
    if (f.op === 'gt') return n > Number(f.value)
    if (f.op === 'lt') return n < Number(f.value)
    if (f.op === 'gte') return n >= Number(f.value)
    if (f.op === 'lte') return n <= Number(f.value)
    if (f.op === 'between') return n >= Number(f.value) && n <= Number(f.value2)
    if (f.op === 'contains') return String(raw ?? '').toLowerCase().includes(String(f.value).toLowerCase())
    return true
  })
}

// ---- sort / topN ----------------------------------------------------

function applySortTopN(rows, query) {
  const sorted = [...rows]
  const sort = query.sort || 'metric-desc'
  sorted.sort((a, b) => {
    if (sort === 'label-asc') return String(a.label).localeCompare(String(b.label))
    if (sort === 'label-desc') return String(b.label).localeCompare(String(a.label))
    if (sort === 'metric-asc') return a.value - b.value
    return b.value - a.value // metric-desc
  })
  const n = Number(query.topN)
  return n && n > 0 ? sorted.slice(0, n) : sorted
}

// Date dimensions read better in chronological order regardless of sort.
function sortChronological(rows) {
  return [...rows].sort((a, b) => String(a.key).localeCompare(String(b.key)))
}

// ---- percentMode transform for matrices ---------------------------

function applyPercentMode(matrix, mode) {
  if (!mode) return matrix
  const { rowLabels, colLabels, cells, rowTotals, colTotals, grandTotal } = matrix
  const out = { ...matrix, cells: {}, percentMode: mode }
  rowLabels.forEach(r => {
    out.cells[r] = {}
    colLabels.forEach(c => {
      const v = cells[r]?.[c] || 0
      let denom = grandTotal
      if (mode === 'row') denom = rowTotals[r] || 0
      if (mode === 'col') denom = colTotals[c] || 0
      out.cells[r][c] = denom ? (v / denom) * 100 : 0
    })
  })
  return out
}

// ---- main -----------------------------------------------------------

// query: {
//   metric, aggregation, cartMode, dimension, secondaryDimension,
//   dateGranularity, sort, topN, filters,
//   rows[], cols[], values[], showRowTotals, showColTotals, showGrandTotal, percentMode,
//   scatterX, scatterY, kind
// }
// context: { form, submissions, previousSubmissions? }
export function runQuery(query, context) {
  const { form } = context
  const agg = effectiveAggregation(query)
  const role = metricRole(query, form)

  const submissions = (context.submissions || []).filter(s =>
    passesVisualFilters(s, query.filters, form))

  const usedIds = new Set()

  // --- scatter -----------------------------------------------------
  if (query.kind === 'scatter') {
    const xf = findField(form, query.scatterX)
    const yf = findField(form, query.scatterY)
    const labelF = findField(form, query.dimension)
    const points = []
    submissions.forEach(s => {
      const x = Number(s.data[query.scatterX])
      const y = Number(s.data[query.scatterY])
      if (isNaN(x) || isNaN(y)) return
      usedIds.add(s.id)
      points.push({
        x, y, submissionId: s.id,
        label: labelF ? (dimensionKeys(s, labelF)[0]?.label ?? '') : '',
      })
    })
    return {
      kind: 'scatter', points,
      axes: { x: xf?.label || 'X', y: yf?.label || 'Y' },
      count: points.length,
      population: computePopulationStats(points.map(p => p.y)),
      sourceSubmissionIds: [...usedIds],
      query, metricRole: role,
    }
  }

  // --- records (raw data table) ---------------------------------
  if (query.kind === 'records') {
    return {
      kind: 'records',
      records: submissions.map(s => ({ id: s.id, created_at: s.created_at, data: s.data })),
      count: submissions.length,
      sourceSubmissionIds: submissions.map(s => s.id),
      query, metricRole: role,
    }
  }

  // --- matrix (pivot / secondary dimension) --------------------
  const isMatrix = query.kind === 'pivot' || !!query.secondaryDimension ||
    (Array.isArray(query.rows) && Array.isArray(query.cols) && query.cols.length > 0)

  const rowFieldId = query.kind === 'pivot' ? (query.rows || [])[0] : query.dimension
  const colFieldId = query.kind === 'pivot' ? (query.cols || [])[0] : query.secondaryDimension
  const rowField = findField(form, rowFieldId)
  const colField = findField(form, colFieldId)

  if (isMatrix && rowField) {
    const buckets = {} // row -> col -> raw values
    const rawBuckets = {} // row -> col -> raw dimension values (for distinct)
    submissions.forEach(s => {
      const mv = metricValue(s, query, form)
      if (mv === null) return
      const rk = dimensionKeys(s, rowField, query.dateGranularity)
      const ck = colField ? dimensionKeys(s, colField, query.dateGranularity) : [{ key: '__v__', label: '' }]
      if (rk.length === 0 || ck.length === 0) return
      usedIds.add(s.id)
      rk.forEach(r => ck.forEach(c => {
        buckets[r.key] = buckets[r.key] || {}
        buckets[r.key][c.key] = buckets[r.key][c.key] || []
        buckets[r.key][c.key].push(mv)
        rawBuckets[r.key] = rawBuckets[r.key] || {}
        rawBuckets[r.key][c.key] = rawBuckets[r.key][c.key] || []
        rawBuckets[r.key][c.key].push(s.data[query.metric])
      }))
    })

    const rowKeys = Object.keys(buckets)
    const colKeys = [...new Set(rowKeys.flatMap(r => Object.keys(buckets[r])))]
    const cells = {}
    const rowTotals = {}
    const colFlat = {}
    rowKeys.forEach(r => {
      cells[r] = {}
      const all = []
      colKeys.forEach(c => {
        const vals = buckets[r][c] || []
        cells[r][c] = aggregateValues(agg, vals, rawBuckets[r]?.[c])
        all.push(...vals)
        colFlat[c] = (colFlat[c] || []).concat(vals)
      })
      rowTotals[r] = aggregateValues(agg, all)
    })
    const colTotals = {}
    colKeys.forEach(c => { colTotals[c] = aggregateValues(agg, colFlat[c] || []) })
    const grandTotal = aggregateValues(agg, rowKeys.flatMap(r => colKeys.flatMap(c => buckets[r][c] || [])))

    const rowIsDate = rowField.type === 'date'
    const rowLabelByKey = {}
    const colLabelByKey = {}
    submissions.forEach(s => {
      dimensionKeys(s, rowField, query.dateGranularity).forEach(k => { rowLabelByKey[k.key] = k.label })
      if (colField) dimensionKeys(s, colField, query.dateGranularity).forEach(k => { colLabelByKey[k.key] = k.label })
    })

    const rowLabels = rowIsDate
      ? rowKeys.sort((a, b) => String(a).localeCompare(String(b)))
      : rowKeys.sort((a, b) => rowTotals[b] - rowTotals[a])
    const colLabels = colField && colField.type === 'date'
      ? colKeys.sort((a, b) => String(a).localeCompare(String(b)))
      : colKeys.sort((a, b) => colTotals[b] - colTotals[a])

    let matrix = {
      rowLabels: rowLabels.map(k => rowLabelByKey[k] || k),
      colLabels: colLabels.map(k => colLabelByKey[k] || k),
      rowKeys: rowLabels,
      colKeys: colLabels,
      cells: Object.fromEntries(rowLabels.map(rk => [
        rowLabelByKey[rk] || rk,
        Object.fromEntries(colLabels.map(ck => [colLabelByKey[ck] || ck, cells[rk]?.[ck] || 0])),
      ])),
      rowTotals: Object.fromEntries(rowLabels.map(rk => [rowLabelByKey[rk] || rk, rowTotals[rk] || 0])),
      colTotals: Object.fromEntries(colLabels.map(ck => [colLabelByKey[ck] || ck, colTotals[ck] || 0])),
      grandTotal,
      percentMode: null,
    }
    matrix = applyPercentMode(matrix, query.percentMode)

    // Also emit a grouped series (row = category, series = column) so
    // grouped/stacked bar + multi-line can render off the same result.
    const seriesLabels = matrix.colLabels
    const groupedRows = matrix.rowLabels.map((rl, i) => {
      const bySeries = {}
      seriesLabels.forEach(sl => { bySeries[sl] = matrix.cells[rl]?.[sl] || 0 })
      return { key: matrix.rowKeys[i], label: rl, value: matrix.rowTotals[rl] || 0, bySeries }
    })

    return {
      kind: 'matrix',
      matrix,
      rows: groupedRows,
      seriesLabels,
      total: grandTotal,
      count: usedIds.size,
      population: computePopulationStats(groupedRows.map(r => r.value)),
      perRow: enrichRows(groupedRows, computePopulationStats(groupedRows.map(r => r.value))),
      sourceSubmissionIds: [...usedIds],
      query, metricRole: role, aggregation: agg,
    }
  }

  // --- scalar (KPI, no dimension) -----------------------------
  if (!rowField) {
    const values = []
    const raw = []
    submissions.forEach(s => {
      const mv = metricValue(s, query, form)
      if (mv === null) return
      usedIds.add(s.id)
      values.push(mv)
      raw.push(s.data[query.metric])
    })
    const value = aggregateValues(agg, values, raw)

    let comparison
    if (context.previousSubmissions) {
      const prevVals = []
      context.previousSubmissions
        .filter(s => passesVisualFilters(s, query.filters, form))
        .forEach(s => { const mv = metricValue(s, query, form); if (mv !== null) prevVals.push(mv) })
      const prev = aggregateValues(agg, prevVals)
      comparison = {
        previous: prev,
        delta: value - prev,
        percent: prev !== 0 ? Math.round(((value - prev) / prev) * 100) : undefined,
        direction: value >= prev ? 'up' : 'down',
      }
    }

    return {
      kind: 'scalar',
      scalar: { value, comparison },
      total: value,
      count: usedIds.size,
      population: computePopulationStats(values),
      sourceSubmissionIds: [...usedIds],
      query, metricRole: role, aggregation: agg,
    }
  }

  // --- series (one dimension) --------------------------------
  const buckets = {}
  const rawBuckets = {}
  const labelByKey = {}
  submissions.forEach(s => {
    const mv = metricValue(s, query, form)
    if (mv === null) return
    const keys = dimensionKeys(s, rowField, query.dateGranularity)
    if (keys.length === 0) return
    usedIds.add(s.id)
    keys.forEach(k => {
      labelByKey[k.key] = k.label
      buckets[k.key] = buckets[k.key] || []
      buckets[k.key].push(mv)
      rawBuckets[k.key] = rawBuckets[k.key] || []
      rawBuckets[k.key].push(s.data[query.metric])
    })
  })

  let rows = Object.keys(buckets).map(key => ({
    key,
    label: labelByKey[key] ?? key,
    value: aggregateValues(agg, buckets[key], rawBuckets[key]),
  }))

  rows = rowField.type === 'date' ? sortChronological(rows) : applySortTopN(rows, query)

  const flat = Object.values(buckets).flat()
  const total = aggregateValues(agg, flat)
  const stats = computePopulationStats(rows.map(r => r.value))

  return {
    kind: 'series',
    rows,
    perRow: enrichRows(rows, stats),
    seriesLabels: null,
    total,
    count: usedIds.size,
    population: stats,
    sourceSubmissionIds: [...usedIds],
    query, metricRole: role, aggregation: agg,
  }
}
