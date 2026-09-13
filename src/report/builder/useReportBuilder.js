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
import { CURRENT_SCHEMA_VERSION } from './print/elementModel'
import { migratePrintLayout } from './print/migratePrintLayout'
import { fromGridCells, toGridCells, resolveElementSize } from './print/gridAdapter'
import { nextZIndex, stepSwap, reindexFromOrder } from './print/zOrder'
import { useHistory } from './print/useHistory'

const EMPTY_PRINT_LAYOUT = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  pageSize: 'slide', orientation: 'landscape', pages: [],
  showLogo: true, showDate: true, showPageNumber: true, showWatermark: true,
  pageNumberFormat: 'page-x-of-y', numberTitlePage: false,
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

// Elements are stored in percentage space (elementModel.js) - stack a new
// one below everything already on the page, same idea as nextSlot() above
// for Report Builder's own visuals, just in width/height percentages
// instead of grid cells.
function nextElementSlotPct(elements, width, height) {
  const maxY = elements.reduce((m, el) => Math.max(m, (el.y || 0) + (el.height || 0)), 0)
  return { x: 0, y: maxY, width, height }
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
  // Undo/redo tracks printLayout only - Report Builder's own visuals/
  // builderFilters aren't part of Designer's editing surface (see
  // useReportBuilder.js's module comment and the Designer 2.0 plan's "what
  // must not break" section), so there's nothing there for Ctrl+Z to do.
  const printHistory = useHistory(EMPTY_PRINT_LAYOUT)

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
      const nextState = rb && Array.isArray(rb.visuals)
        ? {
            visuals: rb.visuals,
            builderFilters: { ...EMPTY_STATE.builderFilters, ...(rb.builderFilters || {}) },
            printLayout: migratePrintLayout({ ...EMPTY_PRINT_LAYOUT, ...(rb.printLayout || {}), pages: rb.printLayout?.pages || [] }),
          }
        : EMPTY_STATE
      setState(nextState)
      // Undo/redo starts fresh per loaded document - a freshly opened
      // report has nothing to undo into, and the placeholder EMPTY_STATE
      // this hook started with before the fetch resolved was never a real
      // edit worth keeping reachable via Ctrl+Z.
      printHistory.reset(nextState.printLayout)

      const { data: subs } = await supabase.from('submissions').select('*')
        .eq('form_id', formId).is('deleted_at', null).order('created_at', { ascending: true })
      if (cancelled) return
      setSubmissions(subs || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // printHistory's methods are individually stable (see useHistory.js) -
    // re-running this effect only on formId change is intentional, not a
    // missed dependency.
  }, [formId]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // Computes the next printLayout synchronously off stateRef (not via
  // mutate's own setState updater) and records it into history right here,
  // as a plain side effect in the caller's event handler - not inside a
  // function passed to setState. React (in StrictMode, which this app runs
  // in - see main.jsx) intentionally double-invokes updater functions to
  // catch impurities; recording history (a ref write + a nested setState)
  // from inside one would double-record every edit in dev. The updater
  // handed to `mutate` below stays a pure merge, safe to double-invoke.
  const mutatePrint = useCallback((updater) => {
    const nextPrintLayout = typeof updater === 'function' ? updater(stateRef.current.printLayout) : updater
    printHistory.record(nextPrintLayout)
    mutate(prev => ({ ...prev, printLayout: nextPrintLayout }))
  }, [mutate, printHistory.record]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restores a printLayout from undo/redo without re-recording it as a new
  // history entry (mutatePrint above does that unconditionally, which is
  // right for real edits but would turn "undo" into "undo, then immediately
  // push a redo-cancelling entry").
  const applyPrintLayout = useCallback((printLayout) => {
    mutate(prev => ({ ...prev, printLayout }))
  }, [mutate])

  const undoPrint = useCallback(() => {
    const restored = printHistory.undo()
    if (restored !== undefined) applyPrintLayout(restored)
  }, [printHistory.undo, applyPrintLayout]) // eslint-disable-line react-hooks/exhaustive-deps

  const redoPrint = useCallback(() => {
    const restored = printHistory.redo()
    if (restored !== undefined) applyPrintLayout(restored)
  }, [printHistory.redo, applyPrintLayout]) // eslint-disable-line react-hooks/exhaustive-deps

  const beginPrintBatch = printHistory.beginBatch
  const commitPrintBatch = printHistory.commitBatch

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
        ...src,
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

  // `element.layout` (when passed by a caller) is still grid-cell {w,h} -
  // most call sites (PrintWorkspace.jsx's visual/tile/text sidebar buttons)
  // use defaultElementSize()'s grid units; the shape/image "add" buttons
  // instead pass elementModel.js's makeShapeElement()/makeImageElement()
  // factory output, which already carries percentage width/height directly.
  // resolveElementSize() reconciles both conventions.
  const addPrintElement = useCallback((pageId, element) => {
    let created
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== pageId) return p
        // Strip any id the caller's object already carries (e.g.
        // elementModel.js's makeShapeElement()/makeImageElement() factories
        // assign their own) - addPrintElement is always the sole authority
        // on ids for elements it creates.
        const { layout: _layout, id: _id, ...rest } = element
        const { width, height } = resolveElementSize(element)
        const slot = nextElementSlotPct(p.elements, width, height)
        created = {
          id: newPrintId('el'), ...rest, ...slot,
          rotation: rest.rotation ?? 0, zIndex: p.elements.length + 1, locked: false, visible: true,
        }
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

  // Bulk position/size update for a multi-select group move - every element
  // in `patchesById` lands in one mutatePrint call, so dragging a group of
  // elements together is one undo step, not N. (N separate updatePrintElement
  // calls would each be its own history entry - see useHistory.js's header
  // comment on why that can't be fixed with beginBatch/commitBatch when the
  // calls are all synchronous within one event handler.)
  const updatePrintElements = useCallback((pageId, patchesById) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id !== pageId ? p : {
        ...p,
        elements: p.elements.map(el => patchesById[el.id] ? { ...el, ...patchesById[el.id] } : el),
      }),
    }))
  }, [mutatePrint])

  const removePrintElement = useCallback((pageId, elementId) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id !== pageId ? p : { ...p, elements: p.elements.filter(el => el.id !== elementId) }),
    }))
  }, [mutatePrint])

  const removePrintElements = useCallback((pageId, elementIds) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id !== pageId ? p : { ...p, elements: p.elements.filter(el => !elementIds.includes(el.id)) }),
    }))
  }, [mutatePrint])

  // ---- z-order (brief §13 "Layering") - arithmetic lives in zOrder.js ----
  const setPrintElementZ = useCallback((pageId, elementId, mode) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== pageId) return p
        if (mode === 'front' || mode === 'back') {
          const z = nextZIndex(p.elements, mode)
          return { ...p, elements: p.elements.map(e => e.id === elementId ? { ...e, zIndex: z } : e) }
        }
        const swap = stepSwap(p.elements, elementId, mode === 'forward' ? 1 : -1)
        if (!swap) return p
        const [a, b] = swap
        const byId = { [a.id]: a.zIndex, [b.id]: b.zIndex }
        return { ...p, elements: p.elements.map(e => e.id in byId ? { ...e, zIndex: byId[e.id] } : e) }
      }),
    }))
  }, [mutatePrint])

  // Same as setPrintElementZ but for a multi-selection (FormatInspector's
  // layer buttons when >1 element is selected) - applies to every id inside
  // one mutatePrint call, same one-undo-step reasoning as updatePrintElements
  // above. Elements are restacked in `elementIds` order so their relative
  // order is preserved when moving the group as a whole.
  const setPrintElementsZ = useCallback((pageId, elementIds, mode) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== pageId) return p
        let elements = p.elements
        if (mode === 'front' || mode === 'back') {
          elementIds.forEach(id => {
            const z = nextZIndex(elements, mode)
            elements = elements.map(e => e.id === id ? { ...e, zIndex: z } : e)
          })
          return { ...p, elements }
        }
        elementIds.forEach(id => {
          const swap = stepSwap(elements, id, mode === 'forward' ? 1 : -1)
          if (!swap) return
          const [a, b] = swap
          const byId = { [a.id]: a.zIndex, [b.id]: b.zIndex }
          elements = elements.map(e => e.id in byId ? { ...e, zIndex: byId[e.id] } : e)
        })
        return { ...p, elements }
      }),
    }))
  }, [mutatePrint])

  // Full front-to-back restack, from the Layers panel's drag-to-reorder.
  const reorderPrintElementsZ = useCallback((pageId, orderedIdsFrontToBack) => {
    mutatePrint(prev => ({
      ...prev,
      pages: prev.pages.map(p => {
        if (p.id !== pageId) return p
        const zById = reindexFromOrder(orderedIdsFrontToBack)
        return { ...p, elements: p.elements.map(el => el.id in zById ? { ...el, zIndex: zById[el.id] } : el) }
      }),
    }))
  }, [mutatePrint])

  // react-grid-layout fires onLayoutChange on mount with the layout it was
  // already given - same no-op guard as setCanvasLayout above, so opening a
  // print page doesn't immediately flip on the unsaved-changes indicator.
  // `layouts` arrives in grid cells (react-grid-layout's own coordinate
  // system, via gridAdapter's withGridLayout - see PrintWorkspace.jsx);
  // elements are stored in percentage space, so convert on the way in and
  // compare in grid-cell space (matching the granularity the guard already
  // relied on, avoiding false "changed" positives from rounding drift).
  const setPrintPageLayout = useCallback((pageId, layouts) => {
    setState(prev => {
      let changed = false
      const pages = prev.printLayout.pages.map(p => {
        if (p.id !== pageId) return p
        const elements = p.elements.map(el => {
          const l = layouts.find(x => x.i === el.id)
          if (!l) return el
          const cur = toGridCells(el)
          if (cur.x === l.x && cur.y === l.y && cur.w === l.w && cur.h === l.h) return el
          changed = true
          return { ...el, ...fromGridCells(l) }
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
  // never destroys pages the user already built by hand). replicateDashboard
  // still emits elements with a grid-cell `layout: {x,y,w,h}` (unchanged) -
  // converted to the canonical percentage fields right here, so that file
  // never needs to know the storage model changed.
  const seedPrintPages = useCallback((pageContents, { append = false } = {}) => {
    const newPages = pageContents.map(p => ({
      ...p,
      id: newPrintId('page'),
      elements: p.elements.map((el, i) => {
        const { layout, ...rest } = el
        return {
          id: newPrintId('el'), ...rest, ...fromGridCells(layout),
          rotation: 0, zIndex: i + 1, locked: false, visible: true,
        }
      }),
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
    addPrintElement, updatePrintElement, updatePrintElements, removePrintElement, removePrintElements,
    setPrintElementZ, setPrintElementsZ, reorderPrintElementsZ,
    setPrintPageLayout, updatePrintSettings,
    seedPrintPages,
    undoPrint, redoPrint, canUndoPrint: printHistory.canUndo, canRedoPrint: printHistory.canRedo,
    beginPrintBatch, commitPrintBatch,
  }
}
