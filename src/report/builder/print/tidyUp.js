// Place at: src/report/builder/print/tidyUp.js
// Automatic Tidy Up (Designer 2.0 Phase 3). Scoped deliberately narrow -
// snaps every element's x/y/width/height to a coarse grid (cleans up
// sub-percent misalignment from freehand dragging) and clamps anything
// extending off the page back within bounds. It does NOT attempt to
// resolve overlaps by repositioning elements - untangling an arbitrary
// overlap automatically is a real auto-layout problem on its own and
// getting it wrong (silently moving something the user placed on purpose)
// is worse than leaving it flagged in the Design Quality panel instead.
//
// Pure - returns a patch map ({elementId: {x,y,width,height}}, only for
// elements that actually change) rather than mutating anything, so the
// caller applies it in one updatePrintElements call - one undo step for
// the whole tidy, which the plan calls out as a hard requirement (this is
// exactly the "must batch correctly" shape updatePrintElements exists
// for - see useReportBuilder.js).
const GRID_PCT = 1

function snap(v) {
  return Math.round(v / GRID_PCT) * GRID_PCT
}

function clampBox({ x, y, width, height }) {
  const w = Math.min(100, Math.max(1, width))
  const h = Math.min(100, Math.max(1, height))
  const cx = Math.min(100 - w, Math.max(0, x))
  const cy = Math.min(100 - h, Math.max(0, y))
  return { x: cx, y: cy, width: w, height: h }
}

export function tidyPage(page) {
  const patches = {}
  ;(page.elements || []).forEach(el => {
    if (el.locked) return
    const clamped = clampBox(el)
    const next = { x: snap(clamped.x), y: snap(clamped.y), width: snap(clamped.width), height: snap(clamped.height) }
    if (next.x !== el.x || next.y !== el.y || next.width !== el.width || next.height !== el.height) {
      patches[el.id] = next
    }
  })
  return patches
}
