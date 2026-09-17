// Place at: src/report/builder/print/PrintTextElement.jsx
// Title / Heading / Text / Divider blocks for a print page (brief §30) -
// deliberately not a rich text editor: one variant picker, bold, alignment,
// and the text itself, edited in place.
import { resolveTokens } from './dynamicTokens'

// `directEdit=false` (the freeform canvas - see DesignerCanvas.jsx) means a
// single click is already claimed for selecting/dragging the element, so
// text only becomes editable after a double-click; `onEditingChange` lets
// the canvas disable dragging for the duration so clicking to place a
// cursor doesn't also start a drag. The legacy GridLayout renderer passes
// directEdit=true (its default) and keeps the original always-editable
// behavior unchanged.
export default function PrintTextElement({ element, editing, onChange, onRemove, directEdit = true, onEditingChange, tokenContext }) {
  const text = element.text || { variant: 'body', content: '', align: 'left', bold: false }

  if (text.variant === 'divider') {
    return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: 0 }} /></div>
  }

  const fallbackSize = { title: '1.6rem', heading: '1.15rem', body: '0.9rem', small: '0.78rem', caption: '0.72rem', 'big-number': '2.4rem' }[text.variant] || '0.9rem'
  const fallbackWeight = ['title', 'big-number'].includes(text.variant) ? 800 : text.variant === 'heading' ? 700 : 400

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        data-print-text="true"
        style={{
          flex: 1, fontSize: text.fontSize ? `${text.fontSize}px` : fallbackSize, fontWeight: text.bold ? 800 : fallbackWeight,
          textAlign: text.align || 'left', color: text.color || 'var(--designer-text, #111827)',
          fontFamily: text.fontFamily || (['title', 'heading'].includes(text.variant) ? 'var(--designer-heading-font, inherit)' : 'var(--designer-body-font, inherit)'),
          cursor: editing ? 'pointer' : 'default',
          overflow: 'hidden', wordBreak: 'break-word',
        }}
      >{resolveTokens(text.content, tokenContext) || (editing ? 'Double-click to edit...' : '')}</div>
    </div>
  )
}
