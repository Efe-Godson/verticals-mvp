// Conditional Flow Engine - React binding.
//
// useFlow(flow) holds the answers and hands back the *resolved* (visibility-
// filtered) flow plus setters. Because `resolved` is a useMemo over
// `answers`, changing any earlier answer instantly re-resolves every
// downstream step, field and option - no manual wiring per branch.
//
//   const { answers, resolved, actions, setAnswer, toggleAnswer, progress }
//     = useFlow(myFlow)
//
// `pruneHidden` (default true) drops answers whose field is no longer
// visible, so a branch you back out of and re-enter starts clean and
// summaries never read a stale answer.

import { useCallback, useMemo, useState } from 'react'
import { resolveFlow, resolveActions, stepProgress, pruneHiddenAnswers } from './engine'

export function useFlow(flow, { initialAnswers = {}, pruneHidden = true } = {}) {
  const [answers, setRawAnswers] = useState(initialAnswers)

  const setAnswers = useCallback((updater) => {
    setRawAnswers((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return pruneHidden ? pruneHiddenAnswers(flow, next) : next
    })
  }, [flow, pruneHidden])

  const setAnswer = useCallback((fieldId, value) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }, [setAnswers])

  const toggleAnswer = useCallback((fieldId, value) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[fieldId]) ? prev[fieldId] : []
      return {
        ...prev,
        [fieldId]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      }
    })
  }, [setAnswers])

  const reset = useCallback(() => setRawAnswers(initialAnswers), [initialAnswers])

  const resolved = useMemo(() => resolveFlow(flow, answers), [flow, answers])
  const actions = useMemo(() => resolveActions(flow, answers), [flow, answers])
  const progress = useMemo(() => stepProgress(resolved, answers), [resolved, answers])

  return { answers, resolved, actions, progress, setAnswer, toggleAnswer, setAnswers, reset }
}
