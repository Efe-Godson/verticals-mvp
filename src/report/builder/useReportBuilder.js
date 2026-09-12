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

const EMPTY_PRINT_LAYOUT = {
  pageSize: 'slide', orientation: 'landscape', pages: [],
  showLogo: true, showDate: true, showPageNumber: true, showWatermark: true,
}

const EMPTY_STATE = {
  visuals: [],
  builderFilters: { dateRange: 'all', customStart: '', customEnd: '', dimensionFilters: [] },
  printLayout: EMPTY_PRINT_LAYOUT,
}

function nextSlot(visuals, w, h) {
  // stack new visuals below everything currently placed
  const maxY = visuals.reduce((m, v) => Math.max(m, (v.layout?.y || 0) + (v.layout?.h || 0)), 0)
  return { x: 0, y: maxY, w, h }
}

let printSeq = 0
function newPrintId(prefix) {
  printSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${printSeq}`
}

function nextElementSlot(elements, w, h) {
  const maxY = elements.reduce((m, el) => Math.max(m, (el.layout?.y || 0) + (el.layout?.h || 0)), 0)
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
        ? {
            visuals: rb.visuals,
            builderFilters: { ...EMPTY_STATE.builderFilters, ...(rb.builderFilters || {}) },
            printLayout: { ...EMPTY_PRINT_LAYOUT, ...(rb.printLayout || {}), pages: rb.printLayout?.pages || [] },
          }
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

  // ---- print layout (brief §22-45) ----
  // Same read-modify-write shape as the visual CRUD above, scoped to
  // printLayout.pages instead of the top-level visuals array. Kept on this
  // hook (not a separate one) so a print-layout write and a visuals write
  // can never race each other over the same settings JSONB column.
  const mutatePrint = useCallback((updater) => {
    mutate(prev => ({ ...prev, printLayout: typeof updater === 'function' ? updater(prev.printLayout) : updater }))
  }, [mutate])

  const addPrintPage = useCallback((afterId) => {
    let created
    mutatePrint(prev => {
      created = { id: newPrintId('page'), elements: [] }
      const pages = [...prev.pages]
      const idx = afterId ? pages.findIndex(p => p.id === afterId) : pages.length - 1
      pages.splice(idx + 1, 0, created)
      return { ...prev, pages }
    })
    return created?.id
  }, [mutatePrint])

  const duplicatePrintPage = useCallback((pageId) => {
    mutatePrint(prev => {
      const idx = prev.pages.findIndex(p => p.id === pageId)
      if (idx === -1) return prev
      const src = prev.pages[idx]
      const copy = {
        id: newPrintId('page'),
        elements: src.elements.map(el => ({ ...el, id: newPrintId('el') })),
      }
      const pages = [...prev.pages]
      pages.splice(idx + 1, 0, copy)
      return { ...prev, pages }
    })
  }, [mutatePrint])

  const removePrintPage = useCallback((pageId) => {
    mutatePrint(prev => ({ ...prev, pages: prev.pages.filter(p => p.id !== pageId) }))
  }, [mutatePrint])

  const reorderPrintPages = useCallback((orderedIds) => {
    mutatePrint(prev => ({
      ...prev,
      pages: orderedIds.map(id => prev.pages.find(p => p.id === id)).filter(Boolean),
    }))
  }, [mutatePrint])

  const addPrintElement = useCallback((pageId, element) => {
    let created
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== pageId) return p
        const w = element.layout?.w ?? 12
        const h = element.layout?.h ?? 4
        const slot = nextElementSlot(p.elements, w, h)
        created = { id: newPrintId('el'), ...element, layout: { ...slot, ...element.layout } }
        return { ...p, elements: [...p.elements, created] }
      }),
    }))
    return created?.id
  }, [mutatePrint])

  const updatePrintElement = useCallback((pageId, elementId, patch) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id !== pageId ? p : {
        ...p,
        elements: p.elements.map(el => el.id === elementId ? { ...el, ...(typeof patch === 'function' ? patch(el) : patch) } : el),
      }),
    }))
  }, [mutatePrint])

  const removePrintElement = useCallback((pageId, elementId) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id !== pageId ? p : { ...p, elements: p.elements.filter(el => el.id !== elementId) }),
    }))
  }, [mutatePrint])

  // react-grid-layout fires onLayoutChange on mount with the layout it was
  // already given - same no-op guard as setCanvasLayout above, so opening a
  // print page doesn't immediately flip on the unsaved-changes indicator.
  const setPrintPageLayout = useCallback((pageId, layouts) => {
    setState(prev => {
      let changed = false
      const pages = prev.printLayout.pages.map(p => {
        if (p.id !== pageId) return p
        const elements = p.elements.map(el => {
          const l = layouts.find(x => x.i === el.id)
          if (!l) return el
          const cur = el.layout || {}
          if (cur.x === l.x && cur.y === l.y && cur.w === l.w && cur.h === l.h) return el
          changed = true
          return { ...el, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }
        })
        return { ...p, elements }
      })
      if (!changed) return prev
      setDirty(true)
      return { ...prev, printLayout: { ...prev.printLayout, pages } }
    })
  }, [])

  const updatePrintSettings = useCallback((patch) => {
    mutatePrint(prev => ({ ...prev, ...patch }))
  }, [mutatePrint])

  // Bulk-create pages from plain content (see report/builder/print/
  // replicateDashboard.js) - ids are assigned here so every call produces
  // fresh, unique ones. `append: true` adds after the existing pages instead
  // of replacing them (used for a manual "Replicate dashboard" re-run so it
  // never destroys pages the user already built by hand).
  const seedPrintPages = useCallback((pageContents, { append = false } = {}) => {
    const newPages = pageContents.map(p => ({
      id: newPrintId('page'),
      elements: p.elements.map(el => ({ ...el, id: newPrintId('el') })),
    }))
    mutatePrint(prev => ({ ...prev, pages: append ? [...prev.pages, ...newPages] : newPages }))
  }, [mutatePrint])

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
    printLayout: state.printLayout,
    submissions, scopedSubmissions, previousSubmissions, datasets,
    addVisual, updateVisual, updateVisualQuery, duplicateVisual, removeVisual,
    setCanvasLayout, promote, demote, setBuilderFilters, save, saveFormSetting,
    addPrintPage, duplicatePrintPage, removePrintPage, reorderPrintPages,
    addPrintElement, updatePrintElement, removePrintElement, setPrintPageLayout, updatePrintSettings,
    seedPrintPages,
  }
}
