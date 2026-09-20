// Place at: src/report/builder/print/exportPptx.js
// Real PPTX export (Designer 2.0 Phase 2) - a new vector-ish path, separate
// from reportExport.js's rasterized PDF pipeline. Text and shape elements
// are walked from elementModel.js straight into native PowerPoint text
// boxes/shapes (editable in PowerPoint, not just a picture); visual/tile
// chart elements have no vector representation available here (no OOXML
// chart-building from a StandardResult), so each is individually
// rasterized via html2canvas and dropped in as an image - same descoped
// compromise the plan makes elsewhere (e.g. table pagination) rather than
// leaving native chart export unbuilt entirely. Image elements embed their
// src directly.
import PptxGenJS from 'pptxgenjs'
import html2canvas from 'html2canvas'
import { pageFormatMm } from './printConstants'
import { formatDateRangeDisplay } from '../../helpers/dateRange'

const MM_PER_INCH = 25.4

function hex(color) {
  return (color || '#000000').replace('#', '')
}

// pctToIn: converts an element's percent-of-page x/y/width/height into
// inches, given the page's own size in inches - same percent-of-content-box
// convention elementModel.js already uses for on-screen rendering.
function boxIn(el, pageWIn, pageHIn) {
  return {
    x: ((el.x || 0) / 100) * pageWIn,
    y: ((el.y || 0) / 100) * pageHIn,
    w: (Math.max(el.width || 0, 1) / 100) * pageWIn,
    h: (Math.max(el.height || 0, 1) / 100) * pageHIn,
  }
}

const SHAPE_TYPE_MAP = {
  'rectangle': 'rect', 'rounded-rectangle': 'roundRect', 'circle': 'ellipse', 'ellipse': 'ellipse',
  'line': 'line', 'arrow': 'rightArrow', 'divider': 'line',
}

const TEXT_FONT_SIZE_PT = { title: 32, heading: 22, body: 14, small: 11, caption: 10, 'big-number': 40 }
const TEXT_BOLD_DEFAULT = { title: true, heading: true }

function addTextElement(slide, el, box) {
  const text = el.text || {}
  slide.addText(text.content || '', {
    x: box.x, y: box.y, w: box.w, h: box.h,
    fontSize: TEXT_FONT_SIZE_PT[text.variant] || 14,
    bold: text.bold ?? !!TEXT_BOLD_DEFAULT[text.variant],
    align: text.align || 'left',
    color: hex(text.color || '#111827'),
    rotate: el.rotation || 0,
    valign: 'top',
  })
}

function addShapeElement(pptx, slide, el, box) {
  if (el.shape === 'divider') {
    slide.addShape('line', {
      x: box.x, y: box.y + box.h / 2, w: box.w, h: 0,
      line: { color: hex(el.stroke), width: el.strokeWidth || 1 },
      rotate: el.rotation || 0,
    })
    return
  }
  const shapeType = SHAPE_TYPE_MAP[el.shape] || 'rect'
  slide.addShape(shapeType, {
    x: box.x, y: box.y, w: box.w, h: box.h,
    fill: { color: hex(el.fill), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) },
    line: el.strokeWidth ? { color: hex(el.stroke), width: el.strokeWidth } : { type: 'none' },
    rotate: el.rotation || 0,
  })
}

// The date-range card renders as a computed string (DateRangeElement.jsx),
// never typed-in content - recomputed here from the element's own
// preset/format fields via the same shared helper, rather than reading
// el.text.content (there isn't one) or rasterizing the card as an image.
function addDateRangeElement(slide, el, box) {
  const label = formatDateRangeDisplay(el.preset, el.customStart, el.customEnd, el.format)
  slide.addText(label, {
    x: box.x, y: box.y, w: box.w, h: box.h,
    fontSize: el.fontSize || 14, bold: !!el.bold, align: el.align || 'center', valign: 'middle',
    // pptxgenjs wants one bare font name, not a CSS font-stack (elementModel.js
    // stores fontFamily the same "Segoe UI, sans-serif" way PrintTextElement.jsx
    // hands straight to CSS) - only the first name transfers.
    fontFace: el.fontFamily ? el.fontFamily.split(',')[0].trim() : undefined,
    color: hex(el.color || '#334155'), fill: { color: hex(el.fill || '#ffffff') },
    line: { color: hex(el.stroke || '#cbd5e1'), width: 1 },
    shape: 'roundRect', rectRadius: 0.5, // 0.0-1.0 ratio (pptxgenjs), not a length - 0.5 reads as a full pill for a short/wide card
    rotate: el.rotation || 0,
  })
}

async function addRasterizedElement(slide, pageNode, el, box) {
  const node = pageNode?.querySelector(`[data-print-el-id="${el.id}"]`)
  if (!node) return
  try {
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: null, useCORS: true })
    slide.addImage({ data: canvas.toDataURL('image/png'), x: box.x, y: box.y, w: box.w, h: box.h, rotate: el.rotation || 0 })
  } catch { /* skip this element rather than fail the whole export */ }
}

export async function exportPrintLayoutToPptx(printLayout, pageNodes, fileName, { onProgress } = {}) {
  const pages = printLayout?.pages || []
  if (pages.length === 0) {
    alert('Add at least one page before exporting.')
    return
  }

  const [wMm, hMm] = pageFormatMm(printLayout.pageSize, printLayout.orientation)
  const wIn = wMm / MM_PER_INCH
  const hIn = hMm / MM_PER_INCH

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'DESIGNER', width: wIn, height: hIn })
  pptx.layout = 'DESIGNER'

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length, `Slide ${i + 1}`)
    await new Promise(r => setTimeout(r, 0))
    const page = pages[i]
    const pageNode = pageNodes[i]
    const slide = pptx.addSlide()
    const visible = (page.elements || []).filter(el => el.visible !== false).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const el of visible) {
      const box = boxIn(el, wIn, hIn)
      if (el.kind === 'text') addTextElement(slide, el, box)
      else if (el.kind === 'shape') addShapeElement(pptx, slide, el, box)
      else if (el.kind === 'image' && el.src) slide.addImage({ path: el.src, x: box.x, y: box.y, w: box.w, h: box.h, rotate: el.rotation || 0 })
      else if (el.kind === 'date-range') addDateRangeElement(slide, el, box)
      else await addRasterizedElement(slide, pageNode, el, box) // visual/tile, or an image without a resolvable src
    }
  }

  onProgress?.(pages.length, pages.length, 'Saving…')
  await pptx.writeFile({ fileName: `${(fileName || 'report').replace(/[^\w.\- ]+/g, '_')}.pptx` })
}
