// Place at: src/report/builder/print/PrintPage.jsx
// One authored A4 page (brief §24-28). A fixed-aspect-ratio white canvas -
// exported by rasterizing exactly this DOM node, so whatever fits on screen
// is what ends up on the PDF page. Not wrapped in WidthProvider: rowHeight
// has to be derived from the *measured* width together with the page's
// aspect ratio (so the grid always spans exactly one page's height), which
// WidthProvider's own width-only plumbing doesn't expose.
import { useEffect, useRef, useState } from 'react'
import GridLayout from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import PrintVisualElement from './PrintVisualElement'
import PrintTextElement from './PrintTextElement'
import PrintTileElement from './PrintTileElement'
import { pageFormatMm, pageAspectRatio, GRID_COLS, ROWS_PER_PAGE, PAGE_SIZES, formatPageNumber } from './printConstants'

export default function PrintPage({
  page, pageSize, orientation, visualsById, tilesById, form, submissions, editing, settings,
  pageNumber, totalPages, onLayoutChange, onRemoveElement, onUpdateElement, pageRef,
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
  const rowHeight = heightPx ? heightPx / ROWS_PER_PAGE : 20
  const maxWidthPx = (PAGE_SIZES[pageSize] || PAGE_SIZES.slide).orientable
    ? (orientation === 'landscape' ? '1000px' : '780px')
    : '1000px'

  const layout = page.elements.map(el => ({
    i: el.id,
    x: el.layout?.x ?? 0, y: el.layout?.y ?? 0,
    w: el.layout?.w ?? 12, h: el.layout?.h ?? 4,
    minW: 2, minH: 2,
  }))

  const overflowing = page.elements.some(el => (el.layout?.y || 0) + (el.layout?.h || 0) > ROWS_PER_PAGE)

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
          <GridLayout
            width={width}
            cols={GRID_COLS}
            rowHeight={rowHeight}
            margin={[10, 10]}
            containerPadding={[20, 34]}
            layout={layout}
            compactType="vertical"
            preventCollision={false}
            isDraggable={editing}
            isResizable={editing}
            resizeHandles={['se']}
            onLayoutChange={editing ? (l) => onLayoutChange(page.id, l) : undefined}
          >
            {page.elements.map(el => {
              // Every element gets a visible card boundary except a Title
              // block - it already reads fine spanning the page's full width
              // unboxed, the way a document's own title would.
              const boxed = !(el.kind === 'text' && (el.text?.variant || 'body') === 'title')
              return (
                <div key={el.id} style={{ height: '100%' }}>
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
                        onChange={patch => onUpdateElement(page.id, el.id, patch)}
                        onRemove={() => onRemoveElement(page.id, el.id)}
                      />
                    ) : el.kind === 'tile' ? (
                      <PrintTileElement
                        tile={tilesById?.[el.tileId]} editing={editing}
                        onRemove={() => onRemoveElement(page.id, el.id)}
                      />
                    ) : (
                      <PrintVisualElement
                        visual={visualsById[el.visualId]} form={form} submissions={submissions}
                        override={el.override} editing={editing}
                        onChangeOverride={ov => onUpdateElement(page.id, el.id, { override: ov })}
                        onRemove={() => onRemoveElement(page.id, el.id)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </GridLayout>
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
