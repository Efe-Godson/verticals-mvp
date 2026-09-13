// Place at: src/report/builder/visuals/ChartFrame.jsx
// Common wrappers: an empty/insufficient-data state, plus the axis styling
// shared by the recharts visuals. Deliberately recharts-free (see
// ChartCanvas.jsx for VizBox, the ResponsiveContainer wrapper) so that
// VisualRenderer/PivotViz/TableViz - which only need EmptyViz - never pull
// recharts into their chunk.
export function EmptyViz({ message = 'Not enough data yet.' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 120, height: '100%', color: 'var(--color-muted)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center',
    }}>
      {message}
    </div>
  )
}

export const axisTick = { fontSize: 11, fill: 'var(--color-muted)' }
export const gridStroke = 'var(--color-border)'
