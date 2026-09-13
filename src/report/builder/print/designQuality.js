// Place at: src/report/builder/print/designQuality.js
// Design Quality scoring + Export preflight (Designer 2.0 Phase 3) share
// one analysis engine, deliberately framework-free (same pattern as
// snapping.js/zOrder.js/history.js) so it's usable both from an on-demand
// "Design Quality" panel (a score + browsable issue list) and from a
// pre-export confirm dialog (the same issues, framed as a checklist) -
// see PrintWorkspace.jsx's DesignQualityPanel/handleDownload*.
//
// Every check is geometry/content-shape only (percent-of-page positions,
// text length, references that don't resolve) - nothing here re-renders
// or measures real DOM, so it can run instantly on every page without a
// mount.

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

const SEVERITY = { error: 3, warning: 2, info: 1 }

export function analyzePage(page, { visualsById, tilesById } = {}) {
  const issues = []
  const elements = (page.elements || []).filter(el => el.visible !== false)

  elements.forEach(el => {
    if (el.x < -0.5 || el.y < -0.5 || el.x + el.width > 100.5 || el.y + el.height > 100.5) {
      issues.push({ severity: 'error', pageId: page.id, elementId: el.id, message: `${describeElement(el, visualsById, tilesById)} extends off the page.` })
    }
    if (el.kind === 'text' && !el.text?.content?.trim() && el.text?.variant !== 'divider') {
      issues.push({ severity: 'warning', pageId: page.id, elementId: el.id, message: 'Empty text box.' })
    }
    if (el.kind === 'visual' && !visualsById?.[el.visualId]) {
      issues.push({ severity: 'error', pageId: page.id, elementId: el.id, message: 'Chart reference is broken (the visual was deleted).' })
    }
    if (el.kind === 'tile' && !tilesById?.[el.tileId]) {
      issues.push({ severity: 'error', pageId: page.id, elementId: el.id, message: 'Dashboard tile reference is broken.' })
    }
    if (el.kind === 'image' && !el.src) {
      issues.push({ severity: 'warning', pageId: page.id, elementId: el.id, message: 'Image placeholder has no image uploaded yet.' })
    }
    if (el.kind === 'text' && el.text?.variant === 'small' && (el.width * el.height) < 3) {
      issues.push({ severity: 'info', pageId: page.id, elementId: el.id, message: 'Very small text box - may be hard to read.' })
    }
  })

  // Overlap check: only elements with real visual area (not dividers/lines).
  const boxed = elements.filter(el => el.kind !== 'shape' || !['line', 'divider'].includes(el.shape))
  for (let i = 0; i < boxed.length; i++) {
    for (let j = i + 1; j < boxed.length; j++) {
      if (overlaps(boxed[i], boxed[j])) {
        issues.push({
          severity: 'warning', pageId: page.id, elementId: boxed[i].id,
          message: `${describeElement(boxed[i], visualsById, tilesById)} overlaps ${describeElement(boxed[j], visualsById, tilesById)}.`,
        })
      }
    }
  }

  if (elements.length > 12) {
    issues.push({ severity: 'info', pageId: page.id, elementId: null, message: `${elements.length} elements on one page - consider splitting across pages.` })
  }

  return issues
}

function describeElement(el, visualsById, tilesById) {
  if (el.kind === 'text') return `"${(el.text?.content || '').slice(0, 20) || 'Text'}"`
  if (el.kind === 'visual') return visualsById?.[el.visualId]?.title || 'Chart'
  if (el.kind === 'tile') return tilesById?.[el.tileId]?.title || 'Dashboard tile'
  if (el.kind === 'shape') return `Shape (${el.shape})`
  if (el.kind === 'image') return 'Image'
  return 'Element'
}

export function analyzeReport(printLayout, context) {
  return (printLayout?.pages || []).flatMap(page => analyzePage(page, context))
}

// A simple deduction score: errors hurt most, then warnings, then info.
// Not calibrated against any external benchmark - just a fast, consistent
// way to say "this report has gotten messier" across edits.
export function scoreReport(issues) {
  const deduction = issues.reduce((sum, i) => sum + SEVERITY[i.severity] * 4, 0)
  return Math.max(0, 100 - deduction)
}
