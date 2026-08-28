// Place at: src/report/builder/BuilderCanvas.jsx
// Grid-positioned canvas (brief §5/§18). react-grid-layout/legacy gives the
// familiar v1 flat-prop API (WidthProvider, compactType, preventCollision).
// No overlaps, snap to grid, reflow on drag/resize.
import { useMemo } from 'react'
import RGL, { WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import VisualBlock from './VisualBlock'

const Grid = WidthProvider(RGL)

export default function BuilderCanvas({
  visuals, results, form, selectedId,
  onSelect, onLayoutChange, onConfigure, onDuplicate, onRemove, onViewData, onPromote, onDemote, onClearDatapoint,
}) {
  const layout = useMemo(() => visuals.map(v => ({
    i: v.id,
    x: v.layout?.x ?? 0, y: v.layout?.y ?? 0,
    w: v.layout?.w ?? 6, h: v.layout?.h ?? 5,
    minW: 2, minH: 2,
  })), [visuals])

  return (
    <Grid
      className="rb-canvas"
      layout={layout}
      cols={12}
      rowHeight={44}
      margin={[14, 14]}
      containerPadding={[16, 16]}
      compactType="vertical"
      preventCollision={false}
      isDraggable
      isResizable
      draggableHandle=".rb-block-handle"
      onLayoutChange={onLayoutChange}
      resizeHandles={['se']}
    >
      {visuals.map(v => (
        <div key={v.id}>
          <VisualBlock
            visual={v}
            result={results[v.id]}
            form={form}
            selected={selectedId === v.id}
            onSelect={() => onSelect(v.id)}
            onConfigure={() => onConfigure(v.id)}
            onDuplicate={() => onDuplicate(v.id)}
            onRemove={() => onRemove(v.id)}
            onViewData={() => onViewData(v.id)}
            onPromote={() => onPromote(v.id)}
            onDemote={() => onDemote(v.id)}
            onSelectDatapoint={dp => onSelect(v.id, dp)}
            onClearDatapoint={() => onClearDatapoint(v.id)}
          />
        </div>
      ))}
    </Grid>
  )
}
