// Place at: src/report/builder/print/PrintWorkspace.jsx
// Route: /form/:id/report/builder/print. The Print/PDF report builder
// (redesign brief §22-36): arrange existing Report Builder visuals onto
// pages for export, entirely separate from the interactive dashboard and
// the Builder canvas - editing this never touches either of those.
// DesignerCanvas.jsx's freeform canvas is the only renderer as of Designer
// 2.0 Phase 1's cutover (plan step 13) - the earlier react-grid-layout
// renderer and its experimental-toggle checkbox are gone.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../../../Toast'
import PageSkeleton from '../../../components/PageSkeleton'
import { ErrorState } from '../../../ErrorState'
import useIsMobile from '../../../hooks/useIsMobile'
import { useReportBuilder } from '../useReportBuilder'
import { buildChartTiles } from '../../analysis/buildDashboardTiles'
import { exportPrintLayoutToPDF } from '../../../reportExport'
import PrintPage from './PrintPage'
import FormatInspector from './FormatInspector'
import LayersPanel from './LayersPanel'
import PageThumbnail from './PageThumbnail'
import { useAutosave } from './useAutosave'
import { TEXT_VARIANTS, defaultElementSize, PAGE_SIZES, PAGE_NUMBER_FORMATS } from './printConstants'
import { buildDashboardReplicaPages } from './replicateDashboard'
import { makeShapeElement, makeImageElement, SHAPE_TYPES } from './elementModel'
import { CATALOGUE_BY_TYPE } from '../catalogue'
import { THEMES } from './theme'
import { PAGE_LAYOUTS, PAGE_LAYOUTS_BY_ID } from './pageLayouts'
import { buildTokenContext, AVAILABLE_TOKENS } from './dynamicTokens'
import { analyzeReport, scoreReport } from './designQuality'
import { tidyPage } from './tidyUp'
import PresentationMode from './PresentationMode'

const sideBtn = { fontSize: '0.78rem', padding: '0.3rem 0.5rem' }

export default function PrintWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const rb = useReportBuilder(id)
  const isMobile = useIsMobile(900)
  // printLayout (not dirty) is the debounce-reset signal - see
  // useAutosave.js's header comment for why.
  const autosave = useAutosave(rb.printLayout, rb.dirty, rb.save)

  const [activePageId, setActivePageId] = useState(null)
  const [preview, setPreview] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [qualityPanelOpen, setQualityPanelOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(null)
  const [tileSearch, setTileSearch] = useState('')
  const [visualSearch, setVisualSearch] = useState('')
  // Selection lives here (not inside DesignerCanvas) because there's one
  // DesignerCanvas per page but only one Format Inspector, and keyboard
  // delete needs to know the current selection regardless of which page's
  // canvas last changed it.
  const [selection, setSelection] = useState({ pageId: null, ids: [] })
  const selectPage = useCallback((pageId, ids) => setSelection({ pageId, ids }), [])
  const pageRefs = useRef({})

  const pages = rb.printLayout?.pages || []

  // First visit to Print View: pre-fill it with a paginated replica of the
  // main Report.jsx dashboard (every chart tile + every promoted visual)
  // instead of a blank page, so Print View already looks like the report -
  // see replicateDashboard.js. Falls back to one empty page only when there's
  // truly nothing yet to replicate (a brand new report).
  useEffect(() => {
    if (rb.loading || !rb.printLayout || pages.length > 0 || !rb.form) return
    const replicaPages = buildDashboardReplicaPages(rb.form, rb.scopedSubmissions, rb.visuals)
    if (replicaPages.length > 0) {
      rb.seedPrintPages(replicaPages)
    } else {
      const newId = rb.addPrintPage()
      setActivePageId(newId)
    }
  }, [rb.loading, rb.printLayout, pages.length, rb.form]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activePageId && pages.length > 0) setActivePageId(pages[0].id)
    if (activePageId && !pages.some(p => p.id === activePageId)) setActivePageId(pages[0]?.id || null)
  }, [pages, activePageId])

  // Clear a stale selection - its page got deleted - rather than leave the
  // Inspector pointed at nothing.
  useEffect(() => {
    if (selection.pageId && !pages.some(p => p.id === selection.pageId)) setSelection({ pageId: null, ids: [] })
  }, [pages, selection.pageId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Delete/Backspace removes the current selection - guarded against firing
  // while the user is typing (a text element's contentEditable, or any
  // plain input/textarea/select in the sidebar).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!selection.pageId || selection.ids.length === 0) return
      const t = e.target
      if (t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName)) return
      e.preventDefault()
      rb.removePrintElements(selection.pageId, selection.ids)
      setSelection({ pageId: null, ids: [] })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Same typing guard as Delete/Backspace
  // above so it doesn't fight a field's own native undo while actively
  // editing text or a number input.
  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target
      if (t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName)) return
      e.preventDefault()
      if (e.shiftKey) rb.redoPrint(); else rb.undoPrint()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rb.undoPrint, rb.redoPrint]) // eslint-disable-line react-hooks/exhaustive-deps

  const visualsById = useMemo(() => Object.fromEntries((rb.visuals || []).map(v => [v.id, v])), [rb.visuals])

  // Every tile the main Report.jsx dashboard shows (trend / cart / category /
  // location / legacy-widget) - built by the exact same shared function, so
  // "every element on the report page" really does mean every element.
  const dashboardTiles = useMemo(
    () => (rb.form ? buildChartTiles(rb.form, rb.scopedSubmissions).tiles : []),
    [rb.form, rb.scopedSubmissions],
  )
  const tilesById = useMemo(() => Object.fromEntries(dashboardTiles.map(t => [t.id, t])), [dashboardTiles])

  // Dynamic {{token}} text (Phase 2) - built once per data change, not per
  // text element, since every element on the page shares the same context.
  const tokenContext = useMemo(
    () => buildTokenContext({ form: rb.form, scopedSubmissions: rb.scopedSubmissions }),
    [rb.form, rb.scopedSubmissions],
  )

  // Design Quality (Phase 3) - re-analyzed on every printLayout edit; cheap
  // geometry-only checks (designQuality.js), not a DOM measurement, so this
  // is fine to run on every render rather than debouncing.
  const qualityIssues = useMemo(
    () => analyzeReport(rb.printLayout, { visualsById, tilesById }),
    [rb.printLayout, visualsById, tilesById],
  )
  const qualityScore = useMemo(() => scoreReport(qualityIssues), [qualityIssues])

  if (rb.loading) return <PageSkeleton variant="report" />
  if (rb.error && !rb.form) return <ErrorState message={rb.error} />

  const pageSize = rb.printLayout.pageSize
  const orientation = rb.printLayout.orientation
  const settings = rb.printLayout
  const orientable = (PAGE_SIZES[pageSize] || PAGE_SIZES.slide).orientable

  function addVisualToActivePage(visualId) {
    const pageId = activePageId || pages[0]?.id
    if (!pageId) return
    rb.addPrintElement(pageId, { kind: 'visual', visualId, override: null, layout: { ...defaultElementSize('visual') } })
  }
  function addTileToActivePage(tileId) {
    const pageId = activePageId || pages[0]?.id
    if (!pageId) return
    rb.addPrintElement(pageId, { kind: 'tile', tileId, layout: { ...defaultElementSize('visual') } })
  }
  function addTextToActivePage(variant) {
    const pageId = activePageId || pages[0]?.id
    if (!pageId) return
    rb.addPrintElement(pageId, {
      kind: 'text',
      text: { variant, content: '', align: variant === 'divider' ? 'left' : 'left', bold: false },
      layout: { ...defaultElementSize('text', variant) },
    })
  }
  function addShapeToActivePage(shape) {
    const pageId = activePageId || pages[0]?.id
    if (!pageId) return
    rb.addPrintElement(pageId, makeShapeElement({ shape }))
  }
  function addImageToActivePage() {
    const pageId = activePageId || pages[0]?.id
    if (!pageId) return
    rb.addPrintElement(pageId, makeImageElement())
  }

  async function handleSave() {
    const { error } = await rb.save()
    showToast(error ? 'Could not save print layout.' : 'Print layout saved.', error ? 'error' : 'success')
  }

  // Export preflight (Phase 3) - errors (broken references, content off
  // the page) get a confirm-or-cancel; warnings/info don't block export,
  // the Design Quality panel covers browsing those at leisure.
  function passesPreflight() {
    const blocking = qualityIssues.filter(i => i.severity === 'error')
    if (blocking.length === 0) return true
    const list = blocking.slice(0, 8).map(i => `• ${i.message}`).join('\n')
    const more = blocking.length > 8 ? `\n…and ${blocking.length - 8} more.` : ''
    return window.confirm(`This report has ${blocking.length} issue${blocking.length === 1 ? '' : 's'} that may affect the export:\n\n${list}${more}\n\nExport anyway?`)
  }

  async function handleDownload() {
    if (!passesPreflight()) return
    if (rb.dirty) await rb.save()
    setExporting(true)
    setExportProgress({ done: 0, total: pages.length, label: 'Starting…' })
    // Force a clean (non-editing) render before capturing, regardless of
    // whether the user remembered to click Preview first - editing chrome
    // (ranking dropdowns, remove buttons, text toolbars) must never end up
    // baked into the exported PDF.
    const wasPreview = preview
    if (!wasPreview) {
      setPreview(true)
      await new Promise(r => setTimeout(r, 50))
    }
    try {
      const nodes = pages.map(p => pageRefs.current[p.id])
      await exportPrintLayoutToPDF(pageSize, orientation, nodes, rb.form?.name || 'report', {
        onProgress: (done, total, label) => setExportProgress({ done, total, label }),
      })
    } catch (err) {
      showToast(err.message || 'Could not export PDF.', 'error')
    } finally {
      setExporting(false)
      setExportProgress(null)
      if (!wasPreview) setPreview(false)
    }
  }

  async function handleDownloadPptx() {
    if (!passesPreflight()) return
    if (rb.dirty) await rb.save()
    setExporting(true)
    setExportProgress({ done: 0, total: pages.length, label: 'Starting…' })
    const wasPreview = preview
    if (!wasPreview) {
      setPreview(true)
      await new Promise(r => setTimeout(r, 50))
    }
    try {
      // pptxgenjs is a large dependency (see exportPptx.js) - loaded only
      // when someone actually clicks this button, same reasoning as every
      // route's own lazy import in App.jsx.
      const { exportPrintLayoutToPptx } = await import('./exportPptx')
      const nodes = pages.map(p => pageRefs.current[p.id])
      await exportPrintLayoutToPptx(rb.printLayout, nodes, rb.form?.name || 'report', {
        onProgress: (done, total, label) => setExportProgress({ done, total, label }),
      })
    } catch (err) {
      showToast(err.message || 'Could not export PPTX.', 'error')
    } finally {
      setExporting(false)
      setExportProgress(null)
      if (!wasPreview) setPreview(false)
    }
  }

  // Tidy Up (Phase 3) - one bulk updatePrintElements call, so the whole
  // clean-up is a single undo step (tidyUp.js's own header comment explains
  // why this couldn't safely be a loop of single-element updates instead).
  function handleTidyUp() {
    if (!activePage) return
    const patches = tidyPage(activePage)
    if (Object.keys(patches).length === 0) { showToast('Nothing to tidy on this page.', 'success'); return }
    rb.updatePrintElements(activePage.id, patches)
  }

  const filteredTiles = dashboardTiles.filter(t => t.title?.toLowerCase().includes(tileSearch.trim().toLowerCase()))
  const filteredVisuals = (rb.visuals || []).filter(v => v.title?.toLowerCase().includes(visualSearch.trim().toLowerCase()))

  const selectedPage = pages.find(p => p.id === selection.pageId) || null
  const activePage = pages.find(p => p.id === activePageId) || null
  const selectedElements = selectedPage ? selectedPage.elements.filter(el => selection.ids.includes(el.id)) : []

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '0.8rem' }}>
      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>
            Dashboard elements
          </span>
          {dashboardTiles.length > 0 && (
            <button
              className="secondary" style={{ ...sideBtn, padding: '0.15rem 0.4rem' }} title="Add a fresh replica of the dashboard as new pages"
              onClick={() => rb.seedPrintPages(buildDashboardReplicaPages(rb.form, rb.scopedSubmissions, rb.visuals), { append: true })}
            >
              ⟳ Replicate
            </button>
          )}
        </div>
        {dashboardTiles.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>No dashboard elements to show yet.</p>
        ) : (
          <>
            <input
              type="text" value={tileSearch} onChange={e => setTileSearch(e.target.value)}
              placeholder="Search elements..."
              style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem 0.5rem', marginBottom: '0.4rem', boxSizing: 'border-box' }}
            />
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '260px', overflowY: 'auto',
              border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.35rem',
            }}>
              {filteredTiles.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.2rem' }}>No matches.</p>
              )}
              {filteredTiles.map(t => (
                <button
                  key={t.id} className="secondary"
                  style={{ ...sideBtn, textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}
                  onClick={() => addTileToActivePage(t.id)}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <span>+</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Available visuals
        </div>
        {(rb.visuals || []).length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>No Report Builder visuals yet.</p>
        ) : (
          <>
            <input
              type="text" value={visualSearch} onChange={e => setVisualSearch(e.target.value)}
              placeholder="Search visuals..."
              style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem 0.5rem', marginBottom: '0.4rem', boxSizing: 'border-box' }}
            />
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '200px', overflowY: 'auto',
              border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.35rem',
            }}>
              {filteredVisuals.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.2rem' }}>No matches.</p>
              )}
              {filteredVisuals.map(v => (
                <button
                  key={v.id} className="secondary"
                  style={{ ...sideBtn, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}
                  onClick={() => addVisualToActivePage(v.id)}
                >
                  <span style={{ overflow: 'hidden', minWidth: 0 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--color-muted)' }}>
                      {CATALOGUE_BY_TYPE[v.type]?.label || v.type}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0 }}>+</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Add text
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {TEXT_VARIANTS.map(v => (
            <button key={v.value} className="secondary" style={sideBtn} onClick={() => addTextToActivePage(v.value)}>{v.label}</button>
          ))}
          <button className="secondary" style={sideBtn} onClick={() => addTextToActivePage('divider')}>Divider</button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.4rem', marginBottom: 0 }} title={AVAILABLE_TOKENS.join(', ')}>
          Tip: type a dynamic value like <code>{'{{metric.totalRevenue}}'}</code> into any text box - it resolves live once you click away.
        </p>
      </div>

      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Shapes
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {SHAPE_TYPES.map(shape => (
            <button key={shape} className="secondary" style={sideBtn} onClick={() => addShapeToActivePage(shape)}>
              {shape.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Media
        </div>
        <button className="secondary" style={sideBtn} onClick={addImageToActivePage}>+ Add image</button>
      </div>

      {(rb.printLayout.savedComponents || []).length > 0 && (
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
            Components
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {rb.printLayout.savedComponents.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <button
                  className="secondary" style={{ ...sideBtn, flex: 1, textAlign: 'left' }}
                  onClick={() => activePageId && rb.insertSavedComponent(activePageId, c.id)}
                >
                  {c.name}
                </button>
                <button className="secondary" style={{ ...sideBtn, padding: '0 0.3rem' }} title="Delete" onClick={() => rb.removeSavedComponent(c.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Layers
        </div>
        <LayersPanel
          page={activePage}
          visualsById={visualsById}
          tilesById={tilesById}
          selectedIds={selection.pageId === activePageId ? selection.ids : []}
          onSelect={ids => activePageId && selectPage(activePageId, ids)}
          onUpdateElement={rb.updatePrintElement}
          onReorder={ids => activePageId && rb.reorderPrintElementsZ(activePageId, ids)}
        />
      </div>

      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>Pages</span>
          <select
            style={{ fontSize: '0.76rem', padding: '0.15rem 0.3rem' }}
            value=""
            onChange={e => {
              const layout = PAGE_LAYOUTS_BY_ID[e.target.value]
              if (!layout) return
              const newId = layout.id === 'blank' ? rb.addPrintPage(activePageId) : rb.addPrintPageWithElements(activePageId, layout.make)
              setActivePageId(newId)
              e.target.value = ''
            }}
          >
            <option value="" disabled>+ Add page ▾</option>
            {PAGE_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {pages.map((p, i) => (
            <div
              key={p.id}
              onClick={() => setActivePageId(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                background: activePageId === p.id ? 'var(--color-primary-soft)' : 'transparent', fontSize: '0.8rem',
              }}
            >
              <div style={{ width: '38px', flexShrink: 0 }}>
                <PageThumbnail page={p} pageSize={pageSize} orientation={orientation} />
              </div>
              <span style={{ flex: 1 }}>Page {i + 1}</span>
              <button
                className="secondary" style={{ ...sideBtn, padding: '0 0.3rem', opacity: p.hideMaster ? 1 : 0.4 }}
                title={p.hideMaster ? 'Master page hidden on this page - click to show' : 'Hide header/footer/logo/watermark on this page'}
                onClick={e => { e.stopPropagation(); rb.setPageHideMaster(p.id, !p.hideMaster) }}
              >
                ▭
              </button>
              <button className="secondary" style={{ ...sideBtn, padding: '0 0.3rem' }} title="Duplicate" onClick={e => { e.stopPropagation(); rb.duplicatePrintPage(p.id) }}>⧉</button>
              <button className="secondary" style={{ ...sideBtn, padding: '0 0.3rem' }} title="Move up" disabled={i === 0}
                onClick={e => { e.stopPropagation(); const ids = pages.map(x => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; rb.reorderPrintPages(ids) }}>↑</button>
              <button className="secondary" style={{ ...sideBtn, padding: '0 0.3rem' }} title="Move down" disabled={i === pages.length - 1}
                onClick={e => { e.stopPropagation(); const ids = pages.map(x => x.id); [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; rb.reorderPrintPages(ids) }}>↓</button>
              <button className="secondary" style={{ ...sideBtn, padding: '0 0.3rem' }} title="Delete" disabled={pages.length === 1}
                onClick={e => { e.stopPropagation(); rb.removePrintPage(p.id) }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Page settings
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
          Page size
          <select
            style={{ fontSize: '0.8rem' }} value={pageSize}
            onChange={e => rb.updatePrintSettings({ pageSize: e.target.value })}
          >
            {Object.entries(PAGE_SIZES).map(([value, spec]) => <option key={value} value={value}>{spec.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
          Theme
          <select
            style={{ fontSize: '0.8rem' }} value={settings.theme || 'default'}
            onChange={e => rb.updatePrintSettings({ theme: e.target.value })}
          >
            {Object.entries(THEMES).map(([value, t]) => <option key={value} value={value}>{t.label}</option>)}
          </select>
        </label>
        {orientable && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
            Orientation
            <select
              style={{ fontSize: '0.8rem' }} value={orientation}
              onChange={e => rb.updatePrintSettings({ orientation: e.target.value })}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        )}
        {[
          ['showLogo', 'Show logo'],
          ['showDate', 'Show date'],
          ['showPageNumber', 'Show page numbers'],
          ['showWatermark', 'Powered by Verticals'],
        ].map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
            <input type="checkbox" checked={!!settings[key]} onChange={e => rb.updatePrintSettings({ [key]: e.target.checked })} />
            {label}
          </label>
        ))}
        <label style={{ display: 'block', fontSize: '0.82rem', marginTop: '0.5rem', marginBottom: '0.2rem' }}>Header text</label>
        <input
          type="text" value={settings.masterHeaderText || ''} placeholder="(none)"
          onChange={e => rb.updatePrintSettings({ masterHeaderText: e.target.value })}
          style={{ width: '100%', fontSize: '0.8rem', padding: '0.25rem 0.4rem', boxSizing: 'border-box', marginBottom: '0.4rem' }}
        />
        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Footer text</label>
        <input
          type="text" value={settings.masterFooterText || ''} placeholder="(none)"
          onChange={e => rb.updatePrintSettings({ masterFooterText: e.target.value })}
          style={{ width: '100%', fontSize: '0.8rem', padding: '0.25rem 0.4rem', boxSizing: 'border-box', marginBottom: '0.4rem' }}
        />
        {settings.showPageNumber && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', margin: '0.3rem 0' }}>
              Number format
              <select
                style={{ fontSize: '0.8rem' }} value={settings.pageNumberFormat || 'page-x-of-y'}
                onChange={e => rb.updatePrintSettings({ pageNumberFormat: e.target.value })}
              >
                {PAGE_NUMBER_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
              <input
                type="checkbox" checked={!!settings.numberTitlePage}
                onChange={e => rb.updatePrintSettings({ numberTitlePage: e.target.checked })}
              />
              Number the title page
            </label>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="pw-workspace" style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <style>{`
        .pw-cols { display: grid; grid-template-columns: 260px 1fr; flex: 1; min-height: 0; }
        .pw-cols.pw-cols-inspector { grid-template-columns: 260px 1fr 240px; }
        .pw-cols > * { min-height: 0; }
        .pw-side { background: var(--color-surface); border-right: 1px solid var(--color-border); overflow: hidden; }
        .pw-inspector { background: var(--color-surface); border-left: 1px solid var(--color-border); overflow: hidden; }
        .pw-canvas { overflow-y: auto; padding: 1.5rem; }
        .pw-mobile-bar { display: none; }
        @media (max-width: 900px) {
          .pw-cols, .pw-cols.pw-cols-inspector { grid-template-columns: 1fr; }
          .pw-side { display: none; }
          .pw-inspector { display: none; }
          .pw-mobile-bar { display: flex; flex-shrink: 0; border-top: 1px solid var(--color-border); background: var(--color-surface); padding-bottom: env(safe-area-inset-bottom); }
          .pw-mobile-bar button { flex: 1; border-radius: 0; background: var(--color-surface); color: var(--color-text); border: none; font-size: 0.82rem; padding: 0.6rem; }
          .pw-drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 120; }
          .pw-sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 85vh; background: var(--color-surface); z-index: 121; border-radius: 16px 16px 0 0; box-shadow: 0 -4px 18px rgba(0,0,0,0.2); display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <button className="secondary" onClick={() => navigate(`/form/${id}/report/builder`)} style={{ fontSize: '0.8rem', flexShrink: 0 }}>← Exit</button>
        {!isMobile && <strong style={{ letterSpacing: '0.06em', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Designer</strong>}
        <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{rb.form?.name}</span>
        {!rb.saving && !rb.dirty && autosave.status === 'saved' && (
          <span style={{ fontSize: '0.76rem', color: 'var(--color-muted)', flexShrink: 0 }}>Saved</span>
        )}
        {!rb.saving && autosave.status === 'error' && (
          <span style={{ fontSize: '0.76rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
            Autosave failed
            <button className="secondary" style={{ fontSize: '0.74rem', padding: '0.1rem 0.35rem' }} onClick={autosave.retry}>Retry</button>
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button className="secondary" onClick={rb.undoPrint} disabled={!rb.canUndoPrint} title="Undo (Ctrl+Z)" style={{ fontSize: '0.8rem' }}>↶ Undo</button>
          <button className="secondary" onClick={rb.redoPrint} disabled={!rb.canRedoPrint} title="Redo (Ctrl+Shift+Z)" style={{ fontSize: '0.8rem' }}>↷ Redo</button>
          <button className="secondary" onClick={handleTidyUp} title="Snap this page's elements to a grid and pull anything off-page back in" style={{ fontSize: '0.8rem' }}>✨ Tidy Up</button>
          <button
            className="secondary" onClick={() => setQualityPanelOpen(o => !o)} title="Design Quality"
            style={{ fontSize: '0.8rem', color: qualityIssues.some(i => i.severity === 'error') ? '#b91c1c' : undefined }}
          >
            Quality: {qualityScore}
          </button>
          <button className="secondary" onClick={() => setPresenting(true)} disabled={pages.length === 0} style={{ fontSize: '0.8rem' }}>▶ Present</button>
          <button className="secondary" onClick={() => setPreview(p => !p)} style={{ fontSize: '0.8rem' }}>{preview ? 'Edit' : 'Preview'}</button>
          <button className="secondary" onClick={handleSave} disabled={rb.saving} style={{ fontSize: '0.8rem' }}>
            {rb.saving ? 'Saving…' : rb.dirty ? 'Save*' : 'Save'}
          </button>
          <button onClick={handleDownload} disabled={exporting} style={{ fontSize: '0.8rem' }}>
            {exporting ? `${exportProgress?.label || 'Exporting…'} (${exportProgress?.done ?? 0}/${exportProgress?.total ?? pages.length})` : 'Download PDF'}
          </button>
          <button className="secondary" onClick={handleDownloadPptx} disabled={exporting} style={{ fontSize: '0.8rem' }}>
            Download PPTX
          </button>
        </div>
      </div>

      <div className={`pw-cols${!preview ? ' pw-cols-inspector' : ''}`}>
        {!preview && <div className="pw-side">{sidebar}</div>}
        <div className="pw-canvas">
          {pages.map((p, i) => (
            <div key={p.id} onClick={() => setActivePageId(p.id)}>
              <PrintPage
                page={p}
                pageSize={pageSize}
                orientation={orientation}
                visualsById={visualsById}
                tilesById={tilesById}
                form={rb.form}
                submissions={rb.scopedSubmissions}
                editing={!preview}
                settings={settings}
                pageNumber={i + 1}
                totalPages={pages.length}
                pageRef={node => { pageRefs.current[p.id] = node }}
                onRemoveElement={rb.removePrintElement}
                onUpdateElement={rb.updatePrintElement}
                onUpdateElements={rb.updatePrintElements}
                selectedIds={selection.pageId === p.id ? selection.ids : []}
                onSelect={ids => selectPage(p.id, ids)}
                tokenContext={tokenContext}
              />
            </div>
          ))}
        </div>
        {!preview && (
          <div className="pw-inspector">
            <FormatInspector
              page={selectedPage}
              selectedElements={selectedElements}
              onUpdateElement={rb.updatePrintElement}
              onRemoveElements={(pageId, ids) => { rb.removePrintElements(pageId, ids); setSelection({ pageId: null, ids: [] }) }}
              onSetZ={rb.setPrintElementZ}
              onSetZElements={rb.setPrintElementsZ}
              onBeginBatch={rb.beginPrintBatch}
              onCommitBatch={rb.commitPrintBatch}
              onGroup={rb.groupPrintElements}
              onUngroup={rb.ungroupPrintElements}
              onSaveComponent={(name, elements) => rb.addSavedComponent(name, elements)}
              savedStyles={rb.printLayout.savedStyles}
              onApplyStyle={rb.applySavedStyle}
              onSaveStyle={rb.addSavedStyle}
              visualsById={visualsById}
              form={rb.form}
            />
          </div>
        )}
      </div>

      {!preview && (
        <div className="pw-mobile-bar">
          <button onClick={() => setMobilePane(true)}>Elements &amp; Pages</button>
        </div>
      )}

      {mobilePane && (
        <>
          <div className="pw-drawer-backdrop" onClick={() => setMobilePane(false)} />
          <div className="pw-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--color-border)' }}>
              <strong style={{ fontSize: '0.9rem' }}>Elements &amp; Pages</strong>
              <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={() => setMobilePane(false)}>Done</button>
            </div>
            <div style={{ overflowY: 'auto' }}>{sidebar}</div>
          </div>
        </>
      )}

      {qualityPanelOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 129 }} onClick={() => setQualityPanelOpen(false)} />
          <div style={{
            position: 'fixed', top: 48, right: 12, width: '320px', maxHeight: '70vh', overflowY: 'auto',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 130, padding: '0.8rem',
          }}>
            <strong style={{ fontSize: '0.85rem' }}>Design Quality: {qualityScore}/100</strong>
            {qualityIssues.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>No issues found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.6rem' }}>
                {qualityIssues.map((issue, i) => (
                  <button
                    key={i} className="secondary"
                    style={{
                      fontSize: '0.78rem', textAlign: 'left', padding: '0.4rem 0.5rem',
                      borderLeft: `3px solid ${issue.severity === 'error' ? '#b91c1c' : issue.severity === 'warning' ? '#b45309' : 'var(--color-muted)'}`,
                    }}
                    onClick={() => {
                      setActivePageId(issue.pageId)
                      if (issue.elementId) selectPage(issue.pageId, [issue.elementId])
                      setQualityPanelOpen(false)
                    }}
                  >
                    {issue.message}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {presenting && (
        <PresentationMode
          printLayout={rb.printLayout}
          visualsById={visualsById}
          tilesById={tilesById}
          form={rb.form}
          submissions={rb.scopedSubmissions}
          tokenContext={tokenContext}
          onClose={() => setPresenting(false)}
        />
      )}
    </div>
  )
}
