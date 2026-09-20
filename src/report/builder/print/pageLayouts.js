// Place at: src/report/builder/print/pageLayouts.js
// Page layout presets (Designer 2.0 Phase 2) - "+ Add page" offers these
// alongside a blank page. Each factory returns plain element objects in
// the same shape elementModel.js's makeTextElement/makeShapeElement
// produce, minus id/zIndex/locked/visible/styleRef/groupId - those get
// assigned uniformly by useReportBuilder.js's addPrintPageWithElements,
// same division of responsibility as addPrintElement already has for a
// single element.
import { makeTextElement, makeShapeElement } from './elementModel'

function stripId({ id: _id, zIndex: _z, locked: _l, visible: _v, ...rest }) {
  return rest
}

// Empty outlined content area - there's no dedicated "placeholder" element
// kind (elementModel.js only has text/shape/image factories), so a rounded
// rectangle + a centered caption stand in, same trick kpi-overview already
// uses for its metric slots below.
function placeholder(x, y, width, height, label = '+ Add content') {
  return [
    stripId(makeShapeElement({ shape: 'rounded-rectangle', fill: '#f8fafc', stroke: '#cbd5e1', x, y, width, height })),
    stripId(makeTextElement({ variant: 'caption', content: label, align: 'center', x: x + width / 2 - 15, y: y + height / 2 - 4, width: 30, height: 8 })),
  ]
}

export const PAGE_LAYOUTS = [
  {
    id: 'blank',
    label: 'Blank',
    make: () => [],
  },
  {
    id: 'cover',
    label: 'Title Slide',
    make: () => [
      stripId(makeTextElement({ variant: 'title', content: 'Report title', align: 'center', x: 10, y: 38, width: 80, height: 14 })),
      stripId(makeTextElement({ variant: 'heading', content: 'Subtitle or date range', align: 'center', x: 10, y: 54, width: 80, height: 8 })),
    ],
  },
  {
    id: 'title-content',
    label: 'Title + Content',
    make: () => [
      stripId(makeTextElement({ variant: 'title', content: 'Slide title', align: 'left', x: 8, y: 6, width: 84, height: 10 })),
      ...placeholder(8, 20, 84, 72),
    ],
  },
  {
    id: 'two-column',
    label: 'Two Columns',
    make: () => [
      stripId(makeTextElement({ variant: 'title', content: 'Slide title', align: 'left', x: 8, y: 6, width: 84, height: 10 })),
      ...placeholder(8, 20, 40, 72),
      ...placeholder(52, 20, 40, 72),
    ],
  },
  {
    id: 'comparison',
    label: 'Comparison',
    make: () => [
      stripId(makeTextElement({ variant: 'title', content: 'Comparison', align: 'left', x: 8, y: 6, width: 84, height: 8 })),
      stripId(makeTextElement({ variant: 'heading', content: 'Option A', align: 'center', x: 8, y: 16, width: 40, height: 6 })),
      stripId(makeTextElement({ variant: 'heading', content: 'Option B', align: 'center', x: 52, y: 16, width: 40, height: 6 })),
      ...placeholder(8, 24, 40, 68),
      ...placeholder(52, 24, 40, 68),
    ],
  },
  {
    id: 'section',
    label: 'Section Divider',
    make: () => [
      stripId(makeShapeElement({ shape: 'rectangle', fill: '#2563eb', stroke: 'transparent', x: 0, y: 0, width: 100, height: 100 })),
      stripId(makeTextElement({ variant: 'title', content: 'Section title', align: 'left', x: 8, y: 44, width: 84, height: 14 })),
    ],
  },
  {
    id: 'kpi-overview',
    label: 'KPI Summary',
    make: () => [
      stripId(makeTextElement({ variant: 'heading', content: 'Overview', align: 'left', x: 5, y: 5, width: 90, height: 8 })),
      ...[0, 1, 2, 3].map(i => stripId(makeTextElement({
        variant: 'big-number', content: '—', align: 'center',
        x: 5 + i * 23.75, y: 20, width: 20, height: 20,
      }))),
      ...[0, 1, 2, 3].map(i => stripId(makeTextElement({
        variant: 'caption', content: `Metric ${i + 1}`, align: 'center',
        x: 5 + i * 23.75, y: 41, width: 20, height: 6,
      }))),
    ],
  },
  {
    id: 'chart-notes',
    label: 'Chart + Notes',
    make: () => [
      stripId(makeTextElement({ variant: 'title', content: 'Slide title', align: 'left', x: 8, y: 6, width: 84, height: 8 })),
      ...placeholder(8, 16, 58, 76, '+ Add chart'),
      stripId(makeTextElement({ variant: 'heading', content: 'Notes', align: 'left', x: 70, y: 16, width: 22, height: 6 })),
      stripId(makeTextElement({ variant: 'body', content: '', align: 'left', x: 70, y: 24, width: 22, height: 68 })),
    ],
  },
  {
    id: 'grid-2x2',
    label: '2×2 Grid',
    make: () => [
      stripId(makeTextElement({ variant: 'title', content: 'Slide title', align: 'left', x: 8, y: 5, width: 84, height: 8 })),
      ...placeholder(8, 16, 40, 38),
      ...placeholder(52, 16, 40, 38),
      ...placeholder(8, 56, 40, 38),
      ...placeholder(52, 56, 40, 38),
    ],
  },
]

export const PAGE_LAYOUTS_BY_ID = Object.fromEntries(PAGE_LAYOUTS.map(l => [l.id, l]))
