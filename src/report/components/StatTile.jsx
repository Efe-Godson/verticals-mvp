// Place at: src/report/components/StatTile.jsx
// Compact label/value tile — for KPI grids and small stat rows.
// (Your actual Card.jsx is built for full chart blocks with a 360px min
// height, so it's the wrong tool for these — this is a proper replacement.)
function StatTile({ label, value }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem', minWidth: '150px' }}>
      <div style={{
        fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.3rem',
        textTransform: 'uppercase', letterSpacing: '0.04em'
      }}>
        {label}
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>
        {value}
      </div>
    </div>
  )
}

export default StatTile
