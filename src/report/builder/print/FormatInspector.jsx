// Place at: src/report/builder/print/FormatInspector.jsx
import { CHART_PRESETS, CHART_PRESETS_BY_ID } from './chartPresets'
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

// onFocus/onBlur are optional history-batching hooks (see FormatInspector's
// onBeginBatch/onCommitBatch below) - held-open typing or arrow-key spinner
// clicks in one focus session collapse to a single undo step instead of one
// per keystroke/click.
function NumberInput({ value, onChange, step = 0.1, onFocus, onBlur }) {
  return (
    <input
      type="number" step={step} value={Number.isFinite(value) ? Math.round(value * 10) / 10 : 0}
      onChange={e => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v) }}
      onFocus={onFocus} onBlur={onBlur}
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

function ShapeStyleFields({ page, el, onUpdateElement, onBeginBatch, onCommitBatch }) {
  const canRadius = el.shape === 'rectangle' || el.shape === 'rounded-rectangle'
  return (
    <>
      <SectionLabel>Style</SectionLabel>
      <FieldRow label="Fill">
        <input
          type="color" value={el.fill || '#e5e7eb'} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={e => onUpdateElement(page.id, el.id, { fill: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Stroke">
        <input
          type="color" value={el.stroke || '#111827'} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={e => onUpdateElement(page.id, el.id, { stroke: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Stroke width">
        <NumberInput
          value={el.strokeWidth ?? 1} step={1} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={v => onUpdateElement(page.id, el.id, { strokeWidth: Math.max(0, v) })}
        />
      </FieldRow>
      {canRadius && (
        <FieldRow label="Corner radius">
          <NumberInput
            value={el.radius ?? 0} step={1} onFocus={onBeginBatch} onBlur={onCommitBatch}
            onChange={v => onUpdateElement(page.id, el.id, { radius: Math.max(0, v) })}
          />
        </FieldRow>
      )}
      <FieldRow label="Opacity">
        <NumberInput
          value={el.opacity ?? 1} step={0.1} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={v => onUpdateElement(page.id, el.id, { opacity: Math.min(1, Math.max(0, v)) })}
        />
      </FieldRow>
    </>
  )
}

function TextStyleFields({ page, el, onUpdateElement, onBeginBatch, onCommitBatch }) {
  const text = el.text || {}
  return (
    <>
      <SectionLabel>Style</SectionLabel>
      <FieldRow label="Color">
        <input
          type="color" value={text.color || '#111827'} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={e => onUpdateElement(page.id, el.id, { text: { ...text, color: e.target.value } })}
        />
      </FieldRow>
    </>
  )
}

// Table publishing controls (Designer 2.0 Phase 2) - only meaningful for a
// 'visual' element whose underlying visual is a table type; a chart has
// nothing here to configure. Stored as el.override.tableStyle, same
// per-placement-override pattern PrintVisualElement.jsx already uses for
// ranking (topN/sort) - never written back to the visual itself.
function TableStyleFields({ page, el, onUpdateElement, visual, form }) {
  const tableStyle = el.override?.tableStyle || {}
  const patchTableStyle = (patch) => onUpdateElement(page.id, el.id, {
    override: { ...(el.override || {}), tableStyle: { ...tableStyle, ...patch } },
  })
  const isDataTable = visual?.type === 'table'
  const fields = isDataTable ? (form?.fields || []).filter(f => f.type !== 'section' && f.type !== 'fileupload').slice(0, 12) : []
  const hidden = tableStyle.hiddenFieldIds || []
  return (
    <>
      <SectionLabel>Table</SectionLabel>
      <label style={checkboxLabel}>
        <input type="checkbox" checked={tableStyle.striped !== false} onChange={e => patchTableStyle({ striped: e.target.checked })} />
        Striped rows
      </label>
      <label style={{ ...checkboxLabel, marginTop: '0.3rem' }}>
        <input type="checkbox" checked={tableStyle.showHeader !== false} onChange={e => patchTableStyle({ showHeader: e.target.checked })} />
        Show header row
      </label>
      {isDataTable && fields.length > 0 && (
        <>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.6rem', marginBottom: '0.3rem' }}>Columns</div>
          {fields.map(f => (
            <label key={f.id} style={{ ...checkboxLabel, marginBottom: '0.2rem' }}>
              <input
                type="checkbox" checked={!hidden.includes(f.id)}
                onChange={e => patchTableStyle({
                  hiddenFieldIds: e.target.checked ? hidden.filter(id => id !== f.id) : [...hidden, f.id],
                })}
              />
              {f.label || f.id}
            </label>
          ))}
        </>
      )}
    </>
  )
}

// Chart presentation-style presets (Phase 3, chartPresets.js) - only for
// chart types (BAR_VARIANTS/LINE_VARIANTS/pie/donut), not table/pivot/KPI
// visuals, which TableStyleFields or nothing covers instead.
function ChartStyleFields({ page, el, onUpdateElement }) {
  const currentId = Object.entries(CHART_PRESETS_BY_ID).find(([, p]) =>
    p.display === null ? !el.override?.chartStyle : JSON.stringify(p.display) === JSON.stringify(el.override?.chartStyle),
  )?.[0] || 'default'
  return (
    <>
      <SectionLabel>Chart style</SectionLabel>
      <select
        style={{ fontSize: '0.8rem', width: '100%' }} value={currentId}
        onChange={e => {
          const preset = CHART_PRESETS_BY_ID[e.target.value]
          onUpdateElement(page.id, el.id, { override: { ...(el.override || {}), chartStyle: preset?.display || undefined } })
        }}
      >
        {CHART_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
    </>
  )
}

function ImageStyleFields({ page, el, onUpdateElement, onBeginBatch, onCommitBatch }) {
  return (
    <>
      <SectionLabel>Style</SectionLabel>
      <FieldRow label="Fit">
        <select
          value={el.fit || 'cover'} style={{ fontSize: '0.8rem' }}
          onChange={e => onUpdateElement(page.id, el.id, { fit: e.target.value })}
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
          <option value="fill">Stretch</option>
        </select>
      </FieldRow>
      <FieldRow label="Corner radius">
        <NumberInput
          value={el.radius ?? 0} step={1} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={v => onUpdateElement(page.id, el.id, { radius: Math.max(0, v) })}
        />
      </FieldRow>
      <FieldRow label="Opacity">
        <NumberInput
          value={el.opacity ?? 1} step={0.1} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={v => onUpdateElement(page.id, el.id, { opacity: Math.min(1, Math.max(0, v)) })}
        />
      </FieldRow>
    </>
  )
}

// Reusable text/shape styles (Phase 2) - "Save as style" captures the
// element's own kind-specific props (never position/size/rotation - those
// stay per-placement); the picker below only lists styles saved from the
// same kind, since a shape style's fill/stroke has no meaning on text.
const STYLE_PROP_KEYS = {
  text: ['text'],
  shape: ['fill', 'stroke', 'strokeWidth', 'radius', 'opacity'],
  image: ['fit', 'radius', 'opacity'],
}

function pickStyleProps(el) {
  const keys = STYLE_PROP_KEYS[el.kind] || []
  return Object.fromEntries(keys.map(k => [k, el[k]]))
}

function StylePicker({ el, savedStyles, onApplyStyle, onSaveStyle }) {
  const eligible = (savedStyles || []).filter(s => s.kind === el.kind)
  return (
    <>
      <SectionLabel>Saved styles</SectionLabel>
      {eligible.length > 0 && (
        <select
          style={{ fontSize: '0.8rem', width: '100%', marginBottom: '0.4rem' }}
          value={el.styleRef || ''}
          onChange={e => { const s = eligible.find(x => x.id === e.target.value); if (s) onApplyStyle(s) }}
        >
          <option value="">{el.styleRef ? 'Custom (detached)' : 'None applied'}</option>
          {eligible.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <button
        className="secondary" style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem', width: '100%' }}
        onClick={() => { const name = window.prompt('Style name?'); if (name) onSaveStyle(name) }}
      >
        + Save as style
      </button>
    </>
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

export default function FormatInspector({
  page, selectedElements, onUpdateElement, onRemoveElements, onSetZ, onSetZElements,
  onBeginBatch, onCommitBatch, onGroup, onUngroup, onSaveComponent,
  savedStyles, onApplyStyle, onSaveStyle, visualsById, form,
}) {
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
    const anyGrouped = selectedElements.some(e => e.groupId)
    return (
      <div style={panelStyle}>
        <SectionLabel>{selectedElements.length} elements selected</SectionLabel>
        <LayerButtons onSetZ={mode => onSetZElements(page.id, ids, mode)} />
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
          <button className="secondary" style={layerBtn} onClick={() => onGroup(page.id, ids)}>Group</button>
          <button className="secondary" style={layerBtn} disabled={!anyGrouped} onClick={() => onUngroup(page.id, ids)}>Ungroup</button>
        </div>
        <button
          className="secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', width: '100%', marginTop: '0.5rem' }}
          onClick={() => { const name = window.prompt('Component name?'); if (name) onSaveComponent(name, selectedElements) }}
        >
          + Save as component
        </button>
        <button className="secondary" style={dangerBtn} onClick={() => onRemoveElements(page.id, ids)}>
          Delete {selectedElements.length} elements
        </button>
      </div>
    )
  }

  const el = selectedElements[0]
  const visual = el.kind === 'visual' ? visualsById?.[el.visualId] : null
  const isTableVisual = visual && ['table', 'summaryTable'].includes(visual.type)
  const isChartVisual = visual && !isTableVisual && !['pivot', 'kpi', 'number', 'comparison', 'progress'].includes(visual.type)
  return (
    <div style={panelStyle}>
      <SectionLabel>{labelForKind(el.kind)}</SectionLabel>

      {el.kind === 'text' && (
        <TextStyleFields page={page} el={el} onUpdateElement={onUpdateElement} onBeginBatch={onBeginBatch} onCommitBatch={onCommitBatch} />
      )}
      {el.kind === 'shape' && (
        <ShapeStyleFields page={page} el={el} onUpdateElement={onUpdateElement} onBeginBatch={onBeginBatch} onCommitBatch={onCommitBatch} />
      )}
      {el.kind === 'image' && (
        <ImageStyleFields page={page} el={el} onUpdateElement={onUpdateElement} onBeginBatch={onBeginBatch} onCommitBatch={onCommitBatch} />
      )}
      {isTableVisual && <TableStyleFields page={page} el={el} onUpdateElement={onUpdateElement} visual={visual} form={form} />}
      {isChartVisual && <ChartStyleFields page={page} el={el} onUpdateElement={onUpdateElement} />}

      {['text', 'shape', 'image'].includes(el.kind) && (
        <StylePicker
          el={el} savedStyles={savedStyles}
          onApplyStyle={style => onApplyStyle(page.id, el.id, style)}
          onSaveStyle={name => onSaveStyle(name, el.kind, pickStyleProps(el))}
        />
      )}

      <SectionLabel>Position</SectionLabel>
      <FieldRow label="X %">
        <NumberInput value={el.x} onFocus={onBeginBatch} onBlur={onCommitBatch} onChange={v => onUpdateElement(page.id, el.id, { x: v })} />
      </FieldRow>
      <FieldRow label="Y %">
        <NumberInput value={el.y} onFocus={onBeginBatch} onBlur={onCommitBatch} onChange={v => onUpdateElement(page.id, el.id, { y: v })} />
      </FieldRow>
      <FieldRow label="Width %">
        <NumberInput value={el.width} onFocus={onBeginBatch} onBlur={onCommitBatch} onChange={v => onUpdateElement(page.id, el.id, { width: v })} />
      </FieldRow>
      <FieldRow label="Height %">
        <NumberInput value={el.height} onFocus={onBeginBatch} onBlur={onCommitBatch} onChange={v => onUpdateElement(page.id, el.id, { height: v })} />
      </FieldRow>
      <FieldRow label="Rotation °">
        <NumberInput
          value={el.rotation || 0} step={1} onFocus={onBeginBatch} onBlur={onCommitBatch}
          onChange={v => onUpdateElement(page.id, el.id, { rotation: v })}
        />
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
