// Place at: src/report/builder/print/DesignerCanvas.jsx
// Freeform canvas (Designer 2.0 Phase 1, steps 4-5) - renders one page's
// elements as absolutely-positioned react-rnd boxes instead of PrintPage's
// <GridLayout>. Elements are stored in percent-of-page coordinates
// (elementModel.js); this component converts to pixels for react-rnd's own
// prop shape and converts back on every drag/resize stop, writing straight
// onto the canonical x/y/width/height fields - no grid-cell math involved
// here, that's gridAdapter.js's job for the legacy renderer this replaces.
//
// Selection is a controlled prop (selectedIds/onSelect), not local state:
// a report has many pages, each with its own DesignerCanvas instance, but
// only one Format Inspector - the selection has to live one level up
// (PrintWorkspace.jsx) so the inspector always reflects whichever page's
// element is actually selected, and so keyboard delete can work globally.
//
// Rotation is CSS-only: react-rnd has no rotation concept, so the Rnd box
// itself stays axis-aligned (that's what drag/resize/bounds operate on) and
// `rotation` is applied as a transform on the inner content only. Resize
// handles not rotating with the shape is a deliberate v1 simplification;
// revisit once snapping needs to reason about rotated bounding boxes.
//
// Multi-select drag: only the actively-dragged Rnd instance gets real
// position updates while dragging; the other selected elements get a
// transient CSS translate so the whole group visibly moves together, and
// all of them are committed to their real x/y on drag stop.
import { useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { snapBoxToGrid } from './tidyUp'

const ROTATE_HANDLE_SIZE = 10

export default function DesignerCanvas({
  page, width, height, editing, onUpdateElement, onUpdateElements, renderElement,
  selectedIds = [], onSelect, onTextEdit,
}) {
  const [marquee, setMarquee] = useState(null) // {x0,y0,x1,y1} in px, canvas-local
  const [groupDrag, setGroupDrag] = useState(null) // {activeId, dx, dy} in px
  const [rotating, setRotating] = useState(null) // {id, value} in degrees
  const containerRef = useRef(null)
  const rndRefs = useRef({})

  if (!width || !height) return null

  const toPct = (px, total) => (px / total) * 100
  const clampPct = (v) => Math.min(100, Math.max(0, v))

  function elementBoxPx(el) {
    const x = ((el.x || 0) / 100) * width
    const y = ((el.y || 0) / 100) * height
    const w = Math.max(8, ((el.width || 10) / 100) * width)
    const h = Math.max(8, ((el.height || 10) / 100) * height)
    return { x, y, w, h }
  }

  // A grouped element (Phase 2's Group/Ungroup) always selects its whole
  // group together - clicking one member is clicking the group.
  function groupSelectionFor(id) {
    const el = page.elements.find(o => o.id === id)
    if (!el?.groupId) return [id]
    return page.elements.filter(o => o.groupId === el.groupId).map(o => o.id)
  }

  function handleDoubleSelect(id, e) {
    if (!editing) return
    if (e.shiftKey) {
      onSelect(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, ...groupSelectionFor(id)])
    } else if (selectedIds.includes(id)) {
      onSelect([])
    } else {
      onSelect(groupSelectionFor(id))
    }
  }

  function handleCanvasMouseDown(e) {
    if (!editing || e.target !== containerRef.current) return
    onSelect([])
    const rect = containerRef.current.getBoundingClientRect()
    const x0 = e.clientX - rect.left
    const y0 = e.clientY - rect.top
    setMarquee({ x0, y0, x1: x0, y1: y0 })

    function onMove(ev) {
      setMarquee(m => m ? { ...m, x1: ev.clientX - rect.left, y1: ev.clientY - rect.top } : m)
    }
    function onUp(ev) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const x1 = ev.clientX - rect.left
      const y1 = ev.clientY - rect.top
      const box = { left: Math.min(x0, x1), right: Math.max(x0, x1), top: Math.min(y0, y1), bottom: Math.max(y0, y1) }
      const hit = page.elements
        .filter(el => {
          const b = elementBoxPx(el)
          return b.x < box.right && b.x + b.w > box.left && b.y < box.bottom && b.y + b.h > box.top
        })
        .map(el => el.id)
      onSelect(hit)
      setMarquee(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startRotate(el, e) {
    e.stopPropagation()
    e.preventDefault()
    const box = elementBoxPx(el)
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + box.x + box.w / 2
    const centerY = rect.top + box.y + box.h / 2
    const startRotation = el.rotation || 0
    const angleFromCenter = (clientX, clientY) => Math.atan2(clientX - centerX, -(clientY - centerY)) * (180 / Math.PI)
    const startAngle = angleFromCenter(e.clientX, e.clientY)

    function onMove(ev) {
      let next = startRotation + (angleFromCenter(ev.clientX, ev.clientY) - startAngle)
      next = ((next % 360) + 360) % 360
      if (ev.shiftKey) next = Math.round(next / 15) * 15
      setRotating({ id: el.id, value: next })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setRotating(r => {
        if (r) onUpdateElement(page.id, el.id, { rotation: r.value })
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseDown={handleCanvasMouseDown}
    >
      {page.elements.map(el => {
        const { x, y, w, h } = elementBoxPx(el)
        const selected = editing && selectedIds.includes(el.id)
        const isGroupDrag = selectedIds.length > 1
        const rotation = rotating?.id === el.id ? rotating.value : (el.rotation || 0)
        const groupOffset = (groupDrag && groupDrag.activeId !== el.id && selectedIds.includes(el.id))
          ? `translate(${groupDrag.dx}px, ${groupDrag.dy}px)` : undefined

        return (
          <Rnd
            key={el.id}
            ref={r => { rndRefs.current[el.id] = r }}
            size={{ width: w, height: h }}
            position={{ x, y }}
            bounds="parent"
            dragGrid={[width / 100, height / 100]}
            resizeGrid={[width / 100, height / 100]}
            enableResizing={editing && !el.locked && selected && !isGroupDrag}
            disableDragging={!editing || el.locked}
            style={{ zIndex: selected ? 1000 : (el.zIndex || 1), transform: groupOffset }}
            onDrag={(e, d) => {
              if (isGroupDrag && selectedIds.includes(el.id)) {
                setGroupDrag({ activeId: el.id, dx: d.x - x, dy: d.y - y })
                return
              }
              const snap = snapBoxToGrid({ x: toPct(d.x, width), y: toPct(d.y, height), width: el.width, height: el.height })
              rndRefs.current[el.id]?.updatePosition({ x: snap.x * width / 100, y: snap.y * height / 100 })
            }}
            onDragStop={(e, d) => {
              if (isGroupDrag && selectedIds.includes(el.id)) {
                const dx = d.x - x, dy = d.y - y
                // One bulk call, not N onUpdateElement calls - so moving a
                // group together is a single undo step (see
                // updatePrintElements in useReportBuilder.js).
                const patches = {}
                selectedIds.forEach(id => {
                  const other = page.elements.find(o => o.id === id)
                  if (!other || other.locked) return
                  const ob = elementBoxPx(other)
                  patches[id] = {
                    x: clampPct(toPct(ob.x + dx, width)),
                    y: clampPct(toPct(ob.y + dy, height)),
                  }
                })
                onUpdateElements(page.id, patches)
                setGroupDrag(null)
              } else {
                onUpdateElement(page.id, el.id, { x: clampPct(toPct(d.x, width)), y: clampPct(toPct(d.y, height)) })
              }
            }}
            onResizeStop={(e, dir, ref, delta, pos) => {
              onUpdateElement(page.id, el.id, {
                x: clampPct(toPct(pos.x, width)), y: clampPct(toPct(pos.y, height)),
                width: clampPct(toPct(ref.offsetWidth, width)), height: clampPct(toPct(ref.offsetHeight, height)),
              })
            }}
          >
            <div
              onDoubleClick={e => {
                // Text elements open the Format panel's text editor modal
                // (PrintWorkspace.jsx's openTextEditor/textEditor state) on
                // double-click instead of the plain select-toggle every
                // other element kind gets - matches the "Double-click to
                // edit..." placeholder PrintTextElement.jsx already shows.
                if (el.kind === 'text' && el.text?.variant !== 'divider' && onTextEdit) {
                  if (!selectedIds.includes(el.id)) onSelect(groupSelectionFor(el.id))
                  onTextEdit(page.id, el.id)
                } else {
                  handleDoubleSelect(el.id, e)
                }
              }}
              data-print-el-id={el.id}
              style={{
                width: '100%', height: '100%', position: 'relative',
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                transformOrigin: 'center center',
                outline: selected ? '2px solid var(--color-primary, #2563eb)' : 'none',
                outlineOffset: '2px',
                display: el.visible === false ? 'none' : 'block',
                opacity: el.locked ? 0.85 : 1,
              }}
            >
              {renderElement(el)}
              {selected && !el.locked && !isGroupDrag && (
                <div
                  data-html2canvas-ignore="true"
                  onMouseDown={e => startRotate(el, e)}
                  title="Drag to rotate (hold Shift to snap to 15°)"
                  style={{
                    position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
                    width: ROTATE_HANDLE_SIZE, height: ROTATE_HANDLE_SIZE, borderRadius: '50%',
                    background: 'var(--color-primary, #2563eb)', border: '2px solid #fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', cursor: 'grab',
                  }}
                />
              )}
            </div>
          </Rnd>
        )
      })}

      {marquee && (
        <div
          data-html2canvas-ignore="true"
          style={{
            position: 'absolute',
            left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
            background: 'rgba(37,99,235,0.1)', border: '1px solid var(--color-primary, #2563eb)',
            pointerEvents: 'none',
          }}
        />
      )}

    </div>
  )
}
