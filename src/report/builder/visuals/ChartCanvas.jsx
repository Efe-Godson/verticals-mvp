// Place at: src/report/builder/visuals/ChartCanvas.jsx
// The ResponsiveContainer wrapper every recharts-based visual sits in.
// Split out of ChartFrame.jsx so the `recharts` import (a large dependency)
// only loads with the chart types that actually render through recharts
// (Bar/Line/Pie/Scatter, lazy-loaded from VisualRenderer.jsx). EmptyViz and
// the other ChartFrame exports stay recharts-free so KPI/Pivot/Table visuals
// never pull recharts in.
import { ResponsiveContainer } from 'recharts'

export function VizBox({ children, height = '100%', minHeight = 160 }) {
  return (
    <div style={{ width: '100%', height, minHeight, flex: 1 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}
