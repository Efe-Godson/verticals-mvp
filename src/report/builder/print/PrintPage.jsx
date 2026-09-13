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
import ShapeElement from './elements/ShapeElement'
import ImageElement from './elements/ImageElement'
import { pageFormatMm, pageAspectRatio, PAGE_SIZES, formatPageNumber } from './printConstants'

export default function PrintPage({
  page, pageSize, orientation, visualsById, tilesById, form, submissions, editing, settings,
  pageNumber, totalPages, onRemoveElement, onUpdateElement, onUpdateElements, pageRef,
  selectedIds, onSelect,
}) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [wMm, hMm] = pageFormatMm(pageSize, orientation)
  const heightPx = width ? width * (hMm / wMm) : 0
  const maxWidthPx = (PAGE_SIZES[pageSize] || PAGE_SIZES.slide).orientable
    ? (orientation === 'landscape' ? '1000px' : '780px')
    : '1000px'

  const overflowing = page.elements.some(el => (el.y || 0) + (el.height || 0) > 100)

  function renderElementContent(el, canvasHelpers) {
    // Shapes/images own their entire visual boundary (fill, image edges) -
    // wrapping them in the generic card would double up the border/padding.
    const boxed = !(
      (el.kind === 'text' && ['title', 'big-number'].includes(el.text?.variant || 'body'))
      || el.kind === 'shape' || el.kind === 'image'
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
          />
        ) : el.kind === 'tile' ? (
          <PrintTileElement
            tile={tilesById?.[el.tileId]} editing={editing}
            onRemove={() => onRemoveElement(page.id, el.id)}
          />
        ) : el.kind === 'shape' ? (
          <ShapeElement element={el} />
        ) : el.kind === 'image' ? (
          <ImageElement element={el} editing={editing} onChange={patch => onUpdateElement(page.id, el.id, patch)} />
        ) : (
          <PrintVisualElement
            visual={visualsById[el.visualId]} form={form} submissions={submissions}
            override={el.override} editing={editing}
            onChangeOverride={ov => onUpdateElement(page.id, el.id, { override: ov })}
            onRemove={() => onRemoveElement(page.id, el.id)}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        ref={node => { containerRef.current = node; pageRef?.(node) }}
        className="print-page-canvas"
        style={{
          width: '100%', maxWidth: maxWidthPx,
          aspectRatio: pageAspectRatio(pageSize, orientation),
          background: '#fff', border: '1px solid var(--color-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden', position: 'relative', margin: '0 auto',
        }}
      >
        {width > 0 && (
          <DesignerCanvas
            page={page}
            width={width}
            height={heightPx}
            editing={editing}
            onUpdateElement={onUpdateElement}
            onUpdateElements={onUpdateElements}
            renderElement={renderElementContent}
            selectedIds={selectedIds}
            onSelect={onSelect}
          />
        )}

        {settings?.showLogo && (
          <div style={{ position: 'absolute', top: 8, left: 16, fontSize: '0.75rem', fontWeight: 800, color: '#111' }}>VerticalS</div>
        )}
        {settings?.showDate && (
          <div style={{ position: 'absolute', top: 8, right: 16, fontSize: '0.7rem', color: '#666' }}>
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
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
      </div>

      {editing && overflowing && (
        <div data-html2canvas-ignore="true" style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#b45309' }}>
          ⚠ Content overflows this page - move it to a new page or make it smaller.
        </div>
      )}
    </div>
  )
}
