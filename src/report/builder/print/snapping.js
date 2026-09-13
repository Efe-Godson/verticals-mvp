// Place at: src/report/builder/print/snapping.js
// Pure geometry for the freeform canvas's smart guides (Designer 2.0 Phase
// 1, step 6) - deliberately framework-free and decoupled from react-rnd's
// drag events, so the actual alignment math is unit-testable without
// mounting the canvas. DesignerCanvas.jsx just asks "given where the
// dragged box currently is, what should it snap to?" on every drag tick.
//
// All coordinates are in whatever single unit the caller passes (px, in
// DesignerCanvas's case, since that's what a live drag operates in) - this
// module doesn't know or care whether that's px or %, it just needs a
// {width, height} page and {x, y, width, height} element boxes in one
// consistent unit.
//
// Scope: drag snapping only (edges/centers against the page and other
// elements, plus a same-gap "equal spacing" check between two neighbors).
// Resize snapping and rotation-aware bounds are deliberately deferred -
// flagged in the Designer 2.0 plan as the highest-risk sub-feature, so this
// ships the core solid and testable rather than everything at once.

export const DEFAULT_TOLERANCE = 6

function candidateLines(pageSize, others, axis) {
  const lines = [
    { value: 0, source: 'page-edge' },
    { value: pageSize / 2, source: 'page-center' },
    { value: pageSize, source: 'page-edge' },
  ]
  others.forEach(el => {
    const start = axis === 'x' ? el.x : el.y
    const size = axis === 'x' ? el.width : el.height
    lines.push({ value: start, source: 'element', elementId: el.id, edge: 'start' })
    lines.push({ value: start + size / 2, source: 'element', elementId: el.id, edge: 'center' })
    lines.push({ value: start + size, source: 'element', elementId: el.id, edge: 'end' })
  })
  return lines
}

// Tries to align one of the dragged box's own reference points (start/
// center/end) against each candidate line; returns the closest match
// within tolerance, or null. `start`/`size` are along a single axis.
export function snapOneAxis(start, size, candidates, tolerance = DEFAULT_TOLERANCE) {
  const refs = [
    { point: start, kind: 'start' },
    { point: start + size / 2, kind: 'center' },
    { point: start + size, kind: 'end' },
  ]
  let best = null
  for (const ref of refs) {
    for (const cand of candidates) {
      const dist = Math.abs(ref.point - cand.value)
      if (dist <= tolerance && (!best || dist < best.dist)) {
        best = {
          dist, start: start + (cand.value - ref.point), line: cand.value,
          refKind: ref.kind, source: cand.source, elementId: cand.elementId,
        }
      }
    }
  }
  return best
}

// If the dragged box currently sits between two other elements on this axis
// with near-equal gaps, snap so both gaps become exactly equal. This is a
// same-gap check, not a full N-element equal-distribution solver - a
// reasonable v1 scope for "equal spacing" snapping.
export function snapEqualSpacing(start, size, others, axis, tolerance = DEFAULT_TOLERANCE) {
  if (others.length < 2) return null
  const dims = others
    .map(el => ({
      id: el.id,
      start: axis === 'x' ? el.x : el.y,
      end: (axis === 'x' ? el.x : el.y) + (axis === 'x' ? el.width : el.height),
    }))
    .sort((a, b) => a.start - b.start)

  const end = start + size
  const leftNeighbor = [...dims].reverse().find(d => d.end <= end)
  const rightNeighbor = dims.find(d => d.start >= start)
  if (!leftNeighbor || !rightNeighbor || leftNeighbor.id === rightNeighbor.id) return null

  const gapLeft = start - leftNeighbor.end
  const gapRight = rightNeighbor.start - end
  if (gapLeft < 0 || gapRight < 0) return null

  if (Math.abs(gapLeft - gapRight) <= tolerance) {
    const avgGap = (gapLeft + gapRight) / 2
    return { start: leftNeighbor.end + avgGap, gap: avgGap, leftId: leftNeighbor.id, rightId: rightNeighbor.id }
  }
  return null
}

// Top-level entry point: snaps both axes of a dragged box independently.
// `others` is every other element on the page, in the same unit as `box`.
export function computeSnap(box, page, others, tolerance = DEFAULT_TOLERANCE) {
  const { x, y, width, height } = box
  const snappedX = snapOneAxis(x, width, candidateLines(page.width, others, 'x'), tolerance)
  const snappedY = snapOneAxis(y, height, candidateLines(page.height, others, 'y'), tolerance)
  const equalX = !snappedX ? snapEqualSpacing(x, width, others, 'x', tolerance) : null
  const equalY = !snappedY ? snapEqualSpacing(y, height, others, 'y', tolerance) : null

  return {
    x: snappedX ? snappedX.start : (equalX ? equalX.start : x),
    y: snappedY ? snappedY.start : (equalY ? equalY.start : y),
    guideX: snappedX
      ? { type: 'align', line: snappedX.line, source: snappedX.source, elementId: snappedX.elementId }
      : equalX ? { type: 'equal-spacing', gap: equalX.gap, leftId: equalX.leftId, rightId: equalX.rightId } : null,
    guideY: snappedY
      ? { type: 'align', line: snappedY.line, source: snappedY.source, elementId: snappedY.elementId }
      : equalY ? { type: 'equal-spacing', gap: equalY.gap, leftId: equalY.leftId, rightId: equalY.rightId } : null,
  }
}
