// Place at: src/report/builder/print/elements/ShapeElement.jsx
// Renders one of elementModel.js's SHAPE_TYPES (Designer 2.0 Phase 1, step
// 8). Styling (fill/stroke/radius/opacity) is edited via FormatInspector's
// Shape panel, not here - this component is purely presentational, the
// same split PrintVisualElement/PrintTextElement already follow.
export default function ShapeElement({ element }) {
  const { shape = 'rectangle', fill = '#e5e7eb', stroke = '#111827', strokeWidth = 1, radius = 0, opacity = 1 } = element

  const border = strokeWidth > 0 ? `${strokeWidth}px solid ${stroke}` : 'none'

  if (shape === 'line' || shape === 'divider') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', opacity }}>
        <div style={{ width: '100%', borderTop: `${Math.max(1, strokeWidth)}px solid ${stroke}` }} />
      </div>
    )
  }

  if (shape === 'arrow') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', opacity }}>
        <svg width="100%" height="12" viewBox="0 0 100 12" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
          <line x1="0" y1="6" x2="92" y2="6" stroke={stroke} strokeWidth={Math.max(1, strokeWidth)} />
          <polygon points="92,0 100,6 92,12" fill={stroke} />
        </svg>
      </div>
    )
  }

  const isRound = shape === 'circle' || shape === 'ellipse'
  return (
    <div
      style={{
        width: '100%', height: '100%', boxSizing: 'border-box',
        background: fill, border, opacity,
        borderRadius: isRound ? '50%' : (shape === 'rounded-rectangle' ? Math.max(radius, 8) : radius),
      }}
    />
  )
}
