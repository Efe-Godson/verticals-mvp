// Place at: src/report/builder/print/PrintTextElement.jsx
// Title / Heading / Text / Divider blocks for a print page (brief §30) -
// deliberately not a rich text editor: one variant picker, bold, alignment,
// and the text itself, edited in place.
import { useState } from 'react'
import { TEXT_VARIANTS } from './printConstants'
import { resolveTokens } from './dynamicTokens'

const selStyle = {
  fontSize: '0.75rem', padding: '0.15rem 0.35rem', borderRadius: '5px',
  border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
}
const iconBtn = (active) => ({
  border: '1px solid var(--color-border)', borderRadius: '5px', padding: '0.15rem 0.4rem',
  fontSize: '0.75rem', cursor: 'pointer', background: active ? 'var(--color-primary-soft)' : 'var(--color-surface)',
  color: 'var(--color-text)',
})

// `directEdit=false` (the freeform canvas - see DesignerCanvas.jsx) means a
// single click is already claimed for selecting/dragging the element, so
// text only becomes editable after a double-click; `onEditingChange` lets
// the canvas disable dragging for the duration so clicking to place a
// cursor doesn't also start a drag. The legacy GridLayout renderer passes
// directEdit=true (its default) and keeps the original always-editable
// behavior unchanged.
export default function PrintTextElement({ element, editing, onChange, onRemove, directEdit = true, onEditingChange, tokenContext }) {
  const [focused, setFocused] = useState(false)
  const [manualEdit, setManualEdit] = useState(false)
  const text = element.text || { variant: 'body', content: '', align: 'left', bold: false }
  const canType = directEdit || manualEdit

  if (text.variant === 'divider') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
        <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: 0 }} />
        {editing && (
          <button className="secondary" data-html2canvas-ignore="true" onClick={onRemove} title="Remove"
            style={{ position: 'absolute', top: -6, right: -6, ...iconBtn(false), padding: '0 0.3rem' }}>✕</button>
        )}
      </div>
    )
  }

  const spec = TEXT_VARIANTS.find(v => v.value === text.variant) || TEXT_VARIANTS[2]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {editing && (
        <div data-html2canvas-ignore="true" style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
          <select
            style={selStyle} value={text.variant}
            onChange={e => onChange({ text: { ...text, variant: e.target.value } })}
          >
            {TEXT_VARIANTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          <button style={iconBtn(text.bold)} onClick={() => onChange({ text: { ...text, bold: !text.bold } })} title="Bold"><strong>B</strong></button>
          {['left', 'center', 'right'].map(a => (
            <button key={a} style={iconBtn(text.align === a)} onClick={() => onChange({ text: { ...text, align: a } })} title={a}>
              {a === 'left' ? '≡' : a === 'center' ? '≡̲' : '≡'}
            </button>
          ))}
          <button style={iconBtn(false)} onClick={onRemove} title="Remove">✕</button>
        </div>
      )}
      <div
        contentEditable={editing && canType}
        suppressContentEditableWarning
        onDoubleClick={e => { if (editing && !directEdit) { e.stopPropagation(); setManualEdit(true); onEditingChange?.(true) } }}
        onFocus={() => setFocused(true)}
        onBlur={e => {
          setFocused(false)
          onChange({ text: { ...text, content: e.currentTarget.textContent } })
          if (!directEdit) { setManualEdit(false); onEditingChange?.(false) }
        }}
        style={{
          flex: 1, outline: focused ? '1px dashed var(--color-border)' : 'none',
          fontSize: spec.fontSize, fontWeight: text.bold ? 800 : spec.fontWeight,
          textAlign: text.align || 'left', color: text.color || 'var(--designer-text, #111827)',
          fontFamily: ['title', 'heading'].includes(text.variant) ? 'var(--designer-heading-font, inherit)' : 'var(--designer-body-font, inherit)',
          cursor: editing ? (canType ? 'text' : 'default') : 'default',
          overflow: 'hidden', wordBreak: 'break-word',
        }}
      >
        {(!focused && tokenContext ? resolveTokens(text.content, tokenContext) : text.content) || (editing ? spec.label + '...' : '')}
      </div>
    </div>
  )
}
