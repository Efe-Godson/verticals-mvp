// Place at: src/report/builder/useReportBuilder.js
// Loads the form + submissions, owns form.settings.reportBuilder, and
// exposes visual CRUD / promotion / builder-level filters. Persistence uses
// the same read-modify-write over the settings JSONB bag as Records.jsx /
// ReportBuilder.jsx (spread current settings first - it's shared).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { getDateRangeBounds } from '../helpers/dateRange'
import { buildDatasets } from '../engine'
import { makeVisual } from './catalogue'

const EMPTY_STATE = { visuals: [], builderFilters: { dateRange: 'all', customStart: '', customEnd: '', dimensionFilters: [] } }

function nextSlot(visuals, w, h) {
  // stack new visuals below everything currently placed
  const maxY = visuals.reduce((m, v) => Math.max(m, (v.layout?.y || 0) + (v.layout?.h || 0)), 0)
  return { x: 0, y: maxY, w, h }
}

export function useReportBuilder(formId) {
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const formRef = useRef(null)

  const [state, setState] = useState(EMPTY_STATE)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      const { data: formData, error: formErr } = await supabase.from('forms').select('*').eq('id', formId).single()
      if (cancelled) return
      if (formErr || !formData) { setError('Report not found.'); setLoading(false); return }
      formRef.current = formData
      setForm(formData)
      const rb = formData.settings?.reportBuilder
      setState(rb && Array.isArray(rb.visuals)
        ? { visuals: rb.visuals, builderFilters: { ...EMPTY_STATE.builderFilters, ...(rb.builderFilters || {}) } }
        : EMPTY_STATE)

      const { data: subs } = await supabase.from('submissions').select('*')
        .eq('form_id', formId).is('deleted_at', null).order('created_at', { ascending: true })
      if (cancelled) return
      setSubmissions(subs || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [formId])

  const persist = useCallback(async (nextState) => {
    setSaving(true)
    const current = formRef.current
    const updatedSettings = { ...(current.settings || {}), reportBuilder: { ...nextState, updatedAt: new Date().toISOString() } }
    const { error: wErr } = await supabase.from('forms').update({ settings: updatedSettings }).eq('id', current.id)
    setSaving(false)
    if (wErr) { setError('Could not save: ' + wErr.message); return { error: wErr } }
    const updatedForm = { ...current, settings: updatedSettings }
    formRef.current = updatedForm
    setForm(updatedForm)
    setDirty(false)
    return { error: null }
  }, [])

  // Write a shallow patch onto form.settings (outside the reportBuilder bag)
  // - used for e.g. datasetsSheetId once a Google Sheet is linked.
  const saveFormSetting = useCallback(async (patch) => {
    const current = formRef.current
    if (!current) return
    const updatedSettings = { ...(current.settings || {}), ...patch }
    await supabase.from('forms').update({ settings: updatedSettings }).eq('id', current.id)
    const updatedForm = { ...current, settings: updatedSettings }
    formRef.current = updatedForm
    setForm(updatedForm)
  }, [])

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Local mutation helper: update state immediately, mark dirty.
  const mutate = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return next
    })
    setDirty(true)
  }, [])

  const save = useCallback(() => persist(stateRef.current), [persist])

  // ---- visual CRUD ----
  const addVisual = useCallback((type) => {
    const draft = makeVisual(type)
    let created
    mutate(prev => {
      const layout = nextSlot(prev.visuals, draft.layout.w, draft.layout.h)
      created = { ...draft, layout: { ...draft.layout, ...layout } }
      return { ...prev, visuals: [...prev.visuals, created] }
    })
    return draft.id
  }, [mutate])

  const updateVisual = useCallback((id, patch) => {
    mutate(prev => ({
      ...prev,
      visuals: prev.visuals.map(v => v.id === id ? { ...v, ...(typeof patch === 'function' ? patch(v) : patch) } : v),
    }))
  }, [mutate])

  const updateVisualQuery = useCallback((id, queryPatch) => {
    mutate(prev => ({
      ...prev,
      visuals: prev.visuals.map(v => v.id === id ? { ...v, query: { ...v.query, ...queryPatch } } : v),
    }))
  }, [mutate])

  const duplicateVisual = useCallback((id) => {
    mutate(prev => {
      const src = prev.visuals.find(v => v.id === id)
      if (!src) return prev
      const copy = makeVisual(src.type)
      const slot = nextSlot(prev.visuals, src.layout.w, src.layout.h)
      return {
        ...prev,
        visuals: [...prev.visuals, {
          ...src, id: copy.id, title: `${src.title} copy`,
          layout: { ...src.layout, ...slot },
          reportVisibility: false, reportLayout: null, promotedAt: null,
        }],
      }
    })
  }, [mutate])

  const removeVisual = useCallback((id) => {
    mutate(prev => ({ ...prev, visuals: prev.visuals.filter(v => v.id !== id) }))
  }, [mutate])

  const setCanvasLayout = useCallback((layouts) => {
    // layouts: [{ i, x, y, w, h }]. react-grid-layout fires this on mount
    // with the layout we already have - skip when nothing actually moved so
    // simply opening the builder doesn't mark it dirty.
    setState(prev => {
      let changed = false
      const visuals = prev.visuals.map(v => {
        const l = layouts.find(x => x.i === v.id)
        if (!l) return v
        const cur = v.layout || {}
        if (cur.x === l.x && cur.y === l.y && cur.w === l.w && cur.h === l.h) return v
        changed = true
        return { ...v, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }
      })
      if (!changed) return prev
      setDirty(true)
      return { ...prev, visuals }
    })
  }, [])

  // ---- promotion ----
  const promote = useCallback((id) => {
    mutate(prev => ({
      ...prev,
      visuals: prev.visuals.map(v => v.id === id ? {
        ...v,
        reportVisibility: true,
        promotedAt: new Date().toISOString(),
        // Leave reportLayout null on first promotion - PromotedVisuals.jsx
        // assigns a non-overlapping slot; a real {x,y,w,h} is only written
        // once the user drags it in Reports' Edit Layout mode.
        reportLayout: (v.reportLayout && Number.isFinite(v.reportLayout.y)) ? v.reportLayout : null,
      } : v),
    }))
  }, [mutate])

  const demote = useCallback((id) => {
    mutate(prev => ({
      ...prev,
      visuals: prev.visuals.map(v => v.id === id ? { ...v, reportVisibility: false } : v),
    }))
  }, [mutate])

  const setBuilderFilters = useCallback((patch) => {
    mutate(prev => ({ ...prev, builderFilters: { ...prev.builderFilters, ...patch } }))
  }, [mutate])

  // ---- filtered submissions for the whole workspace ----
  const scopedSubmissions = useMemo(() => {
    const bf = state.builderFilters || {}
    const { start, end } = getDateRangeBounds(bf.dateRange || 'all', bf.customStart, bf.customEnd)
    let list = submissions
    if (start || end) {
      list = list.filter(s => {
        const c = new Date(s.created_at)
        if (start && c < start) return false
        if (end && c > end) return false
        return true
      })
    }
    const dims = bf.dimensionFilters || []
    if (dims.length) {
      list = list.filter(s => dims.every(df => {
        const raw = s.data[df.fieldId]
        const want = Array.isArray(df.value) ? df.value.map(String) : [String(df.value)]
        const have = Array.isArray(raw) ? raw.map(String) : [String(raw)]
        return have.some(h => want.includes(h))
      }))
    }
    return list
  }, [submissions, state.builderFilters])

  const previousSubmissions = useMemo(() => {
    const bf = state.builderFilters || {}
    const { start, end } = getDateRangeBounds(bf.dateRange || 'all', bf.customStart, bf.customEnd)
    if (!start) return null
    const span = (end ? end.getTime() : Date.now()) - start.getTime()
    const prevStart = new Date(start.getTime() - span)
    return submissions.filter(s => {
      const c = new Date(s.created_at)
      return c >= prevStart && c < start
    })
  }, [submissions, state.builderFilters])

  // Orders + Sale line items + Products & Inventory + Customers, each in the
  // { form, submissions } shape the engine understands. Built off the
  // date-scoped rows so the builder's date range applies everywhere.
  const datasets = useMemo(() => buildDatasets(form, scopedSubmissions), [form, scopedSubmissions])

  return {
    form, loading, error, saving, dirty,
    visuals: state.visuals,
    builderFilters: state.builderFilters,
    submissions, scopedSubmissions, previousSubmissions, datasets,
    addVisual, updateVisual, updateVisualQuery, duplicateVisual, removeVisual,
    setCanvasLayout, promote, demote, setBuilderFilters, save, saveFormSetting,
  }
}
