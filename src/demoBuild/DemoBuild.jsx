// Place at: src/demoBuild/DemoBuild.jsx
// The public demo's "Build" tab: shows the capture setup (menu/products for
// a POS sample, a field list for everything else) behind whichever sample
// is currently selected, lets a visitor tweak it, Preview it read-only, or
// Launch it for real - completing it adds a session-only record that the
// existing Records/Report pages (not reimplementations of them) pick up via
// the extraSubmissions prop PublicDemoExperience.jsx feeds them.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PageSkeleton from '../components/PageSkeleton'
import Modal from '../components/Modal'
import ProductManager from '../ProductManager'
import { detectBuildKind } from './demoBuildConfig'
import DemoLaunchCapture from './DemoLaunchCapture'

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'longtext', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiplechoice', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'rating', label: 'Rating' },
]
const TYPES_WITH_OPTIONS = ['dropdown', 'multiplechoice', 'checkbox']

const smallBtn = { padding: '0.25rem 0.55rem', fontSize: '0.8rem', lineHeight: 1 }

function newFieldId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function FieldListEditor({ fields, onChange }) {
  function update(index, patch) { onChange(fields.map((f, i) => i === index ? { ...f, ...patch } : f)) }
  function remove(index) { onChange(fields.filter((_, i) => i !== index)) }
  function move(index, dir) {
    const target = index + dir
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  function addField() { onChange([...fields, { id: newFieldId(), type: 'text', label: 'New field' }]) }

  return (
    <div>
      {fields.map((field, index) => (
        <div key={field.id} style={{ padding: '0.6rem 0', borderBottom: index < fields.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input value={field.label} onChange={e => update(index, { label: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
            <select value={field.type} onChange={e => update(index, { type: e.target.value })} style={{ width: 150, flexShrink: 0 }}>
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
              <button type="button" className="secondary" style={smallBtn} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button type="button" className="secondary" style={smallBtn} disabled={index === fields.length - 1} onClick={() => move(index, 1)}>↓</button>
              <button type="button" className="secondary" style={smallBtn} onClick={() => remove(index)}>✕</button>
            </div>
          </div>
          {TYPES_WITH_OPTIONS.includes(field.type) && (
            <input
              placeholder="Options, comma separated e.g. Cash, Card, Transfer"
              value={(field.options || []).join(', ')}
              onChange={e => update(index, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              style={{ width: '100%', marginTop: '0.4rem' }}
            />
          )}
        </div>
      ))}
      <button type="button" className="secondary" onClick={addField} style={{ marginTop: '0.7rem' }}>+ Add field</button>
    </div>
  )
}

export default function DemoBuild({ formId, formName, basePath, session, addSubmission, setFieldsOverride, setProductsOverride, hideTitle = false, onViewRecords }) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('build') // 'build' | 'preview' | 'launch' | 'success'
  const [lastAdded, setLastAdded] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase.from('forms').select('*').eq('id', formId).single().then(({ data }) => {
      if (!cancelled) { setForm(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [formId])

  if (loading || !form) {
    return <div className="page" style={{ maxWidth: 720 }}><PageSkeleton variant="table" /></div>
  }

  const config = detectBuildKind(form)
  const isCart = !!config.cartField
  const cartProducts = isCart ? (session.productsOverride || config.cartField.products || []) : []
  const effectiveFields = isCart
    ? form.fields.map(f => f.type === 'cart' ? { ...f, products: cartProducts } : f)
    : (session.fieldsOverride || form.fields)

  function handleComplete(data) {
    const submission = { id: `demo-${Date.now()}`, created_at: new Date().toISOString(), data }
    if (isCart) submission.order_number = Math.floor(1000 + Math.random() * 9000)
    addSubmission(formId, submission)
    setLastAdded(submission)
    setMode('success')
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      {!hideTitle && <h1 style={{ marginBottom: '0.2rem' }}>Build</h1>}
      <p style={{ marginTop: 0, color: 'var(--color-muted)' }}>
        This is how {formName} collects its information. Change something, preview it, or launch it as it is.
      </p>

      {mode === 'success' && lastAdded && (
        <div className="demo-cta" style={{ marginBottom: '1.2rem' }}>
          <div className="demo-cta-title">✓ {config.successTitle}</div>
          <div className="demo-cta-desc">{config.successBody}</div>
          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {onViewRecords ? (
              <button type="button" onClick={onViewRecords}>View in Records →</button>
            ) : (
              <Link to={`${basePath}/records`}><button type="button">View in Records →</button></Link>
            )}
            <button type="button" className="secondary" onClick={() => setMode('build')}>Back to Build</button>
          </div>
        </div>
      )}

      {mode !== 'success' && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: '1.1rem 1.2rem', background: 'var(--color-surface)' }}>
          {isCart ? (
            <ProductManager
              inline
              products={cartProducts}
              onChange={(products) => setProductsOverride(formId, products)}
              hideAiImport
            />
          ) : (
            <FieldListEditor fields={effectiveFields} onChange={(fields) => setFieldsOverride(formId, fields)} />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <button type="button" className="secondary" onClick={() => setMode('preview')}>Preview</button>
            <button type="button" onClick={() => setMode('launch')}>Launch</button>
          </div>
        </div>
      )}

      {(mode === 'preview' || mode === 'launch') && (
        <Modal
          open
          onClose={() => setMode('build')}
          title={mode === 'preview' ? 'Preview' : 'This is the live version. Try adding a record.'}
          size="lg"
        >
          <DemoLaunchCapture
            fields={effectiveFields}
            config={config}
            readOnly={mode === 'preview'}
            onComplete={handleComplete}
          />
        </Modal>
      )}
    </div>
  )
}
