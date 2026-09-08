// Conditional Flow Engine - flow resolution.
//
// A *flow* is an ordered list of steps; each step has fields; each field may
// have options. Any of those three levels can carry a `visibleWhen`
// condition (see conditions.js) - that's the "show section / show question /
// show option based on a previous answer" capability, expressed
// declaratively so Forms, onboarding and future workflows share one system.
//
//   flow = {
//     id,
//     steps: [{
//       id, title, description,
//       visibleWhen,                       // condition | null
//       fields: [{
//         id, type, label, help, required,
//         visibleWhen,                     // condition | null
//         options: [{ value, label, help, visibleWhen }],
//         optionsFrom,                     // { field } - pull options from another
//                                          //   field's chosen values (label via its options)
//       }],
//     }],
//     actions: [{ when: condition, ...effect }],   // Question -> Condition -> Action
//   }
//
// resolveFlow(flow, answers) returns the *visible* shape for the current
// answers: steps filtered, each step's fields filtered, each field's options
// filtered. Pure - call it in a useMemo keyed on answers and the UI reacts.

import { evaluateCondition, isEmpty } from './conditions'

function resolveOptions(field, allFieldsById, answers) {
  let options = field.options || []

  // optionsFrom: mirror another field's selected values as this field's
  // options (e.g. "primary goal" picks from the goals you ticked).
  if (field.optionsFrom?.field) {
    const src = allFieldsById[field.optionsFrom.field]
    const chosen = answers[field.optionsFrom.field]
    const chosenArr = Array.isArray(chosen) ? chosen : isEmpty(chosen) ? [] : [chosen]
    const srcLabels = Object.fromEntries((src?.options || []).map((o) => [o.value, o.label]))
    options = chosenArr.map((v) => ({ value: v, label: srcLabels[v] || v }))
  }

  return options.filter((o) => evaluateCondition(o.visibleWhen, answers))
}

export function resolveFlow(flow, answers) {
  const allFieldsById = {}
  for (const step of flow.steps) {
    for (const f of step.fields || []) allFieldsById[f.id] = f
  }

  const steps = flow.steps
    .filter((step) => evaluateCondition(step.visibleWhen, answers))
    .map((step) => {
      const fields = (step.fields || [])
        .filter((f) => evaluateCondition(f.visibleWhen, answers))
        .map((f) => ({ ...f, options: resolveOptions(f, allFieldsById, answers) }))
      return { ...step, fields }
    })

  return { ...flow, steps }
}

// A visible field is "answered" when it has a non-empty value. optionsFrom /
// choice fields also count as answered only if the chosen value is still a
// visible option (so stale picks from a since-hidden branch don't block).
export function isFieldAnswered(field, answers) {
  const v = answers[field.id]
  if (isEmpty(v)) return false
  if (field.options && field.type !== 'text') {
    const valid = new Set(field.options.map((o) => o.value))
    if (Array.isArray(v)) return v.some((x) => valid.has(x))
    return valid.has(v)
  }
  return true
}

export function isStepComplete(step, answers) {
  return (step.fields || [])
    .filter((f) => f.required)
    .every((f) => isFieldAnswered(f, answers))
}

export function stepProgress(resolvedFlow, answers) {
  const steps = resolvedFlow.steps
  const done = steps.filter((s) => isStepComplete(s, answers)).length
  return { done, total: steps.length, complete: done === steps.length }
}

// Question -> Condition -> Action. Visibility is one kind of action expressed
// as `visibleWhen`; everything else (recommend a workflow, require a field,
// set a value, ...) lives here. For now only `recommend` is wired; the
// switch is the extension point.
export function resolveActions(flow, answers) {
  const out = { recommendations: [], recommendationEntries: [], required: [], values: {} }
  const seen = new Set()
  for (const action of flow.actions || []) {
    if (!evaluateCondition(action.when, answers)) continue
    if (action.recommend && !seen.has(action.recommend)) {
      seen.add(action.recommend)
      out.recommendations.push(action.recommend)
      out.recommendationEntries.push({ key: action.recommend, priority: action.priority ?? 1 })
    }
    if (action.require) out.required.push(action.require)
    if (action.set) Object.assign(out.values, action.set)
  }
  return out
}

// Convenience: clear answers whose parent condition no longer holds, so a
// re-shown branch starts clean and summaries never read a stale answer.
// Two levels:
//   - field hidden entirely      -> drop the answer
//   - a chosen option no longer  -> drop it (scalar) / filter it out (array),
//     visible (e.g. a since-       so `primary_interest` can't point at an
//     removed optionsFrom value)   interest that was un-picked
// (Opt-in - the hook calls this; the pure resolver above never mutates.)
export function pruneHiddenAnswers(flow, answers) {
  const resolved = resolveFlow(flow, answers)
  const visibleFieldById = {}
  for (const step of resolved.steps) {
    for (const f of step.fields) visibleFieldById[f.id] = f
  }

  let changed = false
  const next = {}
  for (const [k, v] of Object.entries(answers)) {
    const field = visibleFieldById[k]
    if (!field) { changed = true; continue }

    if (field.options && field.type !== 'text') {
      const valid = new Set(field.options.map((o) => o.value))
      if (Array.isArray(v)) {
        const filtered = v.filter((x) => valid.has(x))
        if (filtered.length !== v.length) changed = true
        next[k] = filtered
        continue
      }
      if (v !== '' && v !== undefined && !valid.has(v)) { changed = true; continue }
    }
    next[k] = v
  }
  return changed ? next : answers
}
