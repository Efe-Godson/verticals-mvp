import { describe, it, expect } from 'vitest'
import { evaluateCondition } from './conditions'
import { resolveFlow, resolveActions, isStepComplete, pruneHiddenAnswers } from './engine'

describe('evaluateCondition', () => {
  it('treats null/undefined as always true', () => {
    expect(evaluateCondition(null, {})).toBe(true)
    expect(evaluateCondition(undefined, {})).toBe(true)
  })

  it('eq matches scalars and array membership', () => {
    expect(evaluateCondition({ field: 'a', op: 'eq', value: 'x' }, { a: 'x' })).toBe(true)
    expect(evaluateCondition({ field: 'a', op: 'eq', value: 'x' }, { a: ['y', 'x'] })).toBe(true)
    expect(evaluateCondition({ field: 'a', op: 'eq', value: 'x' }, { a: 'y' })).toBe(false)
  })

  it('includes / includesAny work on multi-select arrays', () => {
    const ans = { goals: ['sales', 'staff'] }
    expect(evaluateCondition({ field: 'goals', op: 'includes', value: 'sales' }, ans)).toBe(true)
    expect(evaluateCondition({ field: 'goals', op: 'includes', value: 'money' }, ans)).toBe(false)
    expect(evaluateCondition({ field: 'goals', op: 'includesAny', value: ['money', 'staff'] }, ans)).toBe(true)
  })

  it('countGte gates on how many were picked', () => {
    expect(evaluateCondition({ field: 'g', op: 'countGte', value: 2 }, { g: ['a'] })).toBe(false)
    expect(evaluateCondition({ field: 'g', op: 'countGte', value: 2 }, { g: ['a', 'b'] })).toBe(true)
  })

  it('all / any / not compose', () => {
    const ans = { a: 'x', n: 5 }
    expect(evaluateCondition({ all: [{ field: 'a', op: 'eq', value: 'x' }, { field: 'n', op: 'gt', value: 3 }] }, ans)).toBe(true)
    expect(evaluateCondition({ any: [{ field: 'a', op: 'eq', value: 'z' }, { field: 'n', op: 'gt', value: 3 }] }, ans)).toBe(true)
    expect(evaluateCondition({ not: { field: 'a', op: 'eq', value: 'x' } }, ans)).toBe(false)
  })
})

const flow = {
  id: 't',
  steps: [
    {
      id: 's1',
      fields: [
        { id: 'goals', type: 'multiselect', required: true, options: [{ value: 'sales' }, { value: 'staff' }] },
        { id: 'primary', type: 'single', visibleWhen: { field: 'goals', op: 'countGte', value: 2 }, optionsFrom: { field: 'goals' } },
      ],
    },
    {
      id: 's2',
      visibleWhen: { field: 'goals', op: 'includes', value: 'sales' },
      fields: [
        {
          id: 'sales_gaps', type: 'multiselect', options: [
            { value: 'top' },
            { value: 'by_location', visibleWhen: { field: 'goals', op: 'includes', value: 'staff' } },
          ],
        },
      ],
    },
  ],
  actions: [
    { when: { field: 'goals', op: 'includes', value: 'sales' }, recommend: 'sales-tracking' },
    { when: { field: 'goals', op: 'includes', value: 'money' }, recommend: 'money' },
  ],
}

describe('resolveFlow', () => {
  it('hides a step whose visibleWhen fails', () => {
    expect(resolveFlow(flow, {}).steps.map((s) => s.id)).toEqual(['s1'])
    expect(resolveFlow(flow, { goals: ['sales'] }).steps.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('hides a field whose visibleWhen fails, and filters its options', () => {
    const r = resolveFlow(flow, { goals: ['sales'] })
    expect(r.steps[0].fields.map((f) => f.id)).toEqual(['goals']) // primary hidden (only 1 goal)
    expect(r.steps[1].fields[0].options.map((o) => o.value)).toEqual(['top']) // by_location needs staff

    const r2 = resolveFlow(flow, { goals: ['sales', 'staff'] })
    expect(r2.steps[0].fields.map((f) => f.id)).toEqual(['goals', 'primary'])
    expect(r2.steps[1].fields[0].options.map((o) => o.value)).toEqual(['top', 'by_location'])
  })

  it('optionsFrom mirrors another field\'s chosen values', () => {
    const r = resolveFlow(flow, { goals: ['sales', 'staff'] })
    const primary = r.steps[0].fields.find((f) => f.id === 'primary')
    expect(primary.options.map((o) => o.value)).toEqual(['sales', 'staff'])
  })
})

describe('resolveActions', () => {
  it('fires only conditions that pass, de-duped and ordered', () => {
    expect(resolveActions(flow, { goals: ['sales'] }).recommendations).toEqual(['sales-tracking'])
    expect(resolveActions(flow, { goals: [] }).recommendations).toEqual([])
  })
})

describe('isStepComplete', () => {
  it('is true only when every required visible field is answered', () => {
    const step = resolveFlow(flow, {}).steps[0]
    expect(isStepComplete(step, {})).toBe(false)
    expect(isStepComplete(step, { goals: ['sales'] })).toBe(true)
  })
})

describe('pruneHiddenAnswers', () => {
  it('drops answers whose field is no longer visible', () => {
    const withStale = { goals: ['staff'], sales_gaps: ['top'] } // s2 hidden (no sales)
    expect(pruneHiddenAnswers(flow, withStale)).toEqual({ goals: ['staff'] })
  })

  it('keeps everything when all fields are still visible', () => {
    const ok = { goals: ['sales', 'staff'], primary: 'sales', sales_gaps: ['top'] }
    expect(pruneHiddenAnswers(flow, ok)).toEqual(ok)
  })
})
