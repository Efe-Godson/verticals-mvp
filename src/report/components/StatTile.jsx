// Place at: src/report/components/StatTile.jsx
// Compact label/value tile — for KPI grids and small stat rows.
// (Your actual Card.jsx is built for full chart blocks with a 360px min
// height, so it's the wrong tool for these — this is a proper replacement.)
// trend (optional): { direction: 'up' | 'down', percent: number } — omit
// entirely (rather than passing null) when there's no previous period to
// compare against, so the tile doesn't show a misleading "no change".
function StatTile({ label, value, trend }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem', minWidth: '150px', transition: 'box-shadow 0.15s ease' }}>
      <div style={{
        fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.3rem',
        textTransform: 'uppercase', letterSpacing: '0.04em'
      }}>
        {label}
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {trend && (
        <div style={{
          fontSize: '0.78rem', fontWeight: 600, marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums',
          color: trend.direction === 'up' ? 'var(--status-good)' : 'var(--status-critical)'
        }}>
          {trend.direction === 'up' ? '▲' : '▼'} {Math.abs(trend.percent)}% vs previous period
        </div>
      )}
    </div>
  )
}

export default StatTile
