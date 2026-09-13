// Place at: src/demoBuild/DemoLaunchCapture.jsx
// The "Launch" experience inside the demo's Build tab: a lightweight,
// self-contained capture UI (POS order grid for cart samples, a plain form
// for everything else) that produces a submissions.data-shaped object.
//
// Deliberately not PublicForm.jsx - that's the real production
// order/checkout path (autosave, edit tokens, a Supabase edge function that
// persists + mints an order_number). Forking its real-submission path to
// stay session-only would mean modifying a file real customers depend on,
// for a demo-only need. This renders the same *data shape* instead.
import { useState } from 'react'
import CardChoice from '../components/CardChoice'
import { PAYMENT_METHODS } from './demoBuildConfig'

function StarPicker({ value, max = 5, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '0.2rem' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          style={{
            border: 'none', background: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer',
            fontSize: '1.4rem', lineHeight: 1, color: n <= (value || 0) ? 'var(--color-primary)' : 'var(--color-border)',
          }}
        >★</button>
      ))}
    </div>
  )
}

// One input, typed by field.type - shared by the cart flow's extra fields
// (order type, customer name, ...) and the plain-form flow. Same .pf-control
// look as the real public form (PublicForm.jsx) so the demo reads as one
// coherent design language rather than a rougher stand-in.
function FieldInput({ field, value, onChange, disabled }) {
  const commonProps = { disabled, className: 'pf-control' }
  switch (field.type) {
    case 'longtext':
      return <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} {...commonProps} />
    case 'number':
      return <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} {...commonProps} />
    case 'date':
      return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} {...commonProps} />
    case 'time':
      return <input type="time" value={value || ''} onChange={e => onChange(e.target.value)} {...commonProps} />
    case 'email':
      return <input type="email" value={value || ''} onChange={e => onChange(e.target.value)} {...commonProps} />
    case 'phone':
      return <input type="tel" value={value || ''} onChange={e => onChange(e.target.value)} {...commonProps} />
    case 'dropdown':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} {...commonProps}>
          <option value="">Select…</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'multiplechoice':
      return <CardChoice options={field.options || []} value={value} onChange={disabled ? () => {} : onChange} />
    case 'checkbox':
      return <CardChoice options={field.options || []} value={value} multi onChange={disabled ? () => {} : onChange} />
    case 'rating':
      return <StarPicker value={value} max={field.maxStars || 5} onChange={onChange} disabled={disabled} />
    default:
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} {...commonProps} />
  }
}

function fieldRow(field, value, onChange, disabled) {
  return (
    <div key={field.id} className="pf-tile">
      <label className="pf-label">
        {field.label}{field.required && <span className="field-required-mark"> *</span>}
      </label>
      <FieldInput field={field} value={value} onChange={v => onChange(field.id, v)} disabled={disabled} />
    </div>
  )
}

function isMissingRequired(fields, answers) {
  return fields.some(f => f.required && f.type !== 'cart' && !answers[f.id] && answers[f.id] !== 0)
}

// Restaurant / retail: a shopper-facing product grid + cart + checkout,
// styled after the real POS order screen (PublicForm.jsx's cart layout) -
// same category pills, Add-then-stepper product cards, and pf-section/
// pf-tile field cards - so the demo previews the actual look a launched
// order form will have, not a rougher stand-in.
export function CartCapture({ fields, config, readOnly, onComplete }) {
  const cartField = fields.find(f => f.type === 'cart')
  const otherFields = fields.filter(f => f.type !== 'cart')
  const products = cartField?.products || []
  const [quantities, setQuantities] = useState({})
  const [answers, setAnswers] = useState({})
  const [paymentMethod, setPaymentMethod] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [addedFlash, setAddedFlash] = useState({})

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))]
  const visibleProducts = activeCategory === 'All' ? products : products.filter(p => p.category === activeCategory)

  const items = products
    .map(p => ({ id: p.id, name: p.name, price: Number(p.price) || 0, category: p.category || '', quantity: Number(quantities[p.id]) || 0 }))
    .filter(i => i.quantity > 0)
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  function setQty(productId, qty) {
    if (readOnly) return
    setQuantities(current => ({ ...current, [productId]: Math.max(0, qty) }))
  }

  function addToCart(productId) {
    setQty(productId, (quantities[productId] || 0) + 1)
    setAddedFlash(current => ({ ...current, [productId]: true }))
    setTimeout(() => setAddedFlash(current => ({ ...current, [productId]: false })), 500)
  }

  function setAnswer(fieldId, value) {
    if (readOnly) return
    setAnswers(current => ({ ...current, [fieldId]: value }))
  }

  const canComplete = !readOnly && items.length > 0 && paymentMethod && !isMissingRequired(otherFields, answers)

  function complete() {
    if (!canComplete) return
    const data = {}
    otherFields.forEach(f => { data[f.id] = answers[f.id] })
    data[cartField.id] = { items, total, payment: { method: paymentMethod }, deliveryFee: 0 }
    onComplete(data)
  }

  return (
    <div>
      {categories.length > 2 && (
        <div
          className="category-scroll"
          style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.9rem' }}
        >
          {categories.map(c => (
            <button
              key={c}
              type="button"
              className={c === activeCategory ? '' : 'secondary'}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', marginBottom: '1.4rem' }}>
        {visibleProducts.map(p => {
          const qty = quantities[p.id] || 0
          return (
            <div key={p.id} className="card" style={{ padding: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: '0.92rem', color: 'var(--color-primary)', fontWeight: 700 }}>₦{Number(p.price || 0).toLocaleString()}</div>
              {qty === 0 ? (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => addToCart(p.id)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem', marginTop: '0.2rem' }}
                >
                  {addedFlash[p.id] ? '✓ Added' : 'Add'}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                  <button type="button" className="secondary" disabled={readOnly} onClick={() => setQty(p.id, qty - 1)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}>−</button>
                  <span style={{ fontSize: '0.85rem' }}>{qty}</span>
                  <button type="button" className="secondary" disabled={readOnly} onClick={() => setQty(p.id, qty + 1)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}>+</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {otherFields.map(f => fieldRow(f, answers[f.id], setAnswer, readOnly))}

      <div className="pf-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.9rem' }}>
          <span>Total</span>
          <span>₦{total.toLocaleString()}</span>
        </div>
        <label className="pf-label">Payment method</label>
        <CardChoice options={PAYMENT_METHODS} value={paymentMethod} onChange={readOnly ? () => {} : setPaymentMethod} />
        <button
          type="button"
          className="pf-submit"
          disabled={!canComplete}
          onClick={complete}
          style={{ marginTop: '1rem', width: '100%' }}
        >
          {config.submitLabel}
        </button>
        {readOnly && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
            Preview only - launch it to actually record something.
          </p>
        )}
      </div>
    </div>
  )
}

// Every other sample: a plain field-by-field form.
export function GenericCapture({ fields, config, readOnly, onComplete }) {
  const [answers, setAnswers] = useState({})

  function setAnswer(fieldId, value) {
    if (readOnly) return
    setAnswers(current => ({ ...current, [fieldId]: value }))
  }

  const canComplete = !readOnly && !isMissingRequired(fields, answers)

  function complete() {
    if (!canComplete) return
    const data = {}
    fields.forEach(f => { data[f.id] = answers[f.id] })
    onComplete(data)
  }

  return (
    <div>
      {fields.map(f => fieldRow(f, answers[f.id], setAnswer, readOnly))}
      <button
        type="button"
        className="pf-submit"
        disabled={!canComplete}
        onClick={complete}
        style={{ width: '100%' }}
      >
        {config.submitLabel}
      </button>
      {readOnly && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
          Preview only - launch it to actually record something.
        </p>
      )}
    </div>
  )
}

export default function DemoLaunchCapture({ fields, config, readOnly = false, onComplete }) {
  const hasCart = fields.some(f => f.type === 'cart')
  return hasCart
    ? <CartCapture fields={fields} config={config} readOnly={readOnly} onComplete={onComplete} />
    : <GenericCapture fields={fields} config={config} readOnly={readOnly} onComplete={onComplete} />
}
