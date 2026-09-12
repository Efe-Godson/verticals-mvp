// Place at: src/report/builder/print/PrintWorkspace.jsx
// Route: /form/:id/report/builder/print. The Print/PDF report builder
// (redesign brief §22-36): arrange existing Report Builder visuals onto A4
// pages for export, entirely separate from the interactive dashboard and
// the Builder canvas - editing this never touches either of those.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../../../Toast'
import PageSkeleton from '../../../components/PageSkeleton'
import { ErrorState } from '../../../ErrorState'
import useIsMobile from '../../../hooks/useIsMobile'
import { useReportBuilder } from '../useReportBuilder'
import { buildChartTiles } from '../../analysis/buildDashboardTiles'
import { exportPrintLayoutToPDF } from '../../../reportExport'
import PrintPage from './PrintPage'
import { TEXT_VARIANTS, defaultElementSize, PAGE_SIZES } from './printConstants'
import { buildDashboardReplicaPages } from './replicateDashboard'

const sideBtn = { fontSize: '0.78rem', padding: '0.3rem 0.5rem' }

export default function PrintWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const rb = useReportBuilder(id)
  const isMobile = useIsMobile(900)

  const [activePageId, setActivePageId] = useState(null)
  const [preview, setPreview] = useState(false)
  const [mobilePane, setMobilePane] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(null)
  const [tileSearch, setTileSearch] = useState('')
  const [visualSearch, setVisualSearch] = useState('')
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

  const visualsById = useMemo(() => Object.fromEntries((rb.visuals || []).map(v => [v.id, v])), [rb.visuals])

  // Every tile the main Report.jsx dashboard shows (trend / cart / category /
  // location / legacy-widget) - built by the exact same shared function, so
  // "every element on the report page" really does mean every element.
  const dashboardTiles = useMemo(
    () => (rb.form ? buildChartTiles(rb.form, rb.scopedSubmissions).tiles : []),
    [rb.form, rb.scopedSubmissions],
  )
  const tilesById = useMemo(() => Object.fromEntries(dashboardTiles.map(t => [t.id, t])), [dashboardTiles])

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

  async function handleSave() {
    const { error } = await rb.save()
    showToast(error ? 'Could not save print layout.' : 'Print layout saved.', error ? 'error' : 'success')
  }

  async function handleDownload() {
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

  const filteredTiles = dashboardTiles.filter(t => t.title?.toLowerCase().includes(tileSearch.trim().toLowerCase()))
  const filteredVisuals = (rb.visuals || []).filter(v => v.title?.toLowerCase().includes(visualSearch.trim().toLowerCase()))

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
                  style={{ ...sideBtn, textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}
                  onClick={() => addVisualToActivePage(v.id)}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                  <span>+</span>
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
      </div>

      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>Pages</span>
          <button className="secondary" style={sideBtn} onClick={() => setActivePageId(rb.addPrintPage(activePageId))}>+ Add page</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {pages.map((p, i) => (
            <div
              key={p.id}
              onClick={() => setActivePageId(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                background: activePageId === p.id ? 'var(--color-primary-soft)' : 'transparent', fontSize: '0.8rem',
              }}
            >
              <span style={{ flex: 1 }}>Page {i + 1}</span>
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
      </div>
    </div>
  )

  return (
    <div className="pw-workspace" style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <style>{`
        .pw-cols { display: grid; grid-template-columns: 260px 1fr; flex: 1; min-height: 0; }
        .pw-cols > * { min-height: 0; }
        .pw-side { background: var(--color-surface); border-right: 1px solid var(--color-border); overflow: hidden; }
        .pw-canvas { overflow-y: auto; padding: 1.5rem; }
        .pw-mobile-bar { display: none; }
        @media (max-width: 900px) {
          .pw-cols { grid-template-columns: 1fr; }
          .pw-side { display: none; }
          .pw-mobile-bar { display: flex; flex-shrink: 0; border-top: 1px solid var(--color-border); background: var(--color-surface); padding-bottom: env(safe-area-inset-bottom); }
          .pw-mobile-bar button { flex: 1; border-radius: 0; background: var(--color-surface); color: var(--color-text); border: none; font-size: 0.82rem; padding: 0.6rem; }
          .pw-drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 120; }
          .pw-sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 85vh; background: var(--color-surface); z-index: 121; border-radius: 16px 16px 0 0; box-shadow: 0 -4px 18px rgba(0,0,0,0.2); display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <button className="secondary" onClick={() => navigate(`/form/${id}/report/builder`)} style={{ fontSize: '0.8rem', flexShrink: 0 }}>← Exit</button>
        {!isMobile && <strong style={{ letterSpacing: '0.06em', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Print / PDF View</strong>}
        <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{rb.form?.name}</span>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button className="secondary" onClick={() => setPreview(p => !p)} style={{ fontSize: '0.8rem' }}>{preview ? 'Edit' : 'Preview'}</button>
          <button className="secondary" onClick={handleSave} disabled={rb.saving} style={{ fontSize: '0.8rem' }}>
            {rb.saving ? 'Saving…' : rb.dirty ? 'Save*' : 'Save'}
          </button>
          <button onClick={handleDownload} disabled={exporting} style={{ fontSize: '0.8rem' }}>
            {exporting ? `${exportProgress?.label || 'Exporting…'} (${exportProgress?.done ?? 0}/${exportProgress?.total ?? pages.length})` : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="pw-cols">
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
                onLayoutChange={rb.setPrintPageLayout}
                onRemoveElement={rb.removePrintElement}
                onUpdateElement={rb.updatePrintElement}
              />
            </div>
          ))}
        </div>
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
    </div>
  )
}
