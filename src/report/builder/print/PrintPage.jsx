// Place at: src/report/builder/print/PrintPage.jsx
// One authored page (brief §24-28). A fixed-aspect-ratio white canvas -
// exported by rasterizing exactly this DOM node, so whatever fits on screen
// is what ends up on the PDF page. Renders via DesignerCanvas (Designer 2.0
// Phase 1's freeform canvas) - the earlier react-grid-layout renderer was
// removed at cutover (plan step 13); gridAdapter.js's fromGridCells/
// resolveElementSize stay only as a units adapter for default-size inputs
// (printConstants.js's defaultElementSize, replicateDashboard.js's output),
// unrelated to which component renders a page.
import { useEffect, useRef, useState } from 'react'
import DesignerCanvas from './DesignerCanvas'
import PrintVisualElement from './PrintVisualElement'
import PrintTextElement from './PrintTextElement'
import PrintTileElement from './PrintTileElement'
import PrintKpiElement from './PrintKpiElement'
import ShapeElement from './elements/ShapeElement'
import ImageElement from './elements/ImageElement'
import DateRangeElement from './elements/DateRangeElement'
import { pageFormatMm, pageAspectRatio, PAGE_SIZES, formatPageNumber } from './printConstants'
import { themeCssVars } from './theme'

export default function PrintPage({
  page, pageSize, orientation, visualsById, tilesById, kpisById, form, submissions, editing, settings,
  pageNumber, totalPages, onRemoveElement, onUpdateElement, onUpdateElements, pageRef,
  selectedIds, onSelect, onTextEdit, tokenContext, tileControls, onTileControlChange,
}) {
  const pageRefInternal = useRef(null)
  const contentRef = useRef(null)
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
  const { width, height: contentHeight } = contentSize

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect) setContentSize({ width: rect.width, height: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [wMm, hMm] = pageFormatMm(pageSize, orientation)
  const maxWidthPx = (PAGE_SIZES[pageSize] || PAGE_SIZES.slide).orientable
    ? (orientation === 'landscape' ? '1000px' : '780px')
    : '1000px'

  const overflowing = page.elements.some(el => (el.y || 0) + (el.height || 0) > 100)
  const pageVisual = page.elements.find(el => el.kind === 'visual' || el.kind === 'tile')
  const pageTitle = pageVisual?.kind === 'visual'
    ? visualsById?.[pageVisual.visualId]?.title
    : pageVisual?.kind === 'tile'
      ? tilesById?.[pageVisual.tileId]?.title
      : null

  function renderElementContent(el, canvasHelpers) {
    // Shapes/images own their entire visual boundary (fill, image edges) -
    // wrapping them in the generic card would double up the border/padding.
    const boxed = !(
      (el.kind === 'text' && ['title', 'big-number'].includes(el.text?.variant || 'body'))
      || el.kind === 'shape' || el.kind === 'image' || el.kind === 'date-range'
      || el.kind === 'visual' || el.kind === 'tile' || el.kind === 'kpi'
    )
    return (
      <div
        style={{
          height: '100%', boxSizing: 'border-box', overflow: 'hidden',
          ...(boxed
            ? { border: '1px solid #ddd', borderRadius: '8px', background: '#fff', padding: '1rem' }
            : { padding: '0.2rem 0' }),
        }}
      >
        {el.kind === 'text' ? (
          <PrintTextElement
            element={el} editing={editing}
            directEdit={false}
            onEditingChange={canvasHelpers?.onEditingChange}
            onChange={patch => onUpdateElement(page.id, el.id, patch)}
            onRemove={() => onRemoveElement(page.id, el.id)}
            tokenContext={tokenContext}
          />
        ) : el.kind === 'tile' ? (
          <PrintTileElement
            tile={tilesById?.[el.tileId]}
            controls={false}
            controlState={tileControls?.[el.tileId]}
            onControlChange={patch => onTileControlChange?.(el.tileId, patch)}
          />
        ) : el.kind === 'kpi' ? (
          <PrintKpiElement kpi={kpisById?.[el.kpiLabel]} />
        ) : el.kind === 'shape' ? (
          <ShapeElement element={el} />
        ) : el.kind === 'image' ? (
          <ImageElement element={el} editing={editing} onChange={patch => onUpdateElement(page.id, el.id, patch)} />
        ) : el.kind === 'date-range' ? (
          <DateRangeElement element={el} />
        ) : (
          <PrintVisualElement
            visual={visualsById[el.visualId]} form={form} submissions={submissions}
            override={el.override}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        ref={node => { pageRefInternal.current = node; pageRef?.(node) }}
        className="print-page-canvas"
        style={{
          width: '100%', maxWidth: maxWidthPx,
          aspectRatio: pageAspectRatio(pageSize, orientation),
          background: 'var(--designer-bg, #fff)', border: '1px solid var(--color-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden', position: 'relative', margin: '0 auto',
          ...themeCssVars(settings?.theme),
        }}
      >
        <div
          ref={contentRef}
          style={{
            position: 'absolute', inset: '42px 24px 30px',
            border: editing ? '1px dashed rgba(37,99,235,0.28)' : 'none',
            boxSizing: 'border-box',
          }}
        >
          {width > 0 && contentHeight > 0 && (
            <DesignerCanvas
              page={page}
              width={width}
              height={contentHeight}
              editing={editing}
              onUpdateElement={onUpdateElement}
              onUpdateElements={onUpdateElements}
              renderElement={renderElementContent}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onTextEdit={onTextEdit}
            />
          )}
        </div>

        {/* Master page overlay (Phase 2) - logo/date/page-number/watermark
            plus optional header/footer text, all hideable per-page for a
            full-bleed cover/section page. */}
        {!page.hideMaster && (
          <>
            <div style={{ position: 'absolute', top: 8, left: 16, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#111' }}>
              {settings?.showLogo && <strong>VerticalS</strong>}
              {(settings?.masterHeaderText || pageTitle || form?.name) && <span>{settings.masterHeaderText || pageTitle || form.name}</span>}
            </div>
            {settings?.showDate && (
              <div style={{ position: 'absolute', top: 8, right: 16, fontSize: '0.7rem', color: '#666' }}>
                {new Date(settings.reportDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )}
            {settings?.masterFooterText && (
              <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: '0.65rem', color: '#888' }}>
                {settings.masterFooterText}
              </div>
            )}
            {settings?.showPageNumber && (page.kind !== 'title' || settings?.numberTitlePage) && (
              <div style={{ position: 'absolute', bottom: 6, right: 16, fontSize: '0.7rem', color: '#666' }}>
                {formatPageNumber(settings?.pageNumberFormat, pageNumber, totalPages)}
              </div>
            )}
            {settings?.showWatermark && (
              <div style={{ position: 'absolute', bottom: 6, left: 16, fontSize: '0.65rem', color: '#aaa' }}>Powered by Verticals</div>
            )}
          </>
        )}
      </div>

      {editing && overflowing && (
        <div data-html2canvas-ignore="true" style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#b45309' }}>
          ⚠ Content overflows this page - move it to a new page or make it smaller.
        </div>
      )}
    </div>
  )
}
