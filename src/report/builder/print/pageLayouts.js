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

export const PAGE_LAYOUTS = [
  {
    id: 'blank',
    label: 'Blank',
    make: () => [],
  },
  {
    id: 'cover',
    label: 'Cover',
    make: () => [
      stripId(makeTextElement({ variant: 'title', content: 'Report title', align: 'center', x: 10, y: 38, width: 80, height: 14 })),
      stripId(makeTextElement({ variant: 'heading', content: 'Subtitle or date range', align: 'center', x: 10, y: 54, width: 80, height: 8 })),
    ],
  },
  {
    id: 'section',
    label: 'Section divider',
    make: () => [
      stripId(makeShapeElement({ shape: 'rectangle', fill: '#2563eb', stroke: 'transparent', x: 0, y: 0, width: 100, height: 100 })),
      stripId(makeTextElement({ variant: 'title', content: 'Section title', align: 'left', x: 8, y: 44, width: 84, height: 14 })),
    ],
  },
  {
    id: 'kpi-overview',
    label: 'KPI overview',
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
]

export const PAGE_LAYOUTS_BY_ID = Object.fromEntries(PAGE_LAYOUTS.map(l => [l.id, l]))
