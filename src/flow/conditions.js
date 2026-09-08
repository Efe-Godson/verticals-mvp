// Conditional Flow Engine - condition evaluation.
//
// A *condition* decides whether something (a step, a field, an option, an
// action) applies, given the answers collected so far. It's a small tree:
//
//   leaf:   { field, op, value }
//   group:  { all: [cond, ...] }   - every child must pass
//           { any: [cond, ...] }   - at least one child must pass
//           { not: cond }          - child must NOT pass
//   sugar:  [cond, ...]            - bare array == { all: [...] }
//   null / undefined               - always true
//
// `answers` is a plain map { [fieldId]: value }, where a value is a string,
// number, boolean, or an array (multi-select). This module is pure - no
// React, no Forms/onboarding specifics - so any Verticals workflow can use
// it (Forms branching, onboarding, future rule builders).

export function isEmpty(v) {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  return false
}

const asArray = (v) => (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v])

// Supported leaf operators. Kept deliberately small and composable.
const OPS = {
  eq: (a, v) => (Array.isArray(a) ? a.includes(v) : a === v),
  ne: (a, v) => (Array.isArray(a) ? !a.includes(v) : a !== v),
  includes: (a, v) => asArray(a).includes(v),
  includesAny: (a, v) => asArray(v).some((x) => asArray(a).includes(x)),
  includesAll: (a, v) => asArray(v).every((x) => asArray(a).includes(x)),
  in: (a, v) => asArray(v).includes(a),
  gt: (a, v) => Number(a) > Number(v),
  gte: (a, v) => Number(a) >= Number(v),
  lt: (a, v) => Number(a) < Number(v),
  lte: (a, v) => Number(a) <= Number(v),
  // Count operators - for "only ask this if they picked more than one".
  countGte: (a, v) => asArray(a).length >= Number(v),
  countLte: (a, v) => asArray(a).length <= Number(v),
  countEq: (a, v) => asArray(a).length === Number(v),
  answered: (a) => !isEmpty(a),
  empty: (a) => isEmpty(a),
}

export const CONDITION_OPS = Object.keys(OPS)

function evaluateLeaf(cond, answers) {
  const { field, op = 'eq', value } = cond
  const fn = OPS[op]
  if (!fn) {
    if (import.meta.env?.DEV) console.warn(`[flow] unknown condition op: ${op}`)
    return false
  }
  return !!fn(answers[field], value)
}

export function evaluateCondition(cond, answers) {
  if (cond === null || cond === undefined) return true
  if (Array.isArray(cond)) return cond.every((c) => evaluateCondition(c, answers))
  if (cond.all) return cond.all.every((c) => evaluateCondition(c, answers))
  if (cond.any) return cond.any.some((c) => evaluateCondition(c, answers))
  if (cond.not) return !evaluateCondition(cond.not, answers)
  return evaluateLeaf(cond, answers)
}

// Every field id a condition tree reads - useful for "which answers, when
// changed, could affect this?" (e.g. targeted re-evaluation later).
export function conditionFields(cond, out = new Set()) {
  if (!cond) return out
  if (Array.isArray(cond)) { cond.forEach((c) => conditionFields(c, out)); return out }
  if (cond.all) { cond.all.forEach((c) => conditionFields(c, out)); return out }
  if (cond.any) { cond.any.forEach((c) => conditionFields(c, out)); return out }
  if (cond.not) return conditionFields(cond.not, out)
  if (cond.field) out.add(cond.field)
  return out
}
