// Place at: src/report/builder/print/PrintTileElement.jsx
// One tile from the main Report.jsx dashboard (trend / cart / category /
// location / legacy-widget), placed on a print page. Unlike a Report Builder
// visual, these have no persisted "query" to re-run with an override - the
// tile's `node` already IS the exact React element the live dashboard
// renders (built by the shared report/analysis/buildDashboardTiles.js), so
// it's rendered as-is: what's on the dashboard is what prints, complete with
// its own Focus Mode "⤢" button and D/W/M/Q/Y controls (already excluded
// from PDF export via those controls' own data-html2canvas-ignore).
const iconBtn = {
  border: '1px solid var(--color-border)', borderRadius: '5px', padding: '0.1rem 0.4rem',
  fontSize: '0.72rem', cursor: 'pointer', background: 'var(--color-surface)', color: 'var(--color-muted)',
}

export default function PrintTileElement({ tile, editing, onRemove }) {
  if (!tile) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', border: '1px dashed #ccc' }}>
        This dashboard element is no longer available (its data or field may have changed).
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
        {tile.title && (
          <strong style={{ fontSize: '0.85rem', color: '#111', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tile.title}
          </strong>
        )}
        {editing && <button style={{ ...iconBtn, marginLeft: 'auto' }} onClick={onRemove} title="Remove">✕</button>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tile.node}
      </div>
    </div>
  )
}
