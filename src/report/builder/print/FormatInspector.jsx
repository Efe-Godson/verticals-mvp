// Place at: src/report/builder/print/FormatInspector.jsx
// Right-hand contextual panel (Designer 2.0 Phase 1, step 5) - shows
// properties for whatever's currently selected on the freeform canvas.
// Deliberately kind-agnostic for now: Shape/Image/Chart-specific panels
// (the brief's per-kind inspector split) land in later Phase 1 steps once
// those element kinds exist. Text already has its own inline toolbar
// (PrintTextElement.jsx - variant/bold/align), so this doesn't duplicate
// that, just adds position/rotation/layer/lock/visible, which apply to
// every kind uniformly.
const panelStyle = { padding: '0.8rem', fontSize: '0.82rem', height: '100%', overflowY: 'auto' }
const labelStyle = {
  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--color-muted)', marginBottom: '0.5rem', marginTop: '1rem',
}
const fieldRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.35rem' }
const numberInput = { width: '70px', fontSize: '0.8rem', padding: '0.2rem 0.4rem', boxSizing: 'border-box' }
const checkboxLabel = { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }
const layerBtn = { fontSize: '0.72rem', padding: '0.25rem 0.4rem', flex: 1 }
const dangerBtn = { fontSize: '0.8rem', padding: '0.35rem 0.5rem', width: '100%', marginTop: '1rem', color: '#b91c1c', borderColor: '#fca5a5' }

function SectionLabel({ children }) { return <div style={labelStyle}>{children}</div> }

function FieldRow({ label, children }) {
  return (
    <div style={fieldRow}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      {children}
    </div>
  )
}

function NumberInput({ value, onChange, step = 0.1 }) {
  return (
    <input
      type="number" step={step} value={Number.isFinite(value) ? Math.round(value * 10) / 10 : 0}
      onChange={e => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v) }}
      style={numberInput}
    />
  )
}

function LayerButtons({ onSetZ }) {
  return (
    <div style={{ display: 'flex', gap: '0.3rem' }}>
      <button className="secondary" style={layerBtn} title="Bring to front" onClick={() => onSetZ('front')}>⤒ Front</button>
      <button className="secondary" style={layerBtn} title="Bring forward" onClick={() => onSetZ('forward')}>▲</button>
      <button className="secondary" style={layerBtn} title="Send backward" onClick={() => onSetZ('backward')}>▼</button>
      <button className="secondary" style={layerBtn} title="Send to back" onClick={() => onSetZ('back')}>⤓ Back</button>
    </div>
  )
}

function labelForKind(kind) {
  if (kind === 'visual') return 'Chart'
  if (kind === 'tile') return 'Dashboard tile'
  if (kind === 'text') return 'Text'
  if (kind === 'shape') return 'Shape'
  if (kind === 'image') return 'Image'
  return 'Element'
}

export default function FormatInspector({ page, selectedElements, onUpdateElement, onRemoveElements, onSetZ }) {
  if (!page || selectedElements.length === 0) {
    return (
      <div style={panelStyle}>
        <p style={{ color: 'var(--color-muted)' }}>
          {page ? 'Select an element to edit its properties.' : 'No page selected.'}
        </p>
      </div>
    )
  }

  if (selectedElements.length > 1) {
    const ids = selectedElements.map(e => e.id)
    return (
      <div style={panelStyle}>
        <SectionLabel>{selectedElements.length} elements selected</SectionLabel>
        <LayerButtons onSetZ={mode => ids.forEach(id => onSetZ(page.id, id, mode))} />
        <button className="secondary" style={dangerBtn} onClick={() => onRemoveElements(page.id, ids)}>
          Delete {selectedElements.length} elements
        </button>
      </div>
    )
  }

  const el = selectedElements[0]
  return (
    <div style={panelStyle}>
      <SectionLabel>{labelForKind(el.kind)}</SectionLabel>

      <FieldRow label="X %"><NumberInput value={el.x} onChange={v => onUpdateElement(page.id, el.id, { x: v })} /></FieldRow>
      <FieldRow label="Y %"><NumberInput value={el.y} onChange={v => onUpdateElement(page.id, el.id, { y: v })} /></FieldRow>
      <FieldRow label="Width %"><NumberInput value={el.width} onChange={v => onUpdateElement(page.id, el.id, { width: v })} /></FieldRow>
      <FieldRow label="Height %"><NumberInput value={el.height} onChange={v => onUpdateElement(page.id, el.id, { height: v })} /></FieldRow>
      <FieldRow label="Rotation °">
        <NumberInput value={el.rotation || 0} step={1} onChange={v => onUpdateElement(page.id, el.id, { rotation: v })} />
      </FieldRow>

      <div style={{ display: 'flex', gap: '0.8rem', margin: '0.7rem 0 0.2rem' }}>
        <label style={checkboxLabel}>
          <input type="checkbox" checked={!!el.locked} onChange={e => onUpdateElement(page.id, el.id, { locked: e.target.checked })} />
          Lock
        </label>
        <label style={checkboxLabel}>
          <input type="checkbox" checked={el.visible !== false} onChange={e => onUpdateElement(page.id, el.id, { visible: e.target.checked })} />
          Visible
        </label>
      </div>

      <SectionLabel>Layer</SectionLabel>
      <LayerButtons onSetZ={mode => onSetZ(page.id, el.id, mode)} />

      <button className="secondary" style={dangerBtn} onClick={() => onRemoveElements(page.id, [el.id])}>Delete</button>
    </div>
  )
}
