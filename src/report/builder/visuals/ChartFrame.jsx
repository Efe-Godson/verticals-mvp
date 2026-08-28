// Place at: src/report/builder/visuals/ChartFrame.jsx
// Common wrappers: an empty/insufficient-data state and a fixed-height
// responsive box every recharts visual sits in.
import { ResponsiveContainer } from 'recharts'

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

export function VizBox({ children, height = '100%', minHeight = 160 }) {
  return (
    <div style={{ width: '100%', height, minHeight, flex: 1 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export const axisTick = { fontSize: 11, fill: 'var(--color-muted)' }
export const gridStroke = 'var(--color-border)'
