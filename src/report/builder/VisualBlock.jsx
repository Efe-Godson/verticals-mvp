// Place at: src/report/builder/VisualBlock.jsx
// One card on the canvas: drag handle + title + hover toolbar
// (configure / view data / duplicate / promote / delete) + the rendered
// visual + a "✓ On Reports" badge and a selected-datapoint chip.
import VisualRenderer from './visuals/VisualRenderer'

function IconBtn({ title, onClick, children }) {
  return (
    <button className="secondary" title={title} onClick={e => { e.stopPropagation(); onClick() }}
      style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem', lineHeight: 1 }}>
      {children}
    </button>
  )
}

export default function VisualBlock({
  visual, result, form, selected,
  onSelect, onConfigure, onDuplicate, onRemove, onViewData, onPromote, onDemote,
  onSelectDatapoint, onClearDatapoint,
}) {
  return (
    <div
      onClick={onSelect}
      className="card"
      style={{
        height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        outline: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        outlineOffset: selected ? '-2px' : '-1px', cursor: 'pointer',
      }}
    >
      <div className="rb-block-handle" style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.55rem',
        borderBottom: '1px solid var(--color-border)', cursor: 'grab', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem', lineHeight: 1 }}>⠿</span>
        <span style={{ fontWeight: 600, fontSize: '0.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {visual.title}
        </span>
        {visual.reportVisibility && (
          <span className="form-state-badge live" style={{ fontSize: '0.6rem' }}>✓ On Reports</span>
        )}
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <IconBtn title="Configure" onClick={onConfigure}>⚙</IconBtn>
          <IconBtn title="View data" onClick={onViewData}>▤</IconBtn>
          <IconBtn title="Duplicate" onClick={onDuplicate}>⧉</IconBtn>
          {visual.reportVisibility
            ? <IconBtn title="Remove from Reports" onClick={onDemote}>★</IconBtn>
            : <IconBtn title="Promote to Reports" onClick={onPromote}>☆</IconBtn>}
          <IconBtn title="Delete" onClick={onRemove}>✕</IconBtn>
        </div>
      </div>

      {visual.selectedDatapoint && (
        <div style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', background: 'var(--color-primary-soft)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Selected: <strong>{visual.selectedDatapoint.value}</strong></span>
          <button className="secondary" style={{ padding: '0 0.3rem', fontSize: '0.7rem' }} onClick={e => { e.stopPropagation(); onClearDatapoint() }}>clear</button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column' }}>
        <VisualRenderer visual={visual} result={result} form={form} onSelectDatapoint={onSelectDatapoint} />
      </div>
    </div>
  )
}
