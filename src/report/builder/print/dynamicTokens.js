// Place at: src/report/builder/print/dynamicTokens.js
// Dynamic values / {{token}} text (Designer 2.0 Phase 2). A text element's
// raw content can contain `{{token.path}}` placeholders; resolveTokens()
// replaces them with a live value computed from the report's own data at
// render time - reusing Report Builder's existing runQuery/datasets
// (buildDatasets(form, submissions), already computed once per
// PrintWorkspace render) rather than adding a second query engine, per the
// plan's own note that this needs no changes there.
//
// Kept deliberately small: a fixed token vocabulary rather than an
// arbitrary expression language, since every token has to be resolvable
// from data this report already has in memory.
import { formatNumber } from '../format'
import { formatNaira } from '../../helpers/analysisUtils'
import { runQuery } from '../../engine'

// Two patterns, not one reused with its lastIndex reset: a global regex's
// .test() is stateful (advances lastIndex on match), so calling hasTokens()
// and resolveTokens() on the same module-level regex would corrupt each
// other's match position across calls.
const TOKEN_RE_GLOBAL = /\{\{\s*([\w.]+)\s*\}\}/g
const TOKEN_RE_PROBE = /\{\{\s*([\w.]+)\s*\}\}/

function get(obj, path) {
  return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj)
}

// `context`: { form, scopedSubmissions } - the same values PrintWorkspace
// already computes for the whole workspace. Revenue/order-count go through
// runQuery (the same engine every visual uses) with cartMode: 'revenue',
// rather than re-deriving cart totals here - see runQuery.js's scalar
// branch for what `total`/`count` mean on its result.
export function buildTokenContext({ form, scopedSubmissions }) {
  const baseQuery = { metric: null, cartMode: 'revenue', dimension: null, filters: [] }
  let revenue = 0, orderCount = 0
  try {
    const result = runQuery({ ...baseQuery, aggregation: 'sum' }, { form, submissions: scopedSubmissions || [] })
    revenue = result?.total || 0
    orderCount = result?.count || 0
  } catch { /* leave zeros - a form with no cart field has nothing to sum */ }
  const today = new Date()
  return {
    metric: {
      totalRevenue: formatNaira(revenue),
      orderCount: formatNumber(orderCount),
      submissionCount: formatNumber((scopedSubmissions || []).length),
      avgOrderValue: formatNaira(orderCount ? revenue / orderCount : 0),
    },
    date: {
      today: today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      year: String(today.getFullYear()),
    },
    form: {
      name: form?.name || '',
    },
  }
}

export const AVAILABLE_TOKENS = [
  '{{metric.totalRevenue}}', '{{metric.orderCount}}', '{{metric.submissionCount}}', '{{metric.avgOrderValue}}',
  '{{date.today}}', '{{date.year}}', '{{form.name}}',
]

// Leaves an unresolvable token as literal text (e.g. `{{typo.here}}`) so a
// mistyped token is visibly wrong rather than silently vanishing.
export function resolveTokens(text, context) {
  if (!text || !context) return text
  return text.replace(TOKEN_RE_GLOBAL, (match, path) => {
    const value = get(context, path)
    return value === undefined ? match : String(value)
  })
}

export function hasTokens(text) {
  return !!text && TOKEN_RE_PROBE.test(text)
}
