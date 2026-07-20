import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from './supabaseClient'
import FieldValidationControls from './FieldValidationControls'
import FieldTypeConfig from './FieldTypeConfig'
import ConfirmDialog from './ConfirmDialog'

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
]

const TYPES_WITH_OPTIONS = ['dropdown', 'multiplechoice', 'checkbox']
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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formName, setFormName] = useState('')
  const [fields, setFields] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)

  const [autosaveStatus, setAutosaveStatus] = useState('idle') // idle | saving | saved | error
  const debounceRef = useRef(null)
  const isFirstRun = useRef(true)

  const [recentlyRemoved, setRecentlyRemoved] = useState(null) // { field, index }
  const undoTimeoutRef = useRef(null)
  const [pendingConfirm, setPendingConfirm] = useState(null) // { type: 'field', index } | { type: 'product', fieldIndex, productIndex }

  useEffect(() => {
    async function loadForm() {
      const { data, error } = await supabase.from('forms').select('*').eq('id', id).single()
      if (error) {
        setError('This form could not be found.')
      } else {
        setFormName(data.name)
        setFields(data.fields || [])
      }
      setLoading(false)
    }
    loadForm()
  }, [id])

  // Debounced autosave — skips the initial load, only fires once the person actually edits something
  useEffect(() => {
    if (loading) return

    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      if (formName.trim() === '') return // don't autosave over a name that's mid-clear

      setAutosaveStatus('saving')
      const cleanedFields = cleanFieldsForSave(fields)

      const { error } = await supabase
        .from('forms')
        .update({ name: formName, fields: cleanedFields })
        .eq('id', id)

      setAutosaveStatus(error ? 'error' : 'saved')
    }, AUTOSAVE_DELAY)

    return () => clearTimeout(debounceRef.current)
  }, [formName, fields, loading, id])

  function updateField(index, changes) {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...changes }
    setFields(newFields)
  }

  function updateFieldOptions(index, text) {
    const options = text.split(',').map(o => o.trim()).filter(o => o !== '')
    updateField(index, { optionsText: text, options })
  }

  function addProduct(fieldIndex) {
    const newFields = [...fields]
    const products = newFields[fieldIndex].products || []
    newFields[fieldIndex] = {
      ...newFields[fieldIndex],
      products: [...products, { id: 'p' + Date.now(), name: '', price: '', category: '' }]
    }
    setFields(newFields)
  }

  function updateProduct(fieldIndex, productIndex, changes) {
    const newFields = [...fields]
    const products = [...(newFields[fieldIndex].products || [])]
    products[productIndex] = { ...products[productIndex], ...changes }
    newFields[fieldIndex] = { ...newFields[fieldIndex], products }
    setFields(newFields)
  }

  function removeProduct(fieldIndex, productIndex) {
    const newFields = [...fields]
    const products = (newFields[fieldIndex].products || []).filter((_, i) => i !== productIndex)
    newFields[fieldIndex] = { ...newFields[fieldIndex], products }
    setFields(newFields)
  }

  function getFieldCategories(fieldIndex) {
    const products = fields[fieldIndex].products || []
    return Array.from(new Set(products.map(p => p.category).filter(c => c && c.trim() !== '')))
  }

  function downloadTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([
      { Name: 'Sample Product', Price: 1000, Category: 'Category Name' },
      { Name: 'Another Product', Price: 2500, Category: 'Category Name' }
    ])
    worksheet['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 20 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')
    XLSX.writeFile(workbook, 'product-catalogue-template.xlsx')
  }

  function handleFileUpload(fieldIndex, event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet)

        const importedProducts = rows
          .filter(row => row.Name && row.Name.toString().trim() !== '')
          .map(row => ({
            id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
            name: row.Name.toString().trim(),
            price: Number(row.Price) || 0,
            category: row.Category ? row.Category.toString().trim() : ''
          }))

        if (importedProducts.length === 0) {
          setMessage('No valid products found in that file. Make sure the "Name" column is filled in.')
          return
        }

        const newFields = [...fields]
        const existing = newFields[fieldIndex].products || []
        newFields[fieldIndex] = { ...newFields[fieldIndex], products: [...existing, ...importedProducts] }
        setFields(newFields)
        setMessage(`Imported ${importedProducts.length} product${importedProducts.length !== 1 ? 's' : ''}.`)
      } catch (err) {
        setMessage('Could not read that file. Make sure it\'s a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(file)
    event.target.value = ''
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
    } else if (pendingConfirm.type === 'product') {
      removeProduct(pendingConfirm.fieldIndex, pendingConfirm.productIndex)
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
    if (fields.some(f => f.label.trim() === '')) {
      setMessage('Every field needs a name.')
      return
    }
    if (fields.some(f => f.type === 'cart' && (!f.products || f.products.length === 0))) {
      setMessage('Every Product Cart field needs at least one product.')
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const cleanedFields = cleanFieldsForSave(fields)

    setSaving(true)
    const { error } = await supabase
      .from('forms')
      .update({ name: formName, fields: cleanedFields })
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

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <h1 style={{ margin: 0 }}>Edit Form</h1>
        <button onClick={saveChanges} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ marginBottom: '1.1rem', fontSize: '0.8rem', color: 'var(--color-muted)', minHeight: '1rem' }}>
        {autosaveStatus === 'saving' && 'Saving changes…'}
        {autosaveStatus === 'saved' && 'Changes saved automatically'}
        {autosaveStatus === 'error' && <span style={{ color: '#c0392b' }}>Autosave failed — use Save Changes to retry</span>}
      </div>

      {message && (
        <p style={{ marginBottom: '1rem', color: message.includes('saved') || message.includes('Imported') ? '#1a7f37' : '#c0392b' }}>
          {message}
        </p>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Form Name</label>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          style={{ padding: '0.6rem', width: '100%', fontSize: '1rem', marginTop: '0.3rem' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {fields.map((field, index) => (
          <div
            key={field.id}
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
              cursor: 'grab'
            }}
          >
            <div className="field-drag-handle" style={{
              fontSize: '1.2rem', color: '#bbb', paddingTop: '0.5rem',
              userSelect: 'none', lineHeight: 1
            }} title="Drag to reorder">
              ⠿
            </div>

            <div className="field-card-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="field-row" style={{ display: 'flex', gap: '0.6rem' }}>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  placeholder="Field name"
                  style={{ flex: 2, padding: '0.5rem' }}
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(index, { type: e.target.value })}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {TYPES_WITH_OPTIONS.includes(field.type) && (
                <input
                  type="text"
                  value={field.optionsText !== undefined ? field.optionsText : (field.options || []).join(', ')}
                  onChange={(e) => updateFieldOptions(index, e.target.value)}
                  placeholder="Options, comma separated e.g. Cash, Transfer, Card"
                  style={{ padding: '0.5rem' }}
                />
              )}

              {TYPES_WITH_PRODUCTS.includes(field.type) && (
                <div style={{ marginTop: '0.3rem' }}>
                <div className="products-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Products</label>
                    <div className="products-header-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="secondary" onClick={downloadTemplate} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
                        Download Template
                      </button>
                      <label className="secondary" style={{
                        fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius)',
                        border: '1px solid var(--color-border)', cursor: 'pointer', display: 'inline-block'
                      }}>
                        Upload Filled Sheet
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleFileUpload(index, e)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>

                  <datalist id={`categories-${field.id}`}>
                    {getFieldCategories(index).map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>

                  {(field.products || []).map((product, pIndex) => (
                    <div key={product.id} className="field-row" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => updateProduct(index, pIndex, { name: e.target.value })}
                        placeholder="Item name"
                        style={{ flex: 2, minWidth: 0, padding: '0.4rem' }}
                      />
                      <input
                        type="number"
                        value={product.price}
                        onChange={(e) => updateProduct(index, pIndex, { price: e.target.value })}
                        placeholder="Price"
                        style={{ flex: 1, minWidth: 0, padding: '0.4rem' }}
                      />
                      <input
                        type="text"
                        list={`categories-${field.id}`}
                        value={product.category || ''}
                        onChange={(e) => updateProduct(index, pIndex, { category: e.target.value })}
                        placeholder="Category"
                        style={{ flex: 1, minWidth: 0, padding: '0.4rem' }}
                      />
                      <button className="secondary" style={{ color: '#c0392b', flexShrink: 0 }} onClick={() => setPendingConfirm({ type: 'product', fieldIndex: index, productIndex: pIndex })}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button className="secondary" onClick={() => addProduct(index)} style={{ marginTop: '0.5rem' }}>
                    + Add Product
                  </button>
                </div>
              )}

              <FieldTypeConfig field={field} index={index} updateField={updateField} />

              <FieldValidationControls field={field} index={index} updateField={updateField} />
            </div>

            <button
              className="secondary field-remove-btn"
              style={{ color: '#c0392b', flexShrink: 0 }}
              onClick={() => setPendingConfirm({ type: 'field', index })}
            >
              Remove
            </button>
          </div>
        ))}

        {fields.length === 0 && (
          <p style={{ color: 'var(--color-muted)' }}>No fields yet.</p>
        )}
      </div>

      <button className="secondary" onClick={addField} style={{ marginTop: '1rem' }}>
        + Add Field
      </button>

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
          title={pendingConfirm.type === 'field' ? 'Remove this field?' : 'Remove this product?'}
          message={
            pendingConfirm.type === 'field'
              ? 'This will remove the field from your form. You can undo this for a few seconds right after removing it.'
              : 'This will remove the product from your list.'
          }
          confirmLabel="Remove"
          danger
          onConfirm={handleConfirmRemove}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}

export default EditForm