// Place at: src/report/builder/print/printConstants.js
// Shared sizing between the on-screen page canvas and the PDF export - the
// export captures the page's actual rendered DOM, so as long as both read
// these same numbers the PDF always matches what was arranged on screen.

// "Slide" is a PowerPoint widescreen slide's own proportions (13.333in x
// 7.5in, 16:9 - PowerPoint's default since 2013) so a report built here reads
// like a deck, not a printed document - the default, since most reports get
// presented before they get filed. "A4" stays available for a genuine
// printed handout. Dimensions in millimetres (jsPDF's unit here).
export const PAGE_SIZES = {
  slide: { label: 'Slide (16:9)', width: 338.67, height: 190.5, orientable: false },
  a4: { label: 'A4 (Print)', width: 210, height: 297, orientable: true },
}

export function pageFormatMm(pageSize, orientation) {
  const spec = PAGE_SIZES[pageSize] || PAGE_SIZES.slide
  if (!spec.orientable) return [spec.width, spec.height]
  return orientation === 'landscape' ? [spec.height, spec.width] : [spec.width, spec.height]
}

export function pageAspectRatio(pageSize, orientation) {
  const [w, h] = pageFormatMm(pageSize, orientation)
  return `${w} / ${h}`
}

// The page canvas is a fixed number of grid rows regardless of on-screen
// zoom - rowHeight is derived from the container's measured width each
// render (see PrintPage.jsx), not a constant pixel value.
export const GRID_COLS = 12
export const ROWS_PER_PAGE = 26

export const WIDTH_PRESETS = [
  { label: '⅓', w: 4 },
  { label: '½', w: 6 },
  { label: '⅔', w: 8 },
  { label: 'Full', w: 12 },
]

export const TEXT_VARIANTS = [
  { value: 'title', label: 'Title', fontSize: '1.6rem', fontWeight: 800 },
  { value: 'heading', label: 'Heading', fontSize: '1.15rem', fontWeight: 700 },
  { value: 'body', label: 'Text', fontSize: '0.9rem', fontWeight: 400 },
  { value: 'small', label: 'Small', fontSize: '0.78rem', fontWeight: 400 },
]

export function defaultElementSize(kind, variant) {
  if (kind === 'text') {
    if (variant === 'divider') return { w: 12, h: 2 }
    return { w: 12, h: variant === 'title' ? 4 : 3 }
  }
  return { w: 6, h: 10 } // visual
}
