// Place at: src/report/builder/print/PageThumbnail.jsx
// A cheap schematic preview of a page's element layout (Designer 2.0 Phase
// 1, step 10) - colored blocks positioned/sized like the real elements,
// not a full re-render of charts/images. A true live-rendered thumbnail
// would mean re-running every chart's query a second time per page, which
// doesn't scale to a many-page report (see the Designer 2.0 plan's
// Performance Requirements) - this gives useful at-a-glance
// differentiation between pages for a fraction of the cost, and works
// identically regardless of which canvas renderer is currently active
// (elements always carry x/y/width/height percentages once migrated).
import { pageAspectRatio } from './printConstants'

const KIND_COLOR = { text: '#cbd5e1', visual: '#93c5fd', tile: '#93c5fd', shape: '#fde68a', image: '#a7f3d0' }

export default function PageThumbnail({ page, pageSize, orientation }) {
  return (
    <div
      style={{
        width: '100%', aspectRatio: pageAspectRatio(pageSize, orientation),
        background: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}
    >
      {(page.elements || []).filter(el => el.visible !== false).map(el => (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: `${el.x ?? 0}%`, top: `${el.y ?? 0}%`,
            width: `${Math.max(el.width ?? 10, 2)}%`, height: `${Math.max(el.height ?? 10, 2)}%`,
            background: KIND_COLOR[el.kind] || '#e5e7eb',
            borderRadius: el.kind === 'shape' && (el.shape === 'circle' || el.shape === 'ellipse') ? '50%' : '1px',
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            overflow: 'hidden',
          }}
        >
          {el.kind === 'text' && el.text?.content && (
            <div style={{ fontSize: '3px', lineHeight: 1.2, padding: '1px', color: '#475569', whiteSpace: 'nowrap' }}>
              {el.text.content.slice(0, 24)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
