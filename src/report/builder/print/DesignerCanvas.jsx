// Place at: src/report/builder/print/DesignerCanvas.jsx
// Freeform canvas v0 (Designer 2.0 Phase 1, step 4) - renders one page's
// elements as absolutely-positioned react-rnd boxes instead of PrintPage's
// <GridLayout>. Elements are stored in percent-of-page coordinates
// (elementModel.js); this component converts to pixels for react-rnd's own
// prop shape and converts back on every drag/resize stop, writing straight
// onto the canonical x/y/width/height fields - no grid-cell math involved
// here, that's gridAdapter.js's job for the legacy renderer this replaces.
//
// v0 scope only: single-element drag + resize, click-to-select. No
// rotation, multi-select, snapping, layers, or keyboard handling yet -
// those land in later Phase 1 steps. Kept behind a toggle in PrintPage.jsx
// so the existing GridLayout path stays the default until this is proven.
import { useState } from 'react'
import { Rnd } from 'react-rnd'

export default function DesignerCanvas({ page, width, height, editing, onUpdateElement, renderElement }) {
  const [selectedId, setSelectedId] = useState(null)

  if (!width || !height) return null

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => setSelectedId(null)}
    >
      {page.elements.map(el => {
        const x = ((el.x || 0) / 100) * width
        const y = ((el.y || 0) / 100) * height
        const w = Math.max(8, ((el.width || 10) / 100) * width)
        const h = Math.max(8, ((el.height || 10) / 100) * height)
        const selected = editing && selectedId === el.id

        return (
          <Rnd
            key={el.id}
            size={{ width: w, height: h }}
            position={{ x, y }}
            bounds="parent"
            enableResizing={editing && !el.locked}
            disableDragging={!editing || el.locked}
            style={{ zIndex: el.zIndex || 1, visible: el.visible === false ? 'hidden' : 'visible' }}
            onDragStart={() => setSelectedId(el.id)}
            onDragStop={(e, d) => {
              onUpdateElement(page.id, el.id, {
                x: (d.x / width) * 100,
                y: (d.y / height) * 100,
              })
            }}
            onResizeStart={() => setSelectedId(el.id)}
            onResizeStop={(e, dir, ref, delta, pos) => {
              onUpdateElement(page.id, el.id, {
                x: (pos.x / width) * 100,
                y: (pos.y / height) * 100,
                width: (ref.offsetWidth / width) * 100,
                height: (ref.offsetHeight / height) * 100,
              })
            }}
          >
            <div
              onClick={e => { e.stopPropagation(); if (editing) setSelectedId(el.id) }}
              style={{
                width: '100%', height: '100%', boxSizing: 'border-box',
                outline: selected ? '2px solid var(--color-primary, #2563eb)' : 'none',
                outlineOffset: '2px',
                display: el.visible === false ? 'none' : 'block',
              }}
            >
              {renderElement(el)}
            </div>
          </Rnd>
        )
      })}
    </div>
  )
}
