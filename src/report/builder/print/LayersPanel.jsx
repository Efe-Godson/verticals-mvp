// Place at: src/report/builder/print/LayersPanel.jsx
// Per-page element list ordered front-to-back by zIndex (Designer 2.0
// Phase 1, step 9) - drag to restack, click to select, toggle
// visibility/lock inline. Only meaningful once elements carry a real
// zIndex (the freeform canvas), so PrintWorkspace only renders this when
// the freeform canvas toggle is on.
import { useState } from 'react'

function labelForElement(el, visualsById, tilesById) {
  if (el.kind === 'text') return el.text?.content?.trim().slice(0, 28) || `${el.text?.variant || 'Text'} (empty)`
  if (el.kind === 'visual') return visualsById?.[el.visualId]?.title || 'Chart'
  if (el.kind === 'tile') return tilesById?.[el.tileId]?.title || 'Dashboard tile'
  if (el.kind === 'shape') return `Shape - ${(el.shape || 'rectangle').replace('-', ' ')}`
  if (el.kind === 'image') return el.src ? 'Image' : 'Image (empty)'
  return 'Element'
}

export default function LayersPanel({ page, visualsById, tilesById, selectedIds = [], onSelect, onUpdateElement, onReorder }) {
  const [dragId, setDragId] = useState(null)

  if (!page || page.elements.length === 0) {
    return <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.2rem 0' }}>No elements on this page yet.</p>
  }

  const sorted = [...page.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const ids = sorted.map(el => el.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) { setDragId(null); return }
    ids.splice(from, 1)
    ids.splice(to, 0, dragId)
    onReorder(ids)
    setDragId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      {sorted.map(el => {
        const selected = selectedIds.includes(el.id)
        const visible = el.visible !== false
        return (
          <div
            key={el.id}
            draggable
            onDragStart={() => setDragId(el.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(el.id)}
            onClick={() => onSelect([el.id])}
            title="Drag to restack"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.4rem',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem',
              background: selected ? 'var(--color-primary-soft)' : 'transparent',
              opacity: visible ? 1 : 0.5,
            }}
          >
            <button
              className="secondary" style={{ padding: '0 0.25rem', fontSize: '0.75rem' }}
              title={visible ? 'Hide' : 'Show'}
              onClick={e => { e.stopPropagation(); onUpdateElement(page.id, el.id, { visible: !visible }) }}
            >
              {visible ? '👁' : '🚫'}
            </button>
            <button
              className="secondary" style={{ padding: '0 0.25rem', fontSize: '0.75rem' }}
              title={el.locked ? 'Unlock' : 'Lock'}
              onClick={e => { e.stopPropagation(); onUpdateElement(page.id, el.id, { locked: !el.locked }) }}
            >
              {el.locked ? '🔒' : '🔓'}
            </button>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {labelForElement(el, visualsById, tilesById)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
