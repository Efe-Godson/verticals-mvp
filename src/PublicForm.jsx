import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

function PublicForm() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [answers, setAnswers] = useState({})
  const [cartQuantities, setCartQuantities] = useState({})
  const [cartSearch, setCartSearch] = useState({})
  const [cartCategory, setCartCategory] = useState({})
  const [respondentEmail, setRespondentEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState({})

  useEffect(() => {
    async function loadForm() {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setMessage('This form could not be found.')
      } else if (data.status !== 'published') {
        setMessage('This form is not published yet.')
      } else {
        setForm(data)
      }
      setLoading(false)
    }

    loadForm()
  }, [id])

  function updateAnswer(fieldId, value) {
    setAnswers({ ...answers, [fieldId]: value })
    if (errors[fieldId]) {
      const newErrors = { ...errors }
      delete newErrors[fieldId]
      setErrors(newErrors)
    }
  }

  function updateCartQuantity(fieldId, productId, qty) {
    setCartQuantities({
      ...cartQuantities,
      [fieldId]: {
        ...(cartQuantities[fieldId] || {}),
        [productId]: qty
      }
    })
  }

  function setCartSearchText(fieldId, text) {
    setCartSearch({ ...cartSearch, [fieldId]: text })
  }

  function setCartCategoryFilter(fieldId, category) {
    setCartCategory({ ...cartCategory, [fieldId]: category })
  }

  function incrementCartItem(fieldId, productId) {
    const current = Number((cartQuantities[fieldId] || {})[productId]) || 0
    updateCartQuantity(fieldId, productId, current + 1)
  }

  function decrementCartItem(fieldId, productId) {
    const current = Number((cartQuantities[fieldId] || {})[productId]) || 0
    updateCartQuantity(fieldId, productId, Math.max(0, current - 1))
  }

  function setCartItemQuantity(fieldId, productId, rawValue) {
    const num = Math.max(0, Math.floor(Number(rawValue)) || 0)
    updateCartQuantity(fieldId, productId, num)
  }

  function removeCartItem(fieldId, productId) {
    updateCartQuantity(fieldId, productId, 0)
  }

  async function handleFileSelect(fieldId, event) {
    const file = event.target.files[0]
    if (!file) return

    const field = form.fields.find(f => f.id === fieldId)
    const maxSizeMB = field?.maxSizeMB ?? 5

    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrors({ ...errors, [fieldId]: `File must be under ${maxSizeMB}MB.` })
      event.target.value = ''
      return
    }

    setUploading({ ...uploading, [fieldId]: true })
    if (errors[fieldId]) {
      const newErrors = { ...errors }
      delete newErrors[fieldId]
      setErrors(newErrors)
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${form.id}/${fieldId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage.from('form-uploads').upload(path, file)

    if (error) {
      setUploading({ ...uploading, [fieldId]: false })
      setErrors({ ...errors, [fieldId]: 'Upload failed: ' + error.message })
      event.target.value = ''
      return
    }

    const { data } = supabase.storage.from('form-uploads').getPublicUrl(path)
    updateAnswer(fieldId, data.publicUrl)
    setUploading({ ...uploading, [fieldId]: false })
  }

  function validateField(field, value) {
    if (field.type === 'cart') return null

    if (field.type === 'checkbox') {
      const arr = Array.isArray(value) ? value : []
      if (field.required && arr.length === 0) {
        return field.errorMessage || `${field.label} is required.`
      }
      if (field.minSelect !== undefined && arr.length > 0 && arr.length < field.minSelect) {
        return field.errorMessage || `Select at least ${field.minSelect} option(s) for ${field.label}.`
      }
      if (field.maxSelect !== undefined && arr.length > field.maxSelect) {
        return field.errorMessage || `Select at most ${field.maxSelect} option(s) for ${field.label}.`
      }
      return null
    }

    if (field.type === 'multiplechoicegrid') {
      const rows = field.rows || []
      const answeredRows = rows.filter(row => value && value[row]).length
      if (field.required && answeredRows < rows.length) {
        return field.errorMessage || `Please answer every row of ${field.label}.`
      }
      return null
    }

    if (field.type === 'checkboxgrid') {
      const rows = field.rows || []
      const answeredRows = rows.filter(row => value && value[row] && value[row].length > 0).length
      if (field.required && answeredRows < rows.length) {
        return field.errorMessage || `Please answer every row of ${field.label}.`
      }
      return null
    }

    if (field.type === 'linearscale' || field.type === 'rating') {
      if (field.required && (value === undefined || value === null || value === '')) {
        return field.errorMessage || `${field.label} is required.`
      }
      return null
    }

    const strVal = (value ?? '').toString().trim()

    if (field.required && strVal === '') {
      return field.errorMessage || `${field.label} is required.`
    }
    if (strVal === '') return null // not required and left blank — nothing further to check

    if (field.type === 'text' || field.type === 'longtext') {
      if (field.minLength !== undefined && strVal.length < field.minLength) {
        return field.errorMessage || `${field.label} must be at least ${field.minLength} characters.`
      }
      if (field.maxLength !== undefined && strVal.length > field.maxLength) {
        return field.errorMessage || `${field.label} must be at most ${field.maxLength} characters.`
      }
    }

    if (field.type === 'number') {
      const num = Number(strVal)
      if (isNaN(num)) {
        return field.errorMessage || `${field.label} must be a number.`
      }
      if (field.min !== undefined && num < field.min) {
        return field.errorMessage || `${field.label} must be at least ${field.min}.`
      }
      if (field.max !== undefined && num > field.max) {
        return field.errorMessage || `${field.label} must be at most ${field.max}.`
      }
    }

    if (field.type === 'date') {
      if (field.minDate && strVal < field.minDate) {
        return field.errorMessage || `${field.label} must be on or after ${field.minDate}.`
      }
      if (field.maxDate && strVal > field.maxDate) {
        return field.errorMessage || `${field.label} must be on or before ${field.maxDate}.`
      }
    }

    if (field.type === 'time') {
      if (field.minTime && strVal < field.minTime) {
        return field.errorMessage || `${field.label} must be at or after ${field.minTime}.`
      }
      if (field.maxTime && strVal > field.maxTime) {
        return field.errorMessage || `${field.label} must be at or before ${field.maxTime}.`
      }
    }

    if (field.type === 'email') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(strVal)) {
        return field.errorMessage || `${field.label} must be a valid email address.`
      }
    }

    return null
  }

  async function submitAnswers() {
    if (Object.values(uploading).some(v => v)) {
      setMessage('Please wait for the file upload to finish.')
      return
    }

    const newErrors = {}
    form.fields.forEach(field => {
      const err = validateField(field, answers[field.id])
      if (err) newErrors[field.id] = err
    })

    if (form.settings?.collectEmail && (!respondentEmail || respondentEmail.trim() === '')) {
      newErrors._respondent_email = 'Please enter your email before submitting.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setMessage('Please fix the errors below before submitting.')
      return
    }
    setErrors({})

    const finalData = {}
    form.fields.forEach(field => {
      if (field.type === 'cart') {
        const quantities = cartQuantities[field.id] || {}
        const items = (field.products || [])
          .map(p => ({ name: p.name, price: p.price, category: p.category || '', quantity: Number(quantities[p.id]) || 0 }))
          .filter(item => item.quantity > 0)
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        finalData[field.id] = { items, total }
      } else {
        finalData[field.id] = answers[field.id]
      }
    })

    if (form.settings?.collectEmail) {
      finalData._respondent_email = respondentEmail
    }

    const { error } = await supabase
      .from('submissions')
      .insert([{ form_id: form.id, data: finalData }])

    if (error) {
      setMessage('Error submitting: ' + error.message)
    } else {
      setSubmitted(true)
    }
  }

  function renderInput(field) {
    if (field.type === 'longtext') {
      return (
        <textarea
          value={answers[field.id] || ''}
          onChange={(e) => updateAnswer(field.id, e.target.value)}
          style={{ padding: '0.5rem', width: '100%', minHeight: '80px' }}
        />
      )
    }

    if (field.type === 'dropdown') {
      return (
        <select
          value={answers[field.id] || ''}
          onChange={(e) => updateAnswer(field.id, e.target.value)}
          style={{ padding: '0.5rem', width: '100%' }}
        >
          <option value="">Select an option</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    if (field.type === 'multiplechoice') {
      return (
        <div>
          {field.options?.map(opt => (
            <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={answers[field.id] === opt}
                onChange={(e) => updateAnswer(field.id, e.target.value)}
              />
              {' '}{opt}
            </label>
          ))}
        </div>
      )
    }

    if (field.type === 'cart') {
      const quantities = cartQuantities[field.id] || {}
      const search = (cartSearch[field.id] || '').toLowerCase()
      const activeCategory = cartCategory[field.id] || 'All'
      const allProducts = field.products || []

      const categories = ['All', ...Array.from(new Set(
        allProducts.map(p => p.category).filter(c => c && c.trim() !== '')
      ))]

      const filteredProducts = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search)
        const matchesCategory = activeCategory === 'All' || p.category === activeCategory
        return matchesSearch && matchesCategory
      })

      const cartItems = allProducts
        .map(p => ({ ...p, quantity: Number(quantities[p.id]) || 0 }))
        .filter(p => p.quantity > 0)

      const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

      return (
        <div>
          {/* Search box */}
          <input
            type="text"
            value={cartSearch[field.id] || ''}
            onChange={(e) => setCartSearchText(field.id, e.target.value)}
            placeholder="Search products..."
            style={{ width: '100%', padding: '0.6rem', marginBottom: '0.7rem' }}
          />

          {/* Category filter pills */}
          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCartCategoryFilter(field.id, cat)}
                  className={activeCategory === cat ? '' : 'secondary'}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Product grid — small cards */}
          {filteredProducts.length === 0 ? (
            <p style={{ color: '#999', margin: '1rem 0' }}>No products match your search.</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '0.6rem',
              marginBottom: '1rem'
            }}>
              {filteredProducts.map(p => {
                const qty = Number(quantities[p.id]) || 0
                return (
                  <div key={p.id} className="card" style={{
                    padding: '0.7rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                    {p.category && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{p.category}</div>
                    )}
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                      ₦{Number(p.price).toLocaleString()}
                    </div>

                    {qty === 0 ? (
                      <button
                        onClick={() => incrementCartItem(field.id, p.id)}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem', marginTop: '0.2rem' }}
                      >
                        Add to Cart
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                        <button className="secondary" onClick={() => decrementCartItem(field.id, p.id)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}>−</button>
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) => setCartItemQuantity(field.id, p.id, e.target.value)}
                          style={{
                            width: '40px', padding: '0.2rem', fontSize: '0.85rem',
                            textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '4px'
                          }}
                        />
                        <button className="secondary" onClick={() => incrementCartItem(field.id, p.id)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}>+</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Cart summary */}
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.6rem' }}>
              Your Cart {cartItems.length > 0 && `(${cartItems.length})`}
            </div>

            {cartItems.length === 0 ? (
              <p style={{ color: '#999', margin: 0, fontSize: '0.9rem' }}>No items added yet.</p>
            ) : (
              <>
                {cartItems.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.9rem'
                  }}>
                    <div>
                      {item.name} <span style={{ color: '#999' }}>× {item.quantity}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                      <span
                        onClick={() => removeCartItem(field.id, item.id)}
                        style={{ color: '#c0392b', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Remove
                      </span>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.7rem', fontWeight: 'bold' }}>
                  <span>Total</span>
                  <span>₦{total.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )
    }

    if (field.type === 'checkbox') {
      const selected = answers[field.id] || []

      function toggleOption(opt) {
        const newSelected = selected.includes(opt)
          ? selected.filter(o => o !== opt)
          : [...selected, opt]
        updateAnswer(field.id, newSelected)
      }

      return (
        <div>
          {field.options?.map(opt => (
            <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleOption(opt)}
              />
              {' '}{opt}
            </label>
          ))}
        </div>
      )
    }

    if (field.type === 'linearscale') {
      const scaleMin = field.scaleMin ?? 1
      const scaleMax = field.scaleMax ?? 5
      const scaleValues = []
      for (let i = scaleMin; i <= scaleMax; i++) scaleValues.push(i)
      const selected = answers[field.id]

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {field.minLabel && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{field.minLabel}</span>
          )}
          {scaleValues.map(val => (
            <button
              key={val}
              type="button"
              onClick={() => updateAnswer(field.id, val)}
              className={selected === val ? '' : 'secondary'}
              style={{ padding: '0.5rem 0.9rem', minWidth: '40px' }}
            >
              {val}
            </button>
          ))}
          {field.maxLabel && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{field.maxLabel}</span>
          )}
        </div>
      )
    }

    if (field.type === 'rating') {
      const maxStars = field.maxStars ?? 5
      const selected = Number(answers[field.id]) || 0

      return (
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {Array.from({ length: maxStars }, (_, i) => i + 1).map(star => (
            <span
              key={star}
              onClick={() => updateAnswer(field.id, star)}
              style={{
                cursor: 'pointer', fontSize: '1.6rem', lineHeight: 1,
                color: star <= selected ? '#f5b400' : '#ddd'
              }}
            >
              ★
            </span>
          ))}
        </div>
      )
    }

    if (field.type === 'multiplechoicegrid') {
      const gridAnswers = answers[field.id] || {}

      function setRowAnswer(row, col) {
        updateAnswer(field.id, { ...gridAnswers, [row]: col })
      }

      return (
        <div className="table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th></th>
                {field.columns?.map(col => (
                  <th key={col} style={{ fontSize: '0.8rem', fontWeight: '500', padding: '0.4rem', textAlign: 'center' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.rows?.map(row => (
                <tr key={row}>
                  <td style={{ fontSize: '0.85rem', padding: '0.4rem' }}>{row}</td>
                  {field.columns?.map(col => (
                    <td key={col} style={{ textAlign: 'center', padding: '0.4rem' }}>
                      <input
                        type="radio"
                        name={`${field.id}-${row}`}
                        checked={gridAnswers[row] === col}
                        onChange={() => setRowAnswer(row, col)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (field.type === 'checkboxgrid') {
      const gridAnswers = answers[field.id] || {}

      function toggleCell(row, col) {
        const current = gridAnswers[row] || []
        const updated = current.includes(col) ? current.filter(c => c !== col) : [...current, col]
        updateAnswer(field.id, { ...gridAnswers, [row]: updated })
      }

      return (
        <div className="table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th></th>
                {field.columns?.map(col => (
                  <th key={col} style={{ fontSize: '0.8rem', fontWeight: '500', padding: '0.4rem', textAlign: 'center' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.rows?.map(row => (
                <tr key={row}>
                  <td style={{ fontSize: '0.85rem', padding: '0.4rem' }}>{row}</td>
                  {field.columns?.map(col => (
                    <td key={col} style={{ textAlign: 'center', padding: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={(gridAnswers[row] || []).includes(col)}
                        onChange={() => toggleCell(row, col)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (field.type === 'fileupload') {
      const uploaded = answers[field.id]
      const isUploading = !!uploading[field.id]

      return (
        <div>
          <input
            type="file"
            accept={field.acceptTypes || undefined}
            onChange={(e) => handleFileSelect(field.id, e)}
            disabled={isUploading}
          />
          {isUploading && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.4rem' }}>Uploading…</p>
          )}
          {uploaded && !isUploading && (
            <p style={{ fontSize: '0.8rem', color: '#1a7f37', marginTop: '0.4rem' }}>
              Uploaded — <a href={uploaded} target="_blank" rel="noreferrer">view file</a>
            </p>
          )}
        </div>
      )
    }

    const inputType =
      field.type === 'number' ? 'number' :
      field.type === 'email' ? 'email' :
      field.type === 'phone' ? 'tel' :
      field.type === 'date' ? 'date' :
      field.type === 'time' ? 'time' :
      'text'

    return (
      <input
        type={inputType}
        value={answers[field.id] || ''}
        onChange={(e) => updateAnswer(field.id, e.target.value)}
        style={{ padding: '0.5rem', width: '100%' }}
      />
    )
  }

  if (loading) return <div className="page">Loading form...</div>

  if (!form) return <div className="page">{message}</div>

  if (submitted) {
    return (
      <div className="page">
        <h2>Response submitted successfully.</h2>
        <p>Thank you.</p>
        {form.settings?.allowMultipleResponses && (
          <button
            onClick={() => {
              setAnswers({})
              setCartQuantities({})
              setCartSearch({})
              setCartCategory({})
              setRespondentEmail('')
              setSubmitted(false)
              setMessage('')
              setErrors({})
              setUploading({})
            }}
            style={{ marginTop: '1rem' }}
          >
            Submit another response
          </button>
        )}
        <p style={{ marginTop: '3rem', color: '#999', fontSize: '0.85rem' }}>
          Powered by Verticals
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>{form.name}</h1>
      {form.description && <p>{form.description}</p>}

      {form.settings?.collectEmail && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <label>Your Email</label><br />
          <input
            type="email"
            value={respondentEmail}
            onChange={(e) => {
              setRespondentEmail(e.target.value)
              if (errors._respondent_email) {
                const newErrors = { ...errors }
                delete newErrors._respondent_email
                setErrors(newErrors)
              }
            }}
            style={{ padding: '0.5rem', width: '100%', marginTop: '0.4rem' }}
          />
          {errors._respondent_email && (
            <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '0.4rem' }}>{errors._respondent_email}</p>
          )}
        </div>
      )}

      {form.fields.map(field => (
        <div key={field.id} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <label style={{ fontWeight: '600' }}>
            {field.label}{field.required && <span style={{ color: '#c0392b' }}> *</span>}
          </label>
          <div style={{ marginTop: '0.5rem' }}>
            {renderInput(field)}
          </div>
          {errors[field.id] && (
            <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
              {errors[field.id]}
            </p>
          )}
        </div>
      ))}

      <button onClick={submitAnswers} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
        Submit
      </button>

      {message && <p style={{ marginTop: '1rem', color: 'red' }}>{message}</p>}

      <p style={{ marginTop: '3rem', color: '#999', fontSize: '0.85rem' }}>
        Powered by Verticals
      </p>
    </div>
  )
}

export default PublicForm