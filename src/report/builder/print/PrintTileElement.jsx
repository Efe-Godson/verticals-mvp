import FitChartToCell from './FitChartToCell'
import { cloneElement } from 'react'

// Place at: src/report/builder/print/PrintTileElement.jsx
// One tile from the main Report.jsx dashboard (trend / cart / category /
// location / legacy-widget), placed on a print page. Unlike a Report Builder
// visual, these have no persisted "query" to re-run with an override - the
// tile's `node` already IS the exact React element the live dashboard
// renders (built by the shared report/analysis/buildDashboardTiles.js), so
// it's rendered as-is: what's on the dashboard is what prints, complete with
// its own Focus Mode "⤢" button and D/W/M/Q/Y controls (already excluded
// from PDF export via those controls' own data-html2canvas-ignore).
export default function PrintTileElement({ tile, controls, controlState, onControlChange }) {
  if (!tile) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', border: '1px dashed #ccc' }}>
        This dashboard element is no longer available (its data or field may have changed).
      </div>
    )
  }

  const node = tile.trendConfig && tile.node?.type
    ? cloneElement(tile.node, {
      controls,
      fit: true,
      granularity: controlState?.granularity,
      showLabels: controlState?.showLabels,
      onGranularityChange: value => onControlChange?.({ granularity: value }),
      onShowLabelsChange: value => onControlChange?.({ showLabels: value }),
    })
    : tile.node?.type ? cloneElement(tile.node, { controls }) : tile.node
  return <FitChartToCell fixedHeight={!!tile.trendConfig}>{node}</FitChartToCell>
}
