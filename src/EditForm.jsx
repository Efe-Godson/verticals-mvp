import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import PosSidePanel from './PosSidePanel'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import FieldValidationControls from './FieldValidationControls'
import FieldTypeConfig from './FieldTypeConfig'
import ConfirmDialog from './ConfirmDialog'
import FormPreviewModal from './FormPreview'
import ProductManager from './ProductManager'
import MoreDetailsManager from './MoreDetailsManager'
import { COUNTRIES } from './lib/locationData'

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'longtext', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiplechoice', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'linearscale', label: 'Linear Scale' },
  { value: 'rating', label: 'Rating' },
  { value: 'multiplechoicegrid', label: 'Multiple Choice Grid' },
  { value: 'checkboxgrid', label: 'Checkbox Grid' },
  { value: 'fileupload', label: 'File Upload' },
  { value: 'cart', label: 'Product Cart' },
  { value: 'linked_record', label: 'Linked Record' },
  { value: 'autocomplete', label: 'Autocomplete' },
  { value: 'location', label: 'Location (Country/State/City)' },
]

const TYPES_WITH_OPTIONS = ['dropdown', 'multiplechoice', 'checkbox', 'autocomplete']
const TYPES_WITH_PRODUCTS = ['cart']
const AUTOSAVE_DELAY = 1800 // ms of inactivity before autosaving

function cleanFieldsForSave(fields) {
  return fields.map(({ optionsText, rowsText, columnsText, ...rest }) => {
    if (rest.type === 'cart') {
      return {
        ...rest,
        products: (rest.products || []).map(p => ({
          ...p,
          price: Number(p.price) || 0,
          unit: p.unit || '',
          category: p.category || ''
        }))
      }
    }
    return rest
  })
}

function EditForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [searchParams] = useSearchParams()
  const isFocusMode = searchParams.get('focus') === '1'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [fields, setFields] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)

  const [autosaveStatus, setAutosaveStatus] = useState('idle') // idle | saving | saved | error
  const debounceRef = useRef(null)
  const isFirstRun = useRef(true)
  // Holds the not-yet-fired autosave for the *latest* render, or null once
  // it's run. Navigating away inside the debounce window used to just
  // cancel the pending timer via this effect's own cleanup - silently
  // dropping whatever was typed in the last ~2s. The unmount-only effect
  // below flushes this instead of losing it.
  const pendingSaveRef = useRef(null)

  const [recentlyRemoved, setRecentlyRemoved] = useState(null) // { field, index }
  const undoTimeoutRef = useRef(null)
  const [pendingConfirm, setPendingConfirm] = useState(null) // { type: 'field', index }
  const [openFieldMenu, setOpenFieldMenu] = useState(null) // field.id of the open "more options" menu, or null
  const fieldMenuRef = useRef(null)
  const [showPreview, setShowPreview] = useState(false)
  const [manageProductsIndex, setManageProductsIndex] = useState(null)
  // Collapsed by default on cart forms so a business owner poking at the
  // menu doesn't stumble into editing/deleting the checkout questions by
  // accident - they're still fully editable once intentionally expanded.
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false)

  useEffect(() => {
    async function loadForm() {
      const { data, error } = await supabase.from('forms').select('*').eq('id', id).single()
      if (error) {
        setError('This form could not be found.')
      } else {
        setFormName(data.name)
        setFormDescription(data.description || '')
        setFields(data.fields || [])
      }
      setLoading(false)
    }
    loadForm()
  }, [id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (fieldMenuRef.current && !fieldMenuRef.current.contains(e.target)) {
        setOpenFieldMenu(null)
      }
    }
    if (openFieldMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openFieldMenu])

  // Debounced autosave: skips the initial load, only fires once the person actually edits something
  useEffect(() => {
    if (loading) return

    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    async function doSave() {
      pendingSaveRef.current = null // this save is running/done - nothing left to flush on unmount
      if (formName.trim() === '') return // don't autosave over a name that's mid-clear

      setAutosaveStatus('saving')
      const cleanedFields = cleanFieldsForSave(fields)

      const { error } = await supabase
        .from('forms')
        .update({ name: formName, description: formDescription.trim() || null, fields: cleanedFields })
        .eq('id', id)

      setAutosaveStatus(error ? 'error' : 'saved')
    }

    debounceRef.current = setTimeout(doSave, AUTOSAVE_DELAY)
    // Always points at the most recent still-pending save (this closure's
    // formName/fields), so a true unmount can flush exactly what's owed.
    pendingSaveRef.current = doSave

    return () => clearTimeout(debounceRef.current)
  }, [formName, formDescription, fields, loading, id])

  // Runs only on true unmount (empty deps), unlike the effect above whose
  // cleanup also fires on every keystroke as the debounce resets - this is
  // the one place it's correct to flush a still-pending save instead of
  // just letting it be cancelled.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) pendingSaveRef.current()
    }
  }, [])

  function updateField(index, changes) {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...changes }
    setFields(newFields)
  }

  function updateFieldType(index, newType) {
    const changes = { type: newType }
    if (newType === 'location' && !fields[index].defaultCountry) {
      changes.defaultCountry = session.user.user_metadata?.country || COUNTRIES[0]
    }
    updateField(index, changes)
  }

  function updateFieldOptions(index, text) {
    const options = text.split(',').map(o => o.trim()).filter(o => o !== '')
    updateField(index, { optionsText: text, options })
  }

  function updateFieldProducts(fieldIndex, products) {
    const newFields = [...fields]
    newFields[fieldIndex] = { ...newFields[fieldIndex], products }
    setFields(newFields)
  }

  function removeField(index) {
    const removedField = fields[index]
    setFields(fields.filter((_, i) => i !== index))

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    setRecentlyRemoved({ field: removedField, index })
    undoTimeoutRef.current = setTimeout(() => {
      setRecentlyRemoved(null)
    }, 6000)
  }

  function undoRemoveField() {
    if (!recentlyRemoved) return
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)

    setFields(currentFields => {
      const restored = [...currentFields]
      const insertAt = Math.min(recentlyRemoved.index, restored.length)
      restored.splice(insertAt, 0, recentlyRemoved.field)
      return restored
    })
    setRecentlyRemoved(null)
  }

  function handleConfirmRemove() {
    if (!pendingConfirm) return
    if (pendingConfirm.type === 'field') {
      removeField(pendingConfirm.index)
    }
    setPendingConfirm(null)
  }

  function addField() {
    setFields([...fields, {
      id: 'f' + Date.now(),
      label: '',
      type: 'text',
    }])
  }

  // Adds a recommended field (Location, Customer Name, ...) from
  // MoreDetailsManager's tile tray, straight into the pinned/main list -
  // same defaultCountry convenience updateFieldType already applies when a
  // field is switched to Location by hand.
  function addPresetField(preset) {
    const newField = {
      id: 'f' + Date.now() + Math.random().toString(36).slice(2, 6),
      label: preset.label,
      type: preset.type,
      required: false,
    }
    if (preset.type === 'location') {
      newField.defaultCountry = session.user.user_metadata?.country || COUNTRIES[0]
    }
    setFields([...fields, newField])
  }

  function addSection() {
    setFields([...fields, {
      id: 's' + Date.now(),
      type: 'section',
      title: '',
      description: '',
    }])
  }

  function handleDragStart(index) {
    setDragIndex(index)
  }

  function handleDragOver(e, overIndex) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === overIndex) return
    const newFields = [...fields]
    const [moved] = newFields.splice(dragIndex, 1)
    newFields.splice(overIndex, 0, moved)
    setDragIndex(overIndex)
    setFields(newFields)
  }

  function handleDragEnd() {
    setDragIndex(null)
  }

  async function saveChanges() {
    if (formName.trim() === '') {
      setMessage('Please enter a form name.')
      return
    }
    if (fields.length === 0) {
      setMessage('Please add at least one field.')
      return
    }
    if (fields.some(f => f.type !== 'section' && f.label.trim() === '')) {
      setMessage('Every field needs a name.')
      return
    }
    if (fields.some(f => f.type === 'cart' && (!f.products || f.products.length === 0))) {
      setMessage('Every Product Cart field needs at least one product.')
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    pendingSaveRef.current = null // this explicit save supersedes any pending autosave flush

    const cleanedFields = cleanFieldsForSave(fields)

    setSaving(true)
    const { error } = await supabase
      .from('forms')
      .update({ name: formName, description: formDescription.trim() || null, fields: cleanedFields })
      .eq('id', id)

    setSaving(false)

    if (error) {
      setMessage('Error saving: ' + error.message)
    } else {
      setMessage('Changes saved.')
      setTimeout(() => navigate('/'), 700)
    }
  }

  if (loading) return <div className="page">Loading form...</div>
  if (error) return <div className="page" style={{ color: 'red' }}>{error}</div>

  const hasCartField = fields.some(f => f.type === 'cart')
  // On a cart form, everything after the menu reads as one undifferentiated
  // list otherwise - nothing marks it as "questions asked at checkout"
  // rather than more menu configuration.
  const firstNonCartFieldIndex = hasCartField ? fields.findIndex(f => f.type !== 'cart') : -1
  const additionalInfoCount = firstNonCartFieldIndex === -1 ? 0 : fields.length - firstNonCartFieldIndex

  return (
    <div className="page">
      {isFocusMode && <PosSidePanel formId={id} hasCartField={hasCartField} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <h1 style={{ margin: 0 }}>{hasCartField ? 'Add Product' : 'Edit Form'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {!hasCartField && (
            <Link to={`/form/${id}`} style={{ fontSize: '0.9rem', color: 'var(--color-primary)' }}>
              View public form →
            </Link>
          )}
          <button onClick={saveChanges} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.1rem', fontSize: '0.8rem', color: 'var(--color-muted)', minHeight: '1rem' }}>
        {autosaveStatus === 'saving' && 'Saving changes…'}
        {autosaveStatus === 'saved' && 'Changes saved automatically'}
        {autosaveStatus === 'error' && <span style={{ color: '#c0392b' }}>Autosave failed, use Save Changes to retry</span>}
      </div>

      {message && (
        <p style={{ marginBottom: '1rem', color: message.includes('saved') || message.includes('Imported') ? '#1a7f37' : '#c0392b' }}>
          {message}
        </p>
      )}

      {!hasCartField && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Form Name</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            style={{ padding: '0.6rem', width: '100%', fontSize: '1rem', marginTop: '0.3rem' }}
          />
          <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.8rem', display: 'block' }}>
            Description <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Shown to respondents under the title"
            rows={2}
            style={{ padding: '0.6rem', width: '100%', fontSize: '0.92rem', marginTop: '0.3rem' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {fields.map((field, index) => (
          <Fragment key={field.id}>
          {(field.type === 'cart' || !hasCartField || showAdditionalInfo) && (
          field.type === 'section' ? (
            <div
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className="card"
              style={{
                padding: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.8rem',
                opacity: dragIndex === index ? 0.5 : 1, cursor: 'grab',
                borderLeft: '4px solid var(--color-primary)', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-soft) 100%)'
              }}
            >
              <div style={{ fontSize: '1.2rem', color: '#bbb', paddingTop: '0.5rem', userSelect: 'none', lineHeight: 1 }} title="Drag to reorder">
                ⠿
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Section {index > 0 ? `- starts a new page` : ''}
                </div>
                <input
                  type="text"
                  value={field.title}
                  onChange={(e) => updateField(index, { title: e.target.value })}
                  placeholder="Section title"
                  style={{ padding: '0.5rem', fontWeight: 700 }}
                />
                <textarea
                  value={field.description}
                  onChange={(e) => updateField(index, { description: e.target.value })}
                  placeholder="Section description (optional)"
                  rows={2}
                  style={{ padding: '0.5rem' }}
                />
              </div>
              <button
                className="secondary"
                style={{ color: '#c0392b' }}
                onClick={() => setPendingConfirm({ type: 'field', index })}
              >
                Remove
              </button>
            </div>
          ) : (
          <div
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className="card field-card"
            style={{
              padding: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.8rem',
              opacity: dragIndex === index ? 0.5 : 1,
              cursor: 'grab',
              background: field.type === 'cart' ? 'var(--color-primary-soft)' : undefined
            }}
          >
            <div className="field-drag-handle" style={{
              fontSize: '1.2rem', color: '#bbb', paddingTop: '0.6rem',
              userSelect: 'none', lineHeight: 1
            }} title="Drag to reorder">
              ⠿
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {field.type !== 'cart' && (
                <div className="field-row" style={{ display: 'flex', gap: '0.6rem' }}>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    placeholder="Field name"
                    style={{ flex: 2 }}
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateFieldType(index, e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {FIELD_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {TYPES_WITH_OPTIONS.includes(field.type) && (
                <input
                  type="text"
                  value={field.optionsText !== undefined ? field.optionsText : (field.options || []).join(', ')}
                  onChange={(e) => updateFieldOptions(index, e.target.value)}
                  placeholder="Options, comma separated e.g. Cash, Transfer, Card"
                />
              )}

              {TYPES_WITH_PRODUCTS.includes(field.type) && (
                <div>
                  <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>
                      ✓ {(field.products || []).length} Product{(field.products || []).length !== 1 ? 's' : ''}
                    </span>
                    <button type="button" onClick={() => setManageProductsIndex(manageProductsIndex === index ? null : index)}>
                      {manageProductsIndex === index ? 'Hide Products' : 'Manage Products →'}
                    </button>
                  </div>
                  {manageProductsIndex === index && (
                    <ProductManager
                      inline
                      products={field.products || []}
                      onChange={(products) => updateFieldProducts(index, products)}
                    />
                  )}
                </div>
              )}

              {field.type !== 'cart' && (
                <>
                  <FieldTypeConfig field={field} index={index} updateField={updateField} allFields={fields} />
                  <FieldValidationControls field={field} index={index} updateField={updateField} />
                </>
              )}
            </div>

            {field.type !== 'cart' && (
              <div style={{ position: 'relative', flexShrink: 0 }} ref={openFieldMenu === field.id ? fieldMenuRef : null}>
                <button
                  className="secondary"
                  onClick={() => setOpenFieldMenu(openFieldMenu === field.id ? null : field.id)}
                  title="More options"
                >
                  ⋮
                </button>

                {openFieldMenu === field.id && (
                  <div className="dropdown-panel" style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
                    background: 'white', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    zIndex: 20, minWidth: '140px', overflow: 'hidden'
                  }}>
                    <MenuItem
                      danger
                      onClick={() => {
                        setOpenFieldMenu(null)
                        setPendingConfirm({ type: 'field', index })
                      }}
                    >
                      Remove Field
                    </MenuItem>
                  </div>
                )}
              </div>
            )}
          </div>
          )
          )}
          </Fragment>
        ))}

        {fields.length === 0 && (
          <p style={{ color: 'var(--color-muted)' }}>No fields yet.</p>
        )}
      </div>

      {hasCartField && (
        <MoreDetailsManager fields={fields} setFields={setFields} addField={addField} addPresetField={addPresetField} />
      )}

      {hasCartField && (
        <div
          onClick={() => setShowAdditionalInfo(v => !v)}
          style={{
            marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)',
            cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <span style={{
            fontSize: '0.7rem', color: 'var(--color-muted)', transform: showAdditionalInfo ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s', display: 'inline-block'
          }}>
            ▾
          </span>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Additional Information · {additionalInfoCount} field{additionalInfoCount !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
              Asked at checkout, alongside the order. Collapsed by default so the menu stays front and center - click to edit.
            </div>
          </div>
        </div>
      )}

      {!hasCartField && (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="secondary" onClick={addField}>
            + Add Field
          </button>
          <button className="secondary" onClick={addSection}>
            + Add Section
          </button>
        </div>
      )}

      {hasCartField && showAdditionalInfo && (
        <div style={{ marginTop: '1rem' }}>
          <button className="secondary" onClick={addField}>
            + Add Field
          </button>
        </div>
      )}

      {recentlyRemoved && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: 'white', padding: '0.7rem 1.2rem', borderRadius: '8px',
          display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          zIndex: 200, fontSize: '0.9rem'
        }}>
          <span>Field "{recentlyRemoved.field.label || 'Untitled'}" removed.</span>
          <span
            onClick={undoRemoveField}
            style={{ color: '#5aa9ff', cursor: 'pointer', fontWeight: '600' }}
          >
            Undo
          </span>
        </div>
      )}

      {pendingConfirm && (
        <ConfirmDialog
          title="Remove this field?"
          message="This will remove the field from your form. You can undo this for a few seconds right after removing it."
          confirmLabel="Remove"
          danger
          onConfirm={handleConfirmRemove}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {!hasCartField && (
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          title="Preview form"
          style={{
            position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 150,
            borderRadius: '999px', padding: '0.8rem 1.3rem', fontSize: '0.9rem',
            boxShadow: '0 6px 18px rgba(0,0,0,0.22)'
          }}
        >
          Preview
        </button>
      )}

      {showPreview && (
        <FormPreviewModal
          formName={formName}
          description={formDescription}
          fields={fields}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

function MenuItem({ children, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.6rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer',
        color: danger ? '#c0392b' : 'inherit'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
  )
}

export default EditForm