// Place at: src/report/builder/print/elementModel.js
// Canonical Designer element shape for the freeform canvas (Designer 2.0
// Phase 1 - see the "Designer 2.0" plan). Position/size are percentages of
// the page's content box (0-100), not pixels/millimetres/grid cells - so an
// element's placement survives a page-size or orientation switch (A4 <->
// Slide) without any reconversion, the same way PrintPage.jsx's own
// rendering already survives its ResizeObserver-measured-width scaling.
//
// Shape: { id, kind, x, y, width, height, rotation, zIndex, locked, visible,
//          ...kind-specific fields }
// 'visual'/'tile' elements are still created directly by useReportBuilder's
// addPrintElement (they wrap a Report Builder reference, not authored
// content), so only the kinds genuinely new in Phase 1 - text/shape/image -
// get factories here.

export const CURRENT_SCHEMA_VERSION = 2

let seq = 0
function newElementId() {
  seq += 1
  return `el_${Date.now().toString(36)}_${seq}`
}

// Starting size (% of the page content box) for a freshly-added element.
// Visuals/tiles keep the roomier size a chart needs to read; text/shapes/
// images start smaller since they're usually one piece of a composed page.
export const DEFAULT_ELEMENT_SIZE = {
  text: { width: 100, height: 12 },
  shape: { width: 20, height: 20 },
  image: { width: 30, height: 20 },
  visual: { width: 50, height: 40 },
  tile: { width: 50, height: 40 },
}

const BASE_DEFAULTS = { x: 0, y: 0, rotation: 0, zIndex: 1, locked: false, visible: true }

function makeBase(kind, overrides = {}) {
  const size = DEFAULT_ELEMENT_SIZE[kind] || { width: 30, height: 20 }
  return { id: newElementId(), kind, ...BASE_DEFAULTS, ...size, ...overrides }
}

export function makeTextElement({ variant = 'body', content = '', align = 'left', bold = false, ...overrides } = {}) {
  return makeBase('text', { text: { variant, content, align, bold }, ...overrides })
}

export const SHAPE_TYPES = ['rectangle', 'rounded-rectangle', 'circle', 'ellipse', 'line', 'arrow', 'divider']

export function makeShapeElement({ shape = 'rectangle', fill = '#e5e7eb', stroke = '#111827', strokeWidth = 1, radius = 0, opacity = 1, ...overrides } = {}) {
  return makeBase('shape', { shape, fill, stroke, strokeWidth, radius, opacity, ...overrides })
}

export function makeImageElement({ src = '', fit = 'cover', opacity = 1, radius = 0, crop = null, ...overrides } = {}) {
  return makeBase('image', { src, fit, opacity, radius, crop, ...overrides })
}
