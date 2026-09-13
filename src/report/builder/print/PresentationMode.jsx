// Place at: src/report/builder/print/PresentationMode.jsx
// Fullscreen presentation preview (Designer 2.0 Phase 3) - reuses PrintPage
// in its existing editing=false mode, per the plan's own note that this is
// the lowest-risk item in Phase 3: no new rendering path, just a fullscreen
// frame + page-by-page navigation around the same component the on-screen
// canvas and the PDF/PPTX export already trust.
import { useEffect, useState } from 'react'
import PrintPage from './PrintPage'

export default function PresentationMode({ printLayout, visualsById, tilesById, form, submissions, tokenContext, onClose }) {
  const pages = printLayout?.pages || []
  const [index, setIndex] = useState(0)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') setIndex(i => Math.min(pages.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pages.length, onClose])

  if (pages.length === 0) return null
  const page = pages[Math.min(index, pages.length - 1)]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#111', zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <button
        className="secondary" onClick={onClose}
        style={{ position: 'absolute', top: 16, right: 16, fontSize: '0.85rem' }}
      >
        ✕ Exit (Esc)
      </button>
      <div style={{ width: '100%', maxWidth: '1100px' }}>
        <PrintPage
          page={page}
          pageSize={printLayout.pageSize}
          orientation={printLayout.orientation}
          visualsById={visualsById}
          tilesById={tilesById}
          form={form}
          submissions={submissions}
          editing={false}
          settings={printLayout}
          pageNumber={index + 1}
          totalPages={pages.length}
          selectedIds={[]}
          onSelect={() => {}}
          onRemoveElement={() => {}}
          onUpdateElement={() => {}}
          onUpdateElements={() => {}}
          tokenContext={tokenContext}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        <button className="secondary" disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}>← Prev</button>
        <span style={{ color: '#fff', fontSize: '0.85rem' }}>{index + 1} / {pages.length}</span>
        <button className="secondary" disabled={index === pages.length - 1} onClick={() => setIndex(i => Math.min(pages.length - 1, i + 1))}>Next →</button>
      </div>
    </div>
  )
}
